(function (global) {
  'use strict';

  const VIEW_DETAILS = {
    signIn: ['Log masuk', 'Gunakan e-mel dan kata laluan akaun anda.'],
    signUp: ['Daftar akaun', 'Daftar dengan e-mel anda. Semak peti masuk untuk pengesahan.'],
    forgotPassword: ['Lupa kata laluan?', 'Masukkan e-mel anda untuk meminta pautan tetapan semula.'],
    magicLink: ['Log masuk melalui e-mel', 'Kami akan menghantar pautan log masuk sekali guna ke e-mel anda.'],
    resendConfirmation: ['Hantar semula pengesahan', 'Minta pautan baharu jika e-mel pengesahan belum diterima.'],
    account: ['Akaun anda', 'Urus e-mel dan kata laluan akaun anda.'],
    changePassword: ['Tukar kata laluan', 'Sahkan kata laluan semasa, kemudian pilih kata laluan baharu.'],
    changeEmail: ['Tukar e-mel', 'Pautan pengesahan akan dihantar mengikut tetapan keselamatan akaun.']
  };
  const BUSY_LABELS = {
    signIn: 'Sedang log masuk…', signUp: 'Sedang mendaftar…',
    requestPasswordReset: 'Menghantar pautan…', signInWithMagicLink: 'Menghantar pautan…',
    resendConfirmation: 'Menghantar pengesahan…', changePassword: 'Menyimpan kata laluan…',
    changeEmail: 'Menghantar pengesahan…', requestReauthentication: 'Menghantar kod…',
    signOut: 'Sedang log keluar…'
  };
  const REAUTH_CODES = new Set(['reauthentication_needed', 'reauthentication_not_valid', 'reauthentication_required']);

  /** Optional account controls. All server operations stay in the supplied callbacks. */
  function createAuthUI(options) {
    options = options || {};
    const doc = options.document || global.document;
    if (!doc || !doc.createElement) throw new Error('Auth UI requires a document.');
    const state = Object.assign({ ready: false, busy: false, user: null, recovery: false, callback: null, configurationError: null }, options.state || {});
    let mounted = false, destroyed = false, opened = false, localBusy = false;
    let activeAction = '', currentView = 'signIn', previousFocus = null, localMessage = null;
    let reauthenticationRequired = false, lastCallbackKey = '', fallbackSiblings = [];
    let mountNode = null, createdMount = false, header = null, headerInner = null;
    const forms = new Map();
    const cleanupListeners = [];

    function element(tag, attrs, text) {
      const node = doc.createElement(tag);
      Object.entries(attrs || {}).forEach(function (entry) { node.setAttribute(entry[0], entry[1]); });
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function listen(node, event, callback, config) {
      node.addEventListener(event, callback, config);
      cleanupListeners.push(function () { node.removeEventListener(event, callback, config); });
    }
    function focus(node) {
      if (!node || !node.focus) return;
      try { node.focus({ preventScroll: true }); } catch (_) { node.focus(); }
    }
    function isBusy() { return Boolean(localBusy || state.busy); }
    function unavailable() { return !state.ready || Boolean(state.configurationError); }
    function button(text, attrs, callback) {
      const node = element('button', Object.assign({ type: 'button' }, attrs || {}), text);
      if (callback) listen(node, 'click', callback);
      return node;
    }
    function viewButton(text, view, attrs) {
      return button(text, Object.assign({ 'data-auth-view': view }, attrs || {}), function () { navigate(view); });
    }

    const trigger = button('', { id: 'authAccountButton', class: 'auth-account-button', 'aria-haspopup': 'dialog', 'aria-controls': 'authDialog' }, function () { open(state.user ? 'account' : 'signIn'); });
    const icon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 20 20'); icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('class', 'auth-account-icon');
    const iconPath = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPath.setAttribute('d', 'M13.3 6.3a3.3 3.3 0 1 1-6.6 0 3.3 3.3 0 0 1 6.6 0ZM3.3 17v-1.2a6.7 6.7 0 0 1 13.4 0V17');
    icon.appendChild(iconPath);
    const triggerLabel = element('span', { class: 'auth-account-label' }, 'Log masuk');
    trigger.append(icon, triggerLabel);

    const dialog = element('dialog', { id: 'authDialog', class: 'auth-dialog', 'aria-labelledby': 'authTitle', 'aria-describedby': 'authDescription', 'aria-modal': 'true' });
    const dialogHead = element('div', { class: 'auth-dialog-head' });
    const headingWrap = element('div');
    headingWrap.appendChild(element('span', { class: 'eyebrow' }, 'AKAUN PILIHAN'));
    const title = element('h2', { id: 'authTitle', tabindex: '-1' }, 'Log masuk');
    headingWrap.appendChild(title);
    const closeButton = button('Tutup', { class: 'auth-close', 'aria-label': 'Tutup tetingkap akaun' }, close);
    dialogHead.append(headingWrap, closeButton);
    const body = element('div', { class: 'auth-dialog-body' });
    const description = element('p', { id: 'authDescription', class: 'auth-description' });
    const guestNote = element('p', { class: 'auth-guest-note' }, 'Akaun ialah pilihan. Semua instrumen boleh dimainkan sebagai tetamu.');
    const tabs = element('nav', { class: 'auth-tabs', 'aria-label': 'Pilihan akaun' });
    tabs.append(viewButton('Log masuk', 'signIn', { 'aria-pressed': 'true' }), viewButton('Daftar', 'signUp', { 'aria-pressed': 'false' }));
    const message = element('p', { id: 'authMessage', class: 'auth-message', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', tabindex: '-1', hidden: '' });
    const views = element('div', { class: 'auth-views' });
    body.append(description, guestNote, tabs, message, views);
    const footer = element('div', { class: 'auth-dialog-footer' });
    const continueButton = button('Teruskan sebagai tetamu', { class: 'auth-continue' }, close);
    footer.appendChild(continueButton);
    dialog.append(dialogHead, body, footer);

    function createForm(view, action, submitText) {
      const idName = view.charAt(0).toUpperCase() + view.slice(1);
      const form = element('form', { id: 'auth' + idName + 'Form', class: 'auth-form', 'data-auth-form': view, novalidate: '', hidden: '' });
      const fields = element('div', { class: 'auth-fields' });
      const submit = element('button', { type: 'submit', class: 'primary auth-submit', 'data-auth-operation': action }, submitText);
      form.append(fields, submit);
      const record = { form: form, fields: fields, submit: submit, inputs: {}, action: action, submitText: submitText };
      forms.set(view, record); views.appendChild(form);
      listen(form, 'submit', function (event) {
        event.preventDefault();
        if (isBusy() || unavailable()) return;
        const values = validate(record);
        if (values) runAction(action, values);
      });
      return record;
    }
    function addField(record, name, labelText, type, config) {
      config = config || {};
      const id = record.form.id.replace('Form', '') + name.charAt(0).toUpperCase() + name.slice(1);
      const wrapper = element('div', { class: 'auth-field' });
      const label = element('label', { for: id }, labelText);
      const inputWrap = element('div', { class: type === 'password' ? 'auth-password-wrap' : 'auth-input-wrap' });
      const attrs = Object.assign({ id: id, name: name, type: type, required: '', autocomplete: type === 'email' ? 'email' : 'off' }, config.attrs || {});
      if (type === 'email') Object.assign(attrs, { autocapitalize: 'none', spellcheck: 'false', inputmode: 'email', maxlength: '254' });
      const input = element('input', attrs);
      inputWrap.appendChild(input);
      if (type === 'password') {
        const toggle = button('Tunjuk', { class: 'auth-password-toggle', 'aria-controls': id, 'aria-label': 'Tunjukkan ' + labelText.toLowerCase(), 'aria-pressed': 'false' }, function () {
          const visible = input.type === 'password';
          input.type = visible ? 'text' : 'password';
          toggle.textContent = visible ? 'Sorok' : 'Tunjuk';
          toggle.setAttribute('aria-pressed', visible ? 'true' : 'false');
          toggle.setAttribute('aria-label', (visible ? 'Sorokkan ' : 'Tunjukkan ') + labelText.toLowerCase());
        });
        inputWrap.appendChild(toggle);
      }
      wrapper.append(label, inputWrap);
      if (config.hint) {
        const hint = element('small', { id: id + 'Hint', class: 'auth-field-hint' }, config.hint);
        input.setAttribute('aria-describedby', hint.id); wrapper.appendChild(hint);
      }
      const error = element('small', { id: id + 'Error', class: 'auth-field-error', hidden: '' });
      wrapper.appendChild(error);
      listen(input, 'input', function () { clearFieldError(input, error); });
      record.fields.appendChild(wrapper);
      record.inputs[name] = { input: input, error: error, wrapper: wrapper };
      return wrapper;
    }
    function addEmail(record) { addField(record, 'email', 'E-mel', 'email'); }
    function addNewPassword(record) {
      addField(record, 'password', 'Kata laluan baharu', 'password', { attrs: { autocomplete: 'new-password', minlength: '8', maxlength: '128' }, hint: 'Gunakan 8–128 aksara. Pilih kata laluan yang sukar diteka.' });
      addField(record, 'passwordConfirm', 'Ulang kata laluan baharu', 'password', { attrs: { autocomplete: 'new-password', minlength: '8', maxlength: '128' } });
    }
    function addBackLink(record, view, label) { record.form.appendChild(viewButton(label || 'Kembali ke log masuk', view, { class: 'auth-link auth-back' })); }

    const signIn = createForm('signIn', 'signIn', 'Log masuk');
    addEmail(signIn);
    addField(signIn, 'password', 'Kata laluan', 'password', { attrs: { autocomplete: 'current-password', maxlength: '128' } });
    signIn.form.appendChild(viewButton('Lupa kata laluan?', 'forgotPassword', { class: 'auth-link auth-forgot' }));
    const alternatives = element('div', { class: 'auth-alternatives' });
    alternatives.append(viewButton('Log masuk melalui pautan e-mel', 'magicLink', { class: 'auth-link' }), viewButton('Hantar semula e-mel pengesahan', 'resendConfirmation', { class: 'auth-link' }));
    signIn.form.appendChild(alternatives);

    const signUp = createForm('signUp', 'signUp', 'Daftar akaun');
    addField(signUp, 'name', 'Nama paparan', 'text', { attrs: { autocomplete: 'nickname', maxlength: '60' } });
    addEmail(signUp);
    addField(signUp, 'password', 'Kata laluan', 'password', { attrs: { autocomplete: 'new-password', minlength: '8', maxlength: '128' }, hint: 'Gunakan 8–128 aksara. Pilih kata laluan yang sukar diteka.' });
    addField(signUp, 'passwordConfirm', 'Ulang kata laluan', 'password', { attrs: { autocomplete: 'new-password', minlength: '8', maxlength: '128' } });
    const forgot = createForm('forgotPassword', 'requestPasswordReset', 'Hantar pautan tetapan semula');
    addEmail(forgot); addBackLink(forgot, 'signIn');
    const magic = createForm('magicLink', 'signInWithMagicLink', 'Hantar pautan log masuk');
    addEmail(magic); addBackLink(magic, 'signIn');
    const resend = createForm('resendConfirmation', 'resendConfirmation', 'Hantar semula pengesahan');
    addEmail(resend); addBackLink(resend, 'signIn');

    const account = element('section', { class: 'auth-account', 'data-auth-view-panel': 'account', hidden: '' });
    const identity = element('div', { class: 'auth-identity' });
    const accountName = element('strong', { id: 'authUserName' });
    const accountEmail = element('span', { id: 'authUserEmail', class: 'auth-user-email' });
    const accountVerified = element('span', { class: 'auth-verified' });
    identity.append(accountName, accountEmail, accountVerified);
    const accountActions = element('div', { class: 'auth-account-actions' });
    accountActions.append(viewButton('Tukar kata laluan', 'changePassword'), viewButton('Tukar e-mel', 'changeEmail'));
    const signOutButton = button('Log keluar', { class: 'auth-sign-out', 'data-auth-operation': 'signOut' }, function () { runAction('signOut', {}); });
    account.append(identity, accountActions, element('p', { class: 'auth-local-note' }, 'Rakaman dan suntingan disimpan pada pelayar ini. Akaun tidak menyegerakkan rakaman.'), signOutButton);
    views.appendChild(account);

    const password = createForm('changePassword', 'changePassword', 'Simpan kata laluan baharu');
    const currentPasswordWrapper = addField(password, 'currentPassword', 'Kata laluan semasa', 'password', { attrs: { autocomplete: 'current-password', maxlength: '128' } });
    addNewPassword(password);
    const noncePanel = element('div', { class: 'auth-reauth', hidden: '' });
    noncePanel.appendChild(element('p', { class: 'auth-reauth-copy' }, 'Sahkan perubahan ini dengan kod yang dihantar ke e-mel akaun anda.'));
    const nonceButton = button('Hantar kod pengesahan', { class: 'auth-send-code', 'data-auth-operation': 'requestReauthentication' }, function () { runAction('requestReauthentication', {}); });
    noncePanel.appendChild(nonceButton);
    const nonceWrapper = addField(password, 'nonce', 'Kod pengesahan e-mel', 'text', { attrs: { autocomplete: 'one-time-code', inputmode: 'numeric', maxlength: '12' }, hint: 'Gunakan kod terbaharu daripada e-mel anda.' });
    noncePanel.appendChild(nonceWrapper);
    password.fields.appendChild(noncePanel);
    addBackLink(password, 'account', 'Kembali ke akaun');
    const email = createForm('changeEmail', 'changeEmail', 'Hantar pengesahan e-mel');
    addField(email, 'email', 'E-mel baharu', 'email');
    email.form.insertBefore(element('p', { class: 'auth-form-note' }, 'Semak e-mel lama dan baharu. Alamat akaun berubah selepas pengesahan yang diperlukan selesai.'), email.submit);
    addBackLink(email, 'account', 'Kembali ke akaun');

    function clearFieldError(input, error) {
      input.removeAttribute('aria-invalid'); error.hidden = true; error.textContent = '';
      const described = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (id) { return id && id !== error.id; });
      if (described.length) input.setAttribute('aria-describedby', described.join(' '));
      else input.removeAttribute('aria-describedby');
    }
    function fieldError(field, text) {
      field.input.setAttribute('aria-invalid', 'true'); field.error.textContent = text; field.error.hidden = false;
      const described = (field.input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (!described.includes(field.error.id)) described.push(field.error.id);
      field.input.setAttribute('aria-describedby', described.join(' '));
    }
    function clearErrors() {
      forms.forEach(function (record) { Object.values(record.inputs).forEach(function (field) { clearFieldError(field.input, field.error); }); });
    }
    function clearSensitiveFields() {
      forms.forEach(function (record) {
        Object.entries(record.inputs).forEach(function (entry) {
          if (!['password', 'passwordConfirm', 'currentPassword', 'nonce'].includes(entry[0])) return;
          const field = entry[1]; field.input.value = '';
          if (entry[0] !== 'nonce') field.input.type = 'password';
          const toggle = field.wrapper.querySelector('.auth-password-toggle');
          if (toggle) { toggle.textContent = 'Tunjuk'; toggle.setAttribute('aria-pressed', 'false'); toggle.setAttribute('aria-label', 'Tunjukkan ' + field.wrapper.querySelector('label').textContent.toLowerCase()); }
        });
      });
    }
    function validate(record) {
      clearErrors();
      const values = {}, errors = [];
      Object.entries(record.inputs).forEach(function (entry) {
        const name = entry[0], field = entry[1];
        if (field.wrapper.hidden || field.input.disabled || field.wrapper.closest('[hidden]')) return;
        const value = ['email', 'name', 'nonce'].includes(name) ? field.input.value.trim() : field.input.value;
        values[name] = value;
        let error = '';
        if (!value) error = name === 'email' ? 'Masukkan alamat e-mel anda.' : name === 'name' ? 'Masukkan nama paparan anda.' : name === 'nonce' ? 'Masukkan kod pengesahan daripada e-mel.' : 'Masukkan kata laluan anda.';
        else if (name === 'email' && field.input.validity && field.input.validity.typeMismatch) error = 'Masukkan alamat e-mel yang sah.';
        else if (name === 'password' && ['signUp', 'changePassword'].includes(currentView) && (value.length < 8 || value.length > 128)) error = 'Kata laluan mesti mengandungi 8–128 aksara.';
        else if (name === 'passwordConfirm' && value !== record.inputs.password.input.value) error = 'Kata laluan tidak sepadan. Semak dan cuba lagi.';
        else if (name === 'nonce' && !/^\d{6,12}$/.test(value)) error = 'Masukkan kod angka yang diterima melalui e-mel.';
        if (error) { fieldError(field, error); errors.push(field); }
      });
      if (errors.length) { setMessage({ type: 'error', text: 'Semak ruangan yang ditandakan.' }); focus(errors[0].input); return null; }
      if (currentView === 'changePassword' && state.recovery) delete values.currentPassword;
      return values;
    }
    function setMessage(value) { localMessage = value; renderMessage(); }
    function renderMessage() {
      let value = localMessage;
      if (!value && state.configurationError) value = { type: 'info', text: 'Akaun belum tersedia. Anda boleh terus bermain sebagai tetamu.' };
      if (!value && !state.ready) value = { type: 'info', text: 'Menyemak sesi akaun…' };
      message.hidden = !value;
      message.textContent = value ? value.text : '';
      message.setAttribute('data-kind', value ? value.type || 'info' : 'info');
      message.setAttribute('role', value && value.type === 'error' ? 'alert' : 'status');
      message.setAttribute('aria-live', value && value.type === 'error' ? 'assertive' : 'polite');
    }
    function syncControls() {
      const busy = isBusy(), blocked = busy || unavailable();
      dialog.setAttribute('aria-busy', busy ? 'true' : 'false');
      dialog.querySelectorAll('form input, form button, .auth-tabs button, .auth-account-actions button, .auth-sign-out').forEach(function (node) { node.disabled = blocked; });
      forms.forEach(function (record) { record.submit.textContent = busy && activeAction === record.action ? BUSY_LABELS[record.action] : record.submitText; });
      nonceButton.disabled = blocked; nonceButton.textContent = busy && activeAction === 'requestReauthentication' ? BUSY_LABELS.requestReauthentication : 'Hantar kod pengesahan';
      signOutButton.textContent = busy && activeAction === 'signOut' ? BUSY_LABELS.signOut : 'Log keluar';
      triggerLabel.textContent = state.user ? 'Akaun' : 'Log masuk';
      trigger.setAttribute('aria-label', state.user ? 'Buka akaun anda' : 'Log masuk atau daftar akaun pilihan');
      trigger.setAttribute('data-signed-in', state.user ? 'true' : 'false');
      continueButton.textContent = state.user ? 'Teruskan bermain' : 'Teruskan sebagai tetamu';
    }
    function resolvedView(view) {
      if (view === 'resetPassword' || view === 'recovery') view = 'changePassword';
      if (!VIEW_DETAILS[view]) view = state.user ? 'account' : 'signIn';
      if (['account', 'changePassword', 'changeEmail'].includes(view) && !state.user) return 'signIn';
      if (state.user && ['signIn', 'signUp', 'magicLink', 'resendConfirmation', 'forgotPassword'].includes(view)) return state.recovery ? 'changePassword' : 'account';
      return view;
    }
    function renderView() {
      currentView = resolvedView(currentView);
      const recovery = currentView === 'changePassword' && state.recovery;
      const details = VIEW_DETAILS[currentView];
      title.textContent = recovery ? 'Tetapkan kata laluan baharu' : details[0];
      description.textContent = recovery ? (state.callback && state.callback.type === 'invite' ? 'Lengkapkan jemputan akaun anda dengan memilih kata laluan.' : 'Pautan pemulihan disahkan. Pilih kata laluan baharu untuk akaun anda.') : details[1];
      guestNote.hidden = Boolean(state.user);
      tabs.hidden = !['signIn', 'signUp'].includes(currentView);
      tabs.querySelectorAll('button').forEach(function (node) { node.setAttribute('aria-pressed', node.getAttribute('data-auth-view') === currentView ? 'true' : 'false'); });
      forms.forEach(function (record, view) { record.form.hidden = view !== currentView; });
      account.hidden = currentView !== 'account';
      const user = state.user;
      accountName.textContent = user ? (user.user_metadata && (user.user_metadata.display_name || user.user_metadata.name || user.user_metadata.full_name)) || 'Akaun anda' : '';
      accountEmail.textContent = user && user.email || '';
      accountVerified.textContent = user && (user.email_confirmed_at || user.confirmed_at) ? 'E-mel disahkan' : 'Pengesahan e-mel belum selesai';
      accountVerified.hidden = !user;
      currentPasswordWrapper.hidden = recovery;
      password.inputs.currentPassword.input.required = !recovery;
      noncePanel.hidden = !reauthenticationRequired;
      password.inputs.nonce.input.required = reauthenticationRequired;
      password.form.querySelector('.auth-back').hidden = recovery;
      renderMessage(); syncControls();
    }
    function firstField() {
      const record = forms.get(currentView);
      if (record) return Object.values(record.inputs).map(function (field) { return field.input; }).find(function (input) { return !input.disabled && !input.closest('[hidden]'); });
      return account.querySelector('button:not([disabled])');
    }
    function navigate(view) {
      if (isBusy()) return;
      const previousRecord = forms.get(currentView);
      const nextRecord = forms.get(view);
      if (previousRecord && previousRecord.inputs.email && nextRecord && nextRecord.inputs.email && view !== 'changeEmail') nextRecord.inputs.email.input.value = previousRecord.inputs.email.input.value;
      currentView = resolvedView(view); localMessage = null; reauthenticationRequired = false;
      clearErrors(); clearSensitiveFields(); renderView();
      if (opened) focus(firstField() || title);
    }
    async function runAction(action, values) {
      if (destroyed || isBusy() || unavailable()) return;
      let callback = options.onSubmit;
      if (action === 'signOut' && options.onSignOut) callback = options.onSignOut;
      if (action === 'requestReauthentication' && options.onSendReauthCode) callback = options.onSendReauthCode;
      if (typeof callback !== 'function') { setMessage({ type: 'error', text: 'Akaun belum tersedia. Anda boleh terus bermain sebagai tetamu.' }); return; }
      const originView = currentView;
      let focusAfter = null;
      localBusy = true; activeAction = action; localMessage = null; renderMessage(); syncControls();
      try {
        const result = await (callback === options.onSubmit ? callback(action, values) : callback());
        if (destroyed) return;
        if (result && result.ok === false) {
          if (action === 'changePassword' && REAUTH_CODES.has(result.errorCode)) {
            reauthenticationRequired = true; noncePanel.hidden = false; password.inputs.nonce.input.required = true;
          }
          setMessage({ type: 'error', text: result.message || 'Tindakan belum berjaya. Semak maklumat anda dan cuba lagi.' });
          const target = action === 'changePassword' && /current_password/.test(result.errorCode || '') ? password.inputs.currentPassword : null;
          if (target && !target.wrapper.hidden) { fieldError(target, result.message || 'Semak kata laluan semasa anda.'); focusAfter = target.input; }
          else focusAfter = message;
        } else if (result) {
          setMessage({ type: 'success', text: result.message || 'Perubahan berjaya disimpan.' });
          if (action !== 'requestReauthentication') clearSensitiveFields();
          if (action === 'signOut' && originView === currentView && !state.user) currentView = 'signIn';
        }
      } catch (_) {
        if (!destroyed) { setMessage({ type: 'error', text: 'Sambungan akaun terganggu. Semak internet anda dan cuba lagi.' }); focusAfter = message; }
      } finally {
        localBusy = false; activeAction = '';
        if (!destroyed) { renderView(); if (opened && focusAfter) focus(focusAfter); }
      }
    }
    function setState(next) {
      if (destroyed || !next) return;
      const previousUser = state.user, wasRecovery = state.recovery;
      Object.assign(state, next);
      if (!mounted) { renderView(); return; }
      if (state.recovery && state.user && !wasRecovery) { reauthenticationRequired = false; open('changePassword'); }
      else if (opened && Boolean(previousUser) !== Boolean(state.user)) {
        currentView = state.user ? (state.recovery ? 'changePassword' : 'account') : 'signIn';
        clearSensitiveFields(); clearErrors();
      } else if (opened && wasRecovery && !state.recovery && currentView === 'changePassword') currentView = state.user ? 'account' : 'signIn';
      const callback = state.callback;
      const callbackKey = callback ? [callback.status, callback.type, callback.message].join('|') : '';
      if (callbackKey && callbackKey !== lastCallbackKey && callback && ['success', 'error'].includes(callback.status) && callback.message) {
        if (!opened) open(state.recovery ? 'changePassword' : state.user ? 'account' : 'signIn');
        localMessage = { type: callback.status === 'error' ? 'error' : 'success', text: callback.message };
      }
      lastCallbackKey = callbackKey;
      renderView();
    }
    function setFallbackInert(active) {
      if (active) {
        fallbackSiblings = Array.from(doc.body.children).filter(function (node) { return node !== dialog; }).map(function (node) {
          const saved = { node: node, inert: node.inert, ariaHidden: node.getAttribute('aria-hidden') };
          node.inert = true; node.setAttribute('aria-hidden', 'true'); return saved;
        });
      } else {
        fallbackSiblings.forEach(function (saved) {
          saved.node.inert = saved.inert;
          if (saved.ariaHidden === null) saved.node.removeAttribute('aria-hidden'); else saved.node.setAttribute('aria-hidden', saved.ariaHidden);
        }); fallbackSiblings = [];
      }
    }
    function open(view) {
      if (destroyed) return;
      if (!mounted) mount();
      const wasOpen = opened;
      if (!wasOpen) previousFocus = doc.activeElement;
      currentView = resolvedView(view || (state.user ? 'account' : 'signIn'));
      if (!wasOpen) { localMessage = null; clearErrors(); clearSensitiveFields(); }
      renderView();
      opened = true;
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else { dialog.setAttribute('open', ''); setFallbackInert(true); }
      }
      trigger.setAttribute('aria-expanded', 'true');
      focus(firstField() || title);
      if (!wasOpen && typeof options.onOpen === 'function') options.onOpen();
    }
    function finishClose() {
      if (!opened) return;
      opened = false; setFallbackInert(false); clearSensitiveFields(); clearErrors();
      trigger.setAttribute('aria-expanded', 'false');
      if (previousFocus && previousFocus.isConnected && !previousFocus.closest('[hidden], [inert]')) focus(previousFocus);
      else focus(trigger);
      if (typeof options.onDismiss === 'function') options.onDismiss();
    }
    function close() {
      if (!opened) return;
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
      finishClose();
    }
    function focusableControls() {
      return Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]')).filter(function (node) { return !node.closest('[hidden]'); });
    }
    listen(dialog, 'cancel', function (event) { event.preventDefault(); close(); });
    listen(dialog, 'close', function () { if (!dialog.open) finishClose(); });
    listen(dialog, 'click', function (event) {
      if (event.target !== dialog || !dialog.getBoundingClientRect) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    });
    listen(doc, 'keydown', function (event) {
      if (!opened) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key !== 'Tab') return;
      const controls = focusableControls();
      if (!controls.length) { event.preventDefault(); focus(title); return; }
      const first = controls[0], last = controls[controls.length - 1], active = doc.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) { event.preventDefault(); focus(last); }
      else if (!event.shiftKey && (active === last || !dialog.contains(active))) { event.preventDefault(); focus(first); }
    }, true);
    listen(doc, 'focusin', function (event) { if (opened && !dialog.contains(event.target)) focus(firstField() || closeButton); });

    function mount(container) {
      if (destroyed || mounted) return api;
      if (typeof container === 'string') container = doc.querySelector(container);
      if (!container) container = doc.querySelector('.header-inner') || doc.body;
      if (container === doc.body || (container.matches && container.matches('.header-inner'))) {
        mountNode = element('div', { class: 'auth-mount' }); container.appendChild(mountNode); createdMount = true;
      } else { mountNode = container; mountNode.classList.add('auth-mount'); }
      header = mountNode.closest('.header'); headerInner = mountNode.closest('.header-inner');
      if (header) header.classList.add('auth-enabled');
      if (headerInner) headerInner.classList.add('has-auth');
      mountNode.appendChild(trigger); doc.body.appendChild(dialog); mounted = true;
      trigger.setAttribute('aria-expanded', 'false'); renderView();
      if (state.recovery && state.user) open('changePassword');
      return api;
    }
    function destroy() {
      if (destroyed) return;
      close(); destroyed = true; cleanupListeners.forEach(function (cleanup) { cleanup(); });
      trigger.remove(); dialog.remove();
      if (createdMount && mountNode) mountNode.remove();
      if (header) header.classList.remove('auth-enabled');
      if (headerInner) headerInner.classList.remove('has-auth');
    }
    const api = Object.freeze({ mount: mount, setState: setState, open: open, close: close, destroy: destroy });
    return api;
  }

  global.InstruAuthUI = Object.freeze({ createAuthUI: createAuthUI });
  if (typeof module !== 'undefined' && module.exports) module.exports = global.InstruAuthUI;
})(typeof window !== 'undefined' ? window : globalThis);
