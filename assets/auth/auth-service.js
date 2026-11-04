/* e-Instru Studio authentication. Inject a pinned Supabase v2 client configured
 * with flowType: 'pkce' and detectSessionInUrl: false. This service owns callbacks.
 * Server settings must require the current password and secure email changes.
 * Session/user state is for presentation; database authorization belongs in RLS.
 */
(function (root) {
  'use strict';

  const MIN_PASSWORD_LENGTH = 8;
  const MAX_PASSWORD_LENGTH = 128;
  const EMAIL_FLOW_TYPES = new Set(['signup', 'invite', 'recovery', 'magiclink', 'email_change', 'email']);
  const AUTH_URL_KEYS = ['code', 'sb_flow_id', 'token_hash', 'access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'provider_token', 'provider_refresh_token', 'error', 'error_code', 'error_description', 'auth_flow'];
  const CONFIRMATION_MESSAGE = 'Jika alamat e-mel ini boleh didaftarkan, pautan pengesahan akan dihantar. Semak peti masuk dan folder spam.';
  const RESET_MESSAGE = 'Jika akaun sepadan wujud, pautan pemulihan akan dihantar. Buka pautan dalam pelayar ini dan semak folder spam.';
  const MAGIC_MESSAGE = 'Jika akaun sepadan wujud, pautan log masuk akan dihantar. Buka pautan dalam pelayar ini dan semak folder spam.';
  const ERROR_MESSAGES = {
    invalid_email: 'Masukkan alamat e-mel yang sah.',
    invalid_name: 'Nama mestilah 80 aksara atau kurang.',
    password_required: 'Masukkan kata laluan anda.',
    weak_password: 'Gunakan kata laluan 8 hingga 128 aksara yang lebih sukar diteka.',
    current_password_required: 'Masukkan kata laluan semasa anda.',
    current_password_mismatch: 'Kata laluan semasa tidak tepat.',
    same_password: 'Pilih kata laluan baharu yang berbeza daripada kata laluan semasa.',
    invalid_credentials: 'E-mel atau kata laluan tidak tepat, atau akaun belum disahkan.',
    email_not_confirmed: 'E-mel atau kata laluan tidak tepat, atau akaun belum disahkan. Semak pautan pengesahan dalam e-mel anda.',
    email_exists: 'Alamat e-mel ini tidak boleh digunakan. Cuba alamat lain.',
    reauthentication_needed: 'Pengesahan semula diperlukan. Hantar kod pengesahan ke e-mel anda, kemudian masukkan kod itu.',
    reauthentication_not_valid: 'Kod pengesahan semula tidak sah atau telah tamat tempoh. Minta kod baharu.',
    otp_expired: 'Pautan atau kod ini tidak sah, telah digunakan atau tamat tempoh. Minta pautan atau kod baharu.',
    invalid_link: 'Pautan ini tidak lengkap atau tidak sah. Minta pautan baharu.',
    pkce_verifier_missing: 'Pautan ini perlu dibuka dalam pelayar yang digunakan untuk membuat permintaan. Minta pautan baharu dalam pelayar ini.',
    session_expired: 'Sesi telah tamat. Log masuk semula untuk meneruskan.',
    over_request_rate_limit: 'Terlalu banyak permintaan. Tunggu sebentar sebelum mencuba lagi.',
    email_delivery_unavailable: 'E-mel tidak dapat dihantar sekarang. Cuba lagi kemudian atau hubungi pemilik aplikasi.',
    signup_disabled: 'Pendaftaran akaun baharu belum tersedia. Hubungi pemilik aplikasi.',
    email_provider_disabled: 'Log masuk melalui e-mel belum tersedia. Hubungi pemilik aplikasi.',
    network_error: 'Sambungan tidak berjaya. Semak internet anda dan cuba lagi.',
    auth_unavailable: 'Perkhidmatan akaun belum tersedia. Anda masih boleh menggunakan studio tanpa akaun.',
    busy: 'Permintaan sedang diproses. Tunggu sebentar.',
    invalid_otp: 'Masukkan kod pengesahan e-mel yang sah.',
    auth_error: 'Permintaan tidak berjaya. Cuba lagi atau minta pautan baharu.'
  };

  function failure(code) {
    const safeCode = Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code) ? code : 'auth_error';
    return { ok: false, errorCode: safeCode, message: ERROR_MESSAGES[safeCode] };
  }

  // Never surface a remote error.message, URL description, token, or arbitrary code.
  function mapAuthError(error, context) {
    let code = error && typeof error.code === 'string' ? error.code : '';
    if (context === 'signin' && ['invalid_credentials', 'invalid_login_credentials', 'email_not_confirmed', 'user_not_found', 'user_banned'].includes(code)) code = 'invalid_credentials';
    if (['bad_code_verifier', 'flow_state_not_found', 'flow_state_expired', 'validation_failed'].includes(code) && context === 'callback') code = 'otp_expired';
    if (['access_denied', 'otp_disabled', 'invalid_token', 'bad_jwt'].includes(code) && context === 'callback') code = 'otp_expired';
    if (['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired', 'user_not_found', 'user_banned', 'no_authorization', 'bad_jwt'].includes(code)) code = 'session_expired';
    if (['email_address_invalid', 'validation_failed'].includes(code)) code = 'invalid_email';
    if (['over_email_send_rate_limit', 'over_sms_send_rate_limit', 'over_request_rate_limit'].includes(code) || (error && error.status === 429)) code = 'over_request_rate_limit';
    if (['email_address_not_authorized', 'email_send_failed', 'unexpected_failure'].includes(code) && context === 'email') code = 'email_delivery_unavailable';
    if (['email_conflict_identity_not_deletable', 'user_already_exists'].includes(code)) code = 'email_exists';
    if (error && (error.name === 'AuthSessionMissingError' || error.status === 401)) code = 'session_expired';
    if (error && (['AuthPKCEGrantCodeExchangeError', 'AuthPKCECodeVerifierMissingError'].includes(error.name) || ['pkce_verifier_missing', 'pkce_code_verifier_not_found'].includes(error.code))) code = 'pkce_verifier_missing';
    if (error && (error.name === 'AuthRetryableFetchError' || error.name === 'TypeError' || error.status === 0 || error.status >= 500)) code = 'network_error';
    if (error && error.name === 'AuthWeakPasswordError') code = 'weak_password';
    return failure(code);
  }

  function success(message, data) {
    return data === undefined ? { ok: true, message } : { ok: true, message, data };
  }

  function validEmail(value) {
    const email = typeof value === 'string' ? value.trim() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw { code: 'invalid_email' };
    return email;
  }

  function newPassword(value) {
    if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) throw { code: 'weak_password' };
    return value;
  }

  function callbackMessage(type) {
    if (type === 'recovery') return 'Pautan pemulihan disahkan. Tetapkan kata laluan baharu anda.';
    if (type === 'invite') return 'Jemputan diterima. Tetapkan kata laluan untuk akaun anda.';
    if (type === 'email_change') return 'Pengesahan e-mel diterima. Jika diminta, sahkan juga pautan pada alamat e-mel yang satu lagi.';
    if (type === 'signup' || type === 'email') return 'Alamat e-mel disahkan. Akaun anda sedia digunakan.';
    return 'Anda berjaya log masuk.';
  }

  function createAuthService(options) {
    options = options || {};
    const auth = options.client && options.client.auth;
    const pageLocation = options.location || root.location;
    const pageHistory = options.history || root.history;
    let recoveryStorage = options.storage;
    if (recoveryStorage === undefined) {
      try { recoveryStorage = root.sessionStorage; } catch (_) { recoveryStorage = null; }
    }
    const markerKey = options.storageKey || 'e-instru-auth-recovery-v1';
    const listeners = new Set();
    let initPromise = null;
    let subscription = null;
    let destroyed = false;
    let notifyTimer = null;
    let redirectBase = null;
    const state = {
      ready: false, busy: false, session: null, user: null, recovery: false,
      callback: { status: 'idle', type: null, message: '' },
      configurationError: null
    };

    try {
      redirectBase = new URL(options.redirectTo || pageLocation.href);
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(redirectBase.hostname);
      if ((redirectBase.protocol !== 'https:' && !(redirectBase.protocol === 'http:' && loopback)) || redirectBase.username || redirectBase.password) throw new Error();
      for (const key of AUTH_URL_KEYS) redirectBase.searchParams.delete(key);
      redirectBase.searchParams.delete('type');
      redirectBase.hash = '';
    } catch (_) { state.configurationError = ERROR_MESSAGES.auth_unavailable; }
    if (!auth || typeof auth.getSession !== 'function' || typeof auth.onAuthStateChange !== 'function') state.configurationError = ERROR_MESSAGES.auth_unavailable;

    function getState() {
      return { ...state, callback: { ...state.callback } };
    }

    function notify() {
      if (destroyed) return;
      const snapshot = getState();
      for (const listener of listeners) {
        try { listener(snapshot); } catch (_) { /* UI failures must not break authentication. */ }
      }
    }

    function subscribe(listener) {
      if (typeof listener !== 'function' || destroyed) return function () {};
      listeners.add(listener);
      listener(getState());
      return function () { listeners.delete(listener); };
    }

    function clearRecovery() {
      state.recovery = false;
      try { if (recoveryStorage) recoveryStorage.removeItem(markerKey); } catch (_) { /* Storage is optional. */ }
    }

    function markRecovery(type) {
      if (!state.user || !['recovery', 'invite'].includes(type)) return;
      state.recovery = true;
      try {
        if (recoveryStorage) recoveryStorage.setItem(markerKey, JSON.stringify({ userId: state.user.id, type, expiresAt: Date.now() + 60 * 60 * 1000 }));
      } catch (_) { /* The active page can continue without persistent storage. */ }
    }

    function restoreRecovery() {
      // A verified callback already established this page's recovery state.
      // Optional browser storage must never undo that in-memory result.
      if (state.recovery) return;
      try {
        const marker = recoveryStorage && JSON.parse(recoveryStorage.getItem(markerKey) || 'null');
        if (marker && state.user && marker.userId === state.user.id && marker.expiresAt > Date.now() && ['recovery', 'invite'].includes(marker.type)) {
          state.recovery = true;
          if (state.callback.status === 'idle') state.callback = { status: 'success', type: marker.type, message: callbackMessage(marker.type) };
        } else if (marker) clearRecovery();
      } catch (_) { clearRecovery(); }
    }

    function acceptSession(session) {
      const previousId = state.user && state.user.id;
      state.session = session || null;
      state.user = session && session.user || null;
      if (!state.user || (previousId && previousId !== state.user.id)) clearRecovery();
    }

    function redirectFor(type) {
      if (!redirectBase) throw { code: 'auth_unavailable' };
      const target = new URL(redirectBase.href);
      target.searchParams.set('auth_flow', type);
      return target.href;
    }

    function readCallback() {
      let url;
      try { url = new URL(pageLocation.href); } catch (_) { return null; }
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
      const read = key => url.searchParams.get(key) || hash.get(key) || '';
      const type = read('type') || read('auth_flow');
      const callback = {
        type: EMAIL_FLOW_TYPES.has(type) ? type : null,
        code: read('code'), flowId: read('sb_flow_id'), tokenHash: read('token_hash'),
        accessToken: read('access_token'), refreshToken: read('refresh_token'),
        error: read('error_code') || read('error'),
        hasError: !!(read('error') || read('error_code') || read('error_description'))
      };
      const hasCredentials = !!(callback.code || callback.tokenHash || callback.accessToken || callback.refreshToken);
      const hasAuthKeys = ['code', 'token_hash', 'access_token', 'refresh_token', 'error', 'error_code', 'error_description', 'auth_flow'].some(key => url.searchParams.has(key) || hash.has(key));
      if (!hasCredentials && !callback.hasError && !hasAuthKeys) return null;
      // Capture errors first, then remove credentials and remote descriptions from history.
      const hasAuthFragment = AUTH_URL_KEYS.some(key => hash.has(key)) || EMAIL_FLOW_TYPES.has(hash.get('type'));
      for (const key of AUTH_URL_KEYS) { url.searchParams.delete(key); hash.delete(key); }
      url.searchParams.delete('type');
      hash.delete('type');
      if (hasAuthFragment) url.hash = hash.toString();
      try { if (pageHistory && typeof pageHistory.replaceState === 'function') pageHistory.replaceState(pageHistory.state, '', url.pathname + url.search + url.hash); } catch (_) { /* file:// or a restricted embed may reject history changes. */ }
      return callback;
    }

    async function handleCallback(callback) {
      if (!callback) return success('');
      state.callback = { status: 'processing', type: callback.type, message: 'Mengesahkan pautan akaun…' };
      notify();
      let result;
      try {
        if (callback.hasError) throw { code: callback.error || 'otp_expired' };
        const modes = Number(!!callback.code) + Number(!!callback.tokenHash) + Number(!!(callback.accessToken || callback.refreshToken));
        if (modes !== 1) throw { code: 'invalid_link' };
        if (callback.code) {
          result = await auth.exchangeCodeForSession(callback.code, callback.flowId ? { flowId: callback.flowId } : undefined);
        } else if (callback.tokenHash && callback.type) {
          result = await auth.verifyOtp({ token_hash: callback.tokenHash, type: callback.type });
        } else if (callback.accessToken && callback.refreshToken && callback.type) {
          // Dashboard invitation links use the implicit flow because no verifier
          // exists in the invited user's browser. Only accept a complete pair.
          result = await auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken });
        } else throw { code: 'invalid_link' };
        if (result.error) throw result.error;
        const data = result.data || {};
        const actualType = EMAIL_FLOW_TYPES.has(data.redirectType) ? data.redirectType : callback.type;
        if (!data.session) {
          if (actualType !== 'email_change') throw { code: 'invalid_link' };
        } else {
          acceptSession(data.session);
          if (actualType === 'recovery' || actualType === 'invite') markRecovery(actualType);
          else clearRecovery();
        }
        const message = callbackMessage(actualType);
        state.callback = { status: 'success', type: actualType, message };
        return success(message);
      } catch (error) {
        const mapped = mapAuthError(error, 'callback');
        state.callback = { status: 'error', type: callback.type, message: mapped.message, errorCode: mapped.errorCode };
        return mapped;
      }
    }

    async function initialize() {
      const callback = readCallback();
      if (state.configurationError) {
        state.ready = true;
        if (callback) state.callback = { status: 'error', type: callback.type, message: state.configurationError, errorCode: 'auth_unavailable' };
        notify();
        return failure('auth_unavailable');
      }
      state.busy = true;
      notify();
      try {
        const registered = auth.onAuthStateChange((event, session) => {
          if (destroyed) return;
          acceptSession(session);
          if (event === 'PASSWORD_RECOVERY') markRecovery('recovery');
          if (event === 'SIGNED_OUT') clearRecovery();
          // Subscribers may call Supabase. Run them after the SDK's auth lock
          // has been released; never await another auth call in this callback.
          if (notifyTimer === null) notifyTimer = setTimeout(() => { notifyTimer = null; notify(); }, 0);
        });
        subscription = registered && registered.data && registered.data.subscription;
        let callbackResult = await handleCallback(callback);
        const { data, error } = await auth.getSession();
        if (error) {
          acceptSession(null);
          if (!callback || callbackResult.ok) callbackResult = mapAuthError(error);
        } else {
          acceptSession(data && data.session);
          if (!callback || !callbackResult.ok) restoreRecovery();
        }
        return callbackResult;
      } catch (error) { return mapAuthError(error); }
      finally { state.ready = true; state.busy = false; notify(); }
    }

    function init() {
      if (!initPromise) initPromise = initialize();
      return initPromise;
    }

    async function perform(operation, context) {
      await init();
      if (destroyed || state.configurationError) return failure('auth_unavailable');
      if (state.busy) return failure('busy');
      state.busy = true;
      notify();
      try { return await operation(); }
      catch (error) { return mapAuthError(error, context); }
      finally { state.busy = false; notify(); }
    }

    function signedIn() {
      if (!state.session || !state.user) throw { code: 'session_expired' };
    }

    function signIn(values) {
      return perform(async () => {
        const email = validEmail(values && values.email);
        const password = values && values.password;
        if (typeof password !== 'string' || !password.length) throw { code: 'password_required' };
        const { data, error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data || !data.session) throw { code: 'invalid_credentials' };
        clearRecovery();
        acceptSession(data.session);
        state.callback = { status: 'idle', type: null, message: '' };
        return success('Anda berjaya log masuk.');
      }, 'signin');
    }

    function signUp(values) {
      return perform(async () => {
        const email = validEmail(values && values.email);
        const password = newPassword(values && values.password);
        const name = typeof (values && values.name) === 'string' ? values.name.trim() : '';
        if (name.length > 80) throw { code: 'invalid_name' };
        const { data, error } = await auth.signUp({ email, password, options: { emailRedirectTo: redirectFor('signup'), data: name ? { display_name: name } : {} } });
        if (error && !['user_already_exists', 'email_exists'].includes(error.code)) throw error;
        if (!error && data && data.session) {
          clearRecovery();
          acceptSession(data.session);
          return success('Akaun anda sedia digunakan.', { confirmationRequired: false });
        }
        // Supabase may return an obfuscated user for an already registered email.
        // Do not expose identities, IDs or different messages for that response.
        return success(CONFIRMATION_MESSAGE, { confirmationRequired: true });
      }, 'email');
    }

    function requestPasswordReset(values) {
      return perform(async () => {
        const { error } = await auth.resetPasswordForEmail(validEmail(values && values.email), { redirectTo: redirectFor('recovery') });
        if (error && !['user_not_found', 'email_not_found'].includes(error.code)) throw error;
        return success(RESET_MESSAGE);
      }, 'email');
    }

    function resendConfirmation(values) {
      return perform(async () => {
        const { error } = await auth.resend({ type: 'signup', email: validEmail(values && values.email), options: { emailRedirectTo: redirectFor('signup') } });
        if (error && !['user_not_found', 'email_not_found', 'user_already_exists', 'email_exists', 'email_already_confirmed'].includes(error.code)) throw error;
        return success(CONFIRMATION_MESSAGE);
      }, 'email');
    }

    function signInWithMagicLink(values) {
      return perform(async () => {
        const { error } = await auth.signInWithOtp({ email: validEmail(values && values.email), options: { shouldCreateUser: false, emailRedirectTo: redirectFor('magiclink') } });
        if (error && !['user_not_found', 'email_not_found', 'signup_disabled'].includes(error.code)) throw error;
        return success(MAGIC_MESSAGE);
      }, 'email');
    }

    function verifyEmailOtp(values) {
      return perform(async () => {
        const type = values && values.type || 'email';
        const token = values && values.token;
        if (!EMAIL_FLOW_TYPES.has(type) || typeof token !== 'string' || !/^\d{6,10}$/.test(token.trim())) throw { code: 'invalid_otp' };
        const { data, error } = await auth.verifyOtp({ email: validEmail(values && values.email), token: token.trim(), type });
        if (error) throw error;
        if (data && data.session) {
          acceptSession(data.session);
          if (type === 'recovery' || type === 'invite') markRecovery(type);
          else clearRecovery();
        }
        return success(callbackMessage(type));
      });
    }

    function requestReauthentication() {
      return perform(async () => {
        signedIn();
        const { error } = await auth.reauthenticate();
        if (error) throw error;
        return success('Kod pengesahan semula dihantar ke e-mel akaun anda.');
      }, 'email');
    }

    function changePassword(values) {
      return perform(async () => {
        signedIn();
        const attributes = { password: newPassword(values && values.password) };
        if (!state.recovery) {
          if (!values || typeof values.currentPassword !== 'string' || !values.currentPassword.length) throw { code: 'current_password_required' };
          attributes.current_password = values.currentPassword;
        }
        if (values && typeof values.nonce === 'string' && values.nonce.trim()) attributes.nonce = values.nonce.trim();
        const { data, error } = await auth.updateUser(attributes);
        if (error) throw error;
        if (data && data.user) {
          state.user = data.user;
          state.session = { ...state.session, user: data.user };
        }
        clearRecovery();
        state.callback = { status: 'idle', type: null, message: '' };
        return success('Kata laluan anda telah dikemas kini.');
      });
    }

    function changeEmail(values) {
      return perform(async () => {
        signedIn();
        const email = validEmail(values && values.email);
        const { data, error } = await auth.updateUser({ email }, { emailRedirectTo: redirectFor('email_change') });
        if (error) throw error;
        if (data && data.user) {
          state.user = data.user;
          state.session = { ...state.session, user: data.user };
        }
        return success('Semak e-mel lama dan baharu anda. Sahkan pautan yang dihantar untuk melengkapkan pertukaran e-mel.');
      }, 'email');
    }

    function signOut() {
      return perform(async () => {
        // Avoid the SDK's global default, which revokes other device sessions.
        const { error } = await auth.signOut({ scope: 'local' });
        if (error) throw error;
        acceptSession(null);
        clearRecovery();
        state.callback = { status: 'idle', type: null, message: '' };
        return success('Anda telah log keluar pada pelayar ini.');
      });
    }

    function destroy() {
      destroyed = true;
      listeners.clear();
      if (notifyTimer !== null) clearTimeout(notifyTimer);
      if (subscription && typeof subscription.unsubscribe === 'function') subscription.unsubscribe();
    }

    return { init, getState, subscribe, signIn, signUp, requestPasswordReset, resendConfirmation, resendSignupConfirmation: resendConfirmation, signInWithMagicLink, verifyEmailOtp, requestReauthentication, changePassword, changeEmail, signOut, destroy };
  }

  root.InstruAuth = { createAuthService, mapAuthError, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH };
})(typeof globalThis !== 'undefined' ? globalThis : window);
