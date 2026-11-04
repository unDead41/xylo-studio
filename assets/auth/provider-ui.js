/* Optional Google and phone sign-in controls. The host owns the dialog and the
 * email/password flow; the provider service owns authentication and safe errors.
 */
(function (global) {
  'use strict';

  const mountedRoots = new WeakMap();
  let mountCount = 0;
  const PENDING_PHASES = new Set(['sending', 'verifying', 'redirecting']);
  const REQUEST_FAILED = 'Permintaan tidak berjaya. Semak sambungan anda dan cuba lagi.';
  const STYLES = `
.auth-providers{color:var(--ink,#172F41);font:inherit;min-width:0}
.auth-providers *{box-sizing:border-box}
.auth-providers [hidden]{display:none!important}
.auth-providers button,.auth-providers input{font:inherit;min-height:44px;border-radius:var(--radius,.75rem)}
.auth-providers button{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:10px 13px;border:1px solid var(--border,#D7E2E9);background:var(--surface,#FFF);color:var(--ink,#172F41);font-weight:650;cursor:pointer;max-width:100%;white-space:normal;text-align:center;line-height:1.4}
.auth-providers button:hover:enabled{background:#F3F7FA;border-color:#ADBFCB}
.auth-providers button:disabled{cursor:not-allowed;opacity:.6;transform:none}
.auth-providers button:focus-visible,.auth-providers input:focus-visible,.auth-providers summary:focus-visible{outline:3px solid var(--focus,#156CC4);outline-offset:3px}
.auth-providers .auth-provider-google,.auth-providers .auth-provider-email{width:100%}
.auth-providers .auth-provider-google svg{width:20px;height:20px;flex:none}
.auth-providers .auth-provider-help,.auth-providers .auth-provider-unavailable{font-size:12px;line-height:1.6;color:var(--muted,#526879);margin:7px 0 0;overflow-wrap:anywhere}
.auth-providers .auth-provider-divider{display:flex;align-items:center;gap:12px;margin:17px 0;color:var(--muted,#526879);font-size:12px}
.auth-providers .auth-provider-divider:before,.auth-providers .auth-provider-divider:after{content:'';height:1px;background:var(--border,#D7E2E9);flex:1}
.auth-providers .auth-provider-phone{margin-top:16px;padding:3px 13px 13px;border:1px solid var(--border,#D7E2E9);border-radius:var(--radius,.75rem);background:#F8FBFC;min-width:0}
.auth-providers .auth-provider-phone summary{cursor:pointer;min-height:44px;padding:10px 0;font-weight:650;line-height:1.5}
.auth-providers .auth-provider-phone summary::marker{color:var(--primary,#126B66)}
.auth-providers .auth-provider-phone form{margin:10px 0 0}
.auth-providers label{display:block;font-size:13px;font-weight:650;margin:0 0 6px}
.auth-providers input{display:block;width:100%;min-width:0;border:1px solid var(--border,#D7E2E9);background:var(--surface,#FFF);color:var(--ink,#172F41);padding:10px 12px;font-size:16px;line-height:1.4}
.auth-providers input:disabled{background:#EEF3F6;color:var(--muted,#526879)}
.auth-providers input[aria-invalid=true]{border-color:var(--danger,#B23845)}
.auth-providers .auth-provider-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
.auth-providers .auth-provider-actions button{flex:1 1 auto}
.auth-providers .auth-provider-primary{background:var(--primary,#126B66);border-color:var(--primary,#126B66);color:#FFF}
.auth-providers .auth-provider-primary:hover:enabled{background:#0C5652;border-color:#0C5652}
.auth-providers .auth-provider-secondary-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.auth-providers .auth-provider-secondary-actions button{flex:1 1 auto;font-size:12px}
.auth-providers .auth-provider-destination{font-size:12px;line-height:1.6;color:var(--muted,#526879);margin:0 0 12px;overflow-wrap:anywhere}
.auth-providers .auth-provider-error{margin:13px 0 0;padding:10px 12px;background:#FFF0F1;color:var(--danger,#B23845);border:1px solid #EBC7CD;border-radius:var(--radius,.75rem);font-size:12px;line-height:1.6;overflow-wrap:anywhere}
.auth-providers .auth-provider-status{margin:11px 0 0;font-size:12px;line-height:1.6;color:var(--muted,#526879);overflow-wrap:anywhere}
.auth-providers .auth-provider-retry{margin-top:9px;width:100%;font-size:12px}
@media(prefers-reduced-motion:reduce){.auth-providers button{transition:none;transform:none}}
`;

  function mount(options) {
    options = options || {};
    const root = options.root;
    const service = options.service;
    if (!root || !root.ownerDocument || typeof root.appendChild !== 'function') {
      throw new TypeError('A DOM root is required for provider controls.');
    }
    if (!service || typeof service.getState !== 'function' || typeof service.subscribe !== 'function') {
      throw new TypeError('A provider service is required for provider controls.');
    }
    const previousMount = mountedRoots.get(root);
    if (previousMount) previousMount.destroy();

    const document = root.ownerDocument;
    const prefix = 'instru-provider-' + (++mountCount) + '-';
    const container = document.createElement('div');
    container.className = 'auth-providers';
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', 'Pilihan log masuk');
    // This template contains only constant markup and locally generated IDs.
    // All service data, including phone numbers and errors, uses textContent.
    container.innerHTML = `
      <button type="button" class="auth-provider-google" data-auth-provider="google" aria-describedby="${prefix}google-help" disabled>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.34 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.97-3.38.97-2.61 0-4.82-1.76-5.61-4.13H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.31.31-1.92V7.49H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.51l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.58 9.58 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.71 9.39 5.95 12 5.95Z"/></svg>
        <span>Teruskan dengan Google</span>
      </button>
      <p id="${prefix}google-help" class="auth-provider-help">Gunakan akaun Google anda, termasuk Gmail.</p>
      <p class="auth-provider-unavailable" data-auth-google-unavailable hidden></p>
      <div data-auth-email-option hidden>
        <div class="auth-provider-divider"><span>atau</span></div>
        <button type="button" class="auth-provider-email" data-auth-provider="email" disabled>Guna e-mel dan kata laluan</button>
        <p class="auth-provider-unavailable" data-auth-email-unavailable hidden></p>
      </div>
      <details class="auth-provider-phone">
        <summary>Guna nombor telefon</summary>
        <p class="auth-provider-unavailable" data-auth-phone-unavailable hidden></p>
        <form data-auth-phone-form novalidate>
          <label for="${prefix}phone">Nombor telefon</label>
          <input id="${prefix}phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+60123456789" maxlength="30" aria-describedby="${prefix}phone-help ${prefix}error" required disabled>
          <p id="${prefix}phone-help" class="auth-provider-help">Sertakan kod negara, contohnya +60123456789. Nombor Malaysia seperti 0123456789 juga diterima.</p>
          <div class="auth-provider-actions"><button type="submit" class="auth-provider-primary" data-auth-send disabled>Hantar kod SMS</button></div>
        </form>
        <form data-auth-code-form novalidate hidden>
          <p class="auth-provider-destination" data-auth-destination></p>
          <label for="${prefix}code">Kod pengesahan SMS</label>
          <input id="${prefix}code" name="token" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" aria-describedby="${prefix}code-help ${prefix}error" required disabled>
          <p id="${prefix}code-help" class="auth-provider-help">Masukkan enam digit kod yang diterima melalui SMS.</p>
          <div class="auth-provider-actions"><button type="submit" class="auth-provider-primary" data-auth-verify disabled>Sahkan dan log masuk</button></div>
          <div class="auth-provider-secondary-actions">
            <button type="button" data-auth-resend disabled>Hantar semula kod</button>
            <button type="button" data-auth-edit>Ubah nombor telefon</button>
          </div>
        </form>
      </details>
      <p id="${prefix}error" class="auth-provider-error" role="alert" hidden></p>
      <p class="auth-provider-status" role="status" aria-live="polite" aria-atomic="true" hidden></p>
      <button type="button" class="auth-provider-retry" data-auth-retry hidden>Semak semula pilihan log masuk</button>
    `;
    const style = document.createElement('style');
    style.textContent = STYLES;
    container.insertBefore(style, container.firstChild);
    root.appendChild(container);

    const find = selector => container.querySelector(selector);
    const google = find('[data-auth-provider="google"]');
    const googleLabel = google.querySelector('span');
    const googleUnavailable = find('[data-auth-google-unavailable]');
    const emailOption = find('[data-auth-email-option]');
    const email = find('[data-auth-provider="email"]');
    const emailUnavailable = find('[data-auth-email-unavailable]');
    const phoneDetails = find('details');
    const phoneUnavailable = find('[data-auth-phone-unavailable]');
    const phoneForm = find('[data-auth-phone-form]');
    const phoneInput = find('[name="phone"]');
    const send = find('[data-auth-send]');
    const codeForm = find('[data-auth-code-form]');
    const codeInput = find('[name="token"]');
    const destination = find('[data-auth-destination]');
    const verify = find('[data-auth-verify]');
    const resend = find('[data-auth-resend]');
    const edit = find('[data-auth-edit]');
    const errorNode = find('[role="alert"]');
    const statusNode = find('[role="status"]');
    const retry = find('[data-auth-retry]');
    const listeners = [];
    let state = { providers: {}, providersLoaded: false, phase: 'idle', busy: false, phone: '', resendAt: 0, error: null };
    let destroyed = false;
    let unsubscribe = null;
    let cooldownTimer = null;
    let localAction = '';
    let localError = '';
    let localErrorField = '';
    let localStatus = '';
    let lastPhone = '';
    let availabilityRefreshing = false;
    let availabilityAttempted = false;
    let availabilityFailed = false;
    let externallyDisabled = false;
    let operationId = 0;

    emailOption.hidden = typeof options.onEmail !== 'function';

    function safeMessage(error) {
      if (error && typeof error.message === 'string') return error.message;
      return typeof error === 'string' ? error : '';
    }

    function pending() {
      return externallyDisabled || state.busy || !!localAction || availabilityRefreshing || PENDING_PHASES.has(state.phase);
    }

    function remainingSeconds() {
      return Math.max(0, Math.ceil((state.resendAt - Date.now()) / 1000));
    }

    function showText(node, message) {
      if (node.textContent !== message) node.textContent = message;
      node.hidden = !message;
    }

    function render() {
      if (destroyed) return;
      const busy = pending();
      const loaded = state.providersLoaded === true;
      const googleAvailable = loaded && state.providers.google === true;
      const emailAvailable = loaded && state.providers.email === true;
      const phoneAvailable = loaded && state.providers.phone === true;
      const hasChallenge = !!state.phone;
      const seconds = remainingSeconds();

      google.disabled = busy || !googleAvailable;
      googleLabel.textContent = state.phase === 'redirecting' || localAction === 'google' ? 'Membuka Google…' : 'Teruskan dengan Google';
      email.disabled = busy || !emailAvailable;
      phoneInput.disabled = busy || !phoneAvailable;
      send.disabled = busy || !phoneAvailable || seconds > 0;
      send.textContent = state.phase === 'sending' || localAction === 'send' ? 'Menghantar kod…' : seconds > 0 ? 'Hantar kod SMS (' + seconds + 's)' : 'Hantar kod SMS';
      codeInput.disabled = busy || !phoneAvailable;
      verify.disabled = busy || !phoneAvailable;
      verify.textContent = state.phase === 'verifying' || localAction === 'verify' ? 'Mengesahkan kod…' : 'Sahkan dan log masuk';
      resend.disabled = busy || !phoneAvailable || seconds > 0;
      resend.textContent = localAction === 'resend' ? 'Menghantar semula…' : seconds > 0 ? 'Hantar semula (' + seconds + 's)' : 'Hantar semula kod';
      edit.disabled = busy;
      phoneForm.hidden = hasChallenge;
      codeForm.hidden = !hasChallenge;

      if (hasChallenge) {
        destination.textContent = 'Kod SMS dihantar ke ' + state.phone + '.';
        if (lastPhone !== state.phone) {
          phoneDetails.open = true;
          phoneInput.value = state.phone;
          codeInput.value = '';
        }
      } else {
        destination.textContent = '';
        if (lastPhone) codeInput.value = '';
      }
      lastPhone = state.phone;

      showText(googleUnavailable, loaded && !googleAvailable ? 'Log masuk dengan Google belum tersedia buat masa ini.' : '');
      showText(emailUnavailable, loaded && !emailAvailable ? 'Log masuk melalui e-mel belum tersedia buat masa ini.' : '');
      showText(phoneUnavailable, loaded && !phoneAvailable ? 'Log masuk melalui nombor telefon belum tersedia buat masa ini.' : '');
      const message = localError || safeMessage(state.error);
      showText(errorNode, message);
      phoneInput.setAttribute('aria-invalid', localErrorField === 'phone' ? 'true' : 'false');
      codeInput.setAttribute('aria-invalid', localErrorField === 'token' ? 'true' : 'false');

      let status = localStatus;
      if (availabilityRefreshing || (!loaded && !availabilityFailed && !availabilityAttempted)) status = 'Menyemak pilihan log masuk…';
      else if (!loaded) status = 'Pilihan log masuk belum tersedia buat masa ini.';
      else if (state.phase === 'redirecting' || localAction === 'google') status = 'Membuka halaman Google untuk log masuk…';
      else if (state.phase === 'sending' || localAction === 'send' || localAction === 'resend') status = 'Menghantar kod SMS…';
      else if (state.phase === 'verifying' || localAction === 'verify') status = 'Mengesahkan kod SMS…';
      else if (state.busy && !status) status = 'Permintaan sedang diproses…';
      showText(statusNode, status);
      retry.hidden = !(availabilityFailed || (!loaded && availabilityAttempted && !availabilityRefreshing));
      retry.disabled = busy;

      if (seconds > 0 && cooldownTimer === null) {
        cooldownTimer = global.setInterval(render, 1000);
      } else if (seconds === 0 && cooldownTimer !== null) {
        global.clearInterval(cooldownTimer);
        cooldownTimer = null;
      }
    }

    function receive(nextState) {
      if (destroyed) return;
      const next = nextState || {};
      state = {
        providers: next.providers || {},
        providersLoaded: next.providersLoaded === true,
        phase: typeof next.phase === 'string' ? next.phase : 'idle',
        busy: next.busy === true,
        phone: typeof next.phone === 'string' ? next.phone : '',
        resendAt: Number.isFinite(next.resendAt) ? next.resendAt : 0,
        error: next.error || null
      };
      render();
    }

    function listen(node, type, handler) {
      node.addEventListener(type, handler);
      listeners.push(() => node.removeEventListener(type, handler));
    }

    function clearLocalFeedback() {
      localError = '';
      localErrorField = '';
      localStatus = '';
    }

    function invalid(field, message, input) {
      clearLocalFeedback();
      localErrorField = field;
      localError = message;
      render();
      input.focus();
    }

    async function perform(action, operation) {
      if (destroyed || pending()) return null;
      clearLocalFeedback();
      localAction = action;
      const currentOperation = ++operationId;
      render();
      let result = null;
      let session = null;
      try {
        result = await operation();
        if (destroyed || currentOperation !== operationId) return result;
        receive(service.getState());
        if (result && result.error) {
          localError = safeMessage(result.error) || REQUEST_FAILED;
        } else if (result && result.data && result.data.session) {
          session = result.data.session;
          codeInput.value = '';
        } else if ((action === 'send' || action === 'resend') && state.phone) {
          localStatus = action === 'resend' ? 'Kod baharu dihantar. Semak SMS anda.' : 'Kod SMS dihantar. Semak SMS anda.';
          codeInput.value = '';
        }
      } catch (_) {
        if (!destroyed && currentOperation === operationId) localError = REQUEST_FAILED;
      } finally {
        if (!destroyed && currentOperation === operationId) {
          localAction = '';
          render();
        }
      }
      if (!destroyed && currentOperation === operationId && result && !result.error && (action === 'send' || action === 'resend') && state.phone && !pending()) codeInput.focus();
      if (!destroyed && currentOperation === operationId && session && typeof options.onAuthenticated === 'function') options.onAuthenticated(session);
      return result;
    }

    async function refreshAvailability() {
      if (destroyed || pending()) return;
      clearLocalFeedback();
      availabilityAttempted = true;
      availabilityRefreshing = true;
      availabilityFailed = false;
      render();
      try {
        if (typeof service.refreshProviders !== 'function') throw new Error();
        const result = await service.refreshProviders();
        if (destroyed) return;
        receive(service.getState());
        availabilityFailed = !state.providersLoaded || !!(result && result.error);
        if (result && result.error) localError = safeMessage(result.error) || REQUEST_FAILED;
      } catch (_) {
        if (!destroyed) {
          availabilityFailed = true;
          localError = 'Pilihan log masuk tidak dapat disemak. Cuba semula.';
        }
      } finally {
        if (!destroyed) {
          availabilityRefreshing = false;
          render();
        }
      }
    }

    listen(google, 'click', () => {
      if (!google.disabled) void perform('google', () => service.startGoogle());
    });
    listen(email, 'click', () => {
      if (!email.disabled && typeof options.onEmail === 'function') {
        clearLocalFeedback();
        render();
        options.onEmail();
      }
    });
    listen(phoneForm, 'submit', event => {
      event.preventDefault();
      if (pending() || send.disabled) return;
      const phone = phoneInput.value.trim().replace(/[\s()-]/g, '');
      if (!/^\+[1-9]\d{7,14}$/.test(phone) && !/^01\d{8,9}$/.test(phone)) {
        invalid('phone', 'Masukkan nombor telefon yang sah, contohnya +60123456789.', phoneInput);
        return;
      }
      void perform('send', () => service.sendPhoneCode(phone));
    });
    listen(codeForm, 'submit', event => {
      event.preventDefault();
      if (pending() || verify.disabled) return;
      const token = codeInput.value.trim();
      if (!/^\d{6}$/.test(token)) {
        invalid('token', 'Masukkan enam digit kod pengesahan SMS.', codeInput);
        return;
      }
      void perform('verify', () => service.verifyPhoneCode(token));
    });
    listen(resend, 'click', () => {
      if (!resend.disabled && state.phone && remainingSeconds() === 0) void perform('resend', () => service.sendPhoneCode(state.phone));
    });
    listen(edit, 'click', () => {
      if (destroyed || pending() || edit.disabled) return;
      clearLocalFeedback();
      codeInput.value = '';
      service.cancelPhone();
      receive(service.getState());
      phoneInput.focus();
    });
    for (const input of [phoneInput, codeInput]) {
      listen(input, 'input', () => {
        if (localError) {
          clearLocalFeedback();
          render();
        }
      });
    }
    listen(retry, 'click', () => { void refreshAvailability(); });

    const controller = {
      refresh: refreshAvailability,
      setDisabled(value) {
        if (destroyed) return;
        externallyDisabled = !!value;
        render();
      },
      reset() {
        if (destroyed) return;
        ++operationId;
        localAction = '';
        clearLocalFeedback();
        codeInput.value = '';
        receive(service.getState());
        if (!state.phone) {
          phoneInput.value = '';
          phoneDetails.open = false;
        }
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        ++operationId;
        for (const remove of listeners) remove();
        listeners.length = 0;
        if (typeof unsubscribe === 'function') unsubscribe();
        if (cooldownTimer !== null) global.clearInterval(cooldownTimer);
        cooldownTimer = null;
        phoneInput.value = '';
        codeInput.value = '';
        container.remove();
        if (mountedRoots.get(root) === controller) mountedRoots.delete(root);
      }
    };
    mountedRoots.set(root, controller);
    try {
      receive(service.getState());
      unsubscribe = service.subscribe(receive);
    } catch (_) {
      availabilityFailed = true;
      availabilityAttempted = true;
      localError = 'Pilihan log masuk tidak dapat disemak. Cuba semula.';
      render();
    }
    if (!state.providersLoaded) void refreshAvailability();
    return controller;
  }

  global.InstruAuthProviderUI = { mount };
})(typeof globalThis !== 'undefined' ? globalThis : window);
