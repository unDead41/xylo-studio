/* e-Instru Studio Google and phone authentication. The base auth service owns
 * session callbacks; this service keeps only provider and challenge UI state.
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof define === 'function' && define.amd) define([], function () { return api; });
  root.InstruAuthProviders = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function (root) {
  'use strict';

  const MESSAGES = {
    providers_unavailable: 'Pilihan log masuk belum dapat dimuatkan. Cuba lagi sebentar.',
    provider_unavailable: 'Kaedah log masuk ini belum tersedia. Pilih kaedah lain.',
    invalid_redirect: 'Alamat kembali log masuk tidak sah. Hubungi pemilik aplikasi.',
    invalid_phone: 'Masukkan nombor telefon Malaysia bermula 01 atau nombor antarabangsa bermula +.',
    invalid_otp: 'Kod SMS tidak sah atau telah tamat tempoh. Masukkan enam digit atau minta kod baharu.',
    phone_challenge_missing: 'Minta kod SMS dahulu sebelum mengesahkan nombor telefon.',
    resend_cooldown: 'Tunggu sebelum meminta kod SMS baharu.',
    busy: 'Permintaan sedang diproses. Tunggu sebentar.',
    cancelled: 'Permintaan ini telah dibatalkan.',
    session_missing: 'Log masuk belum disahkan. Minta kod SMS baharu dan cuba lagi.',
    network_error: 'Sambungan tidak berjaya. Semak internet anda dan cuba lagi.',
    rate_limited: 'Terlalu banyak permintaan. Tunggu sebentar sebelum mencuba lagi.',
    sms_delivery_unavailable: 'SMS tidak dapat dihantar sekarang. Cuba lagi kemudian atau pilih e-mel.',
    captcha_failed: 'Pengesahan keselamatan tidak berjaya. Cuba lagi.',
    auth_error: 'Log masuk tidak berjaya. Cuba lagi atau pilih kaedah lain.'
  };

  function errorMessage(error) {
    const code = typeof error === 'string' ? error : error && error.code;
    return Object.prototype.hasOwnProperty.call(MESSAGES, code) ? MESSAGES[code] : MESSAGES.auth_error;
  }

  function safeError(error, context) {
    let code = typeof error === 'string' ? error : error && error.code;
    if (!Object.prototype.hasOwnProperty.call(MESSAGES, code)) {
      if (error && (error.status === 429 || ['over_request_rate_limit', 'over_sms_send_rate_limit'].includes(code))) code = 'rate_limited';
      else if (['provider_disabled', 'provider_not_enabled', 'oauth_provider_not_supported', 'phone_provider_disabled', 'otp_disabled', 'signup_disabled'].includes(code)) code = 'provider_unavailable';
      else if (['sms_send_failed', 'sms_provider_not_configured', 'sms_provider_unavailable'].includes(code)) code = 'sms_delivery_unavailable';
      else if (context === 'verify' && ['otp_expired', 'invalid_token', 'otp_invalid', 'validation_failed'].includes(code)) code = 'invalid_otp';
      else if (['phone_number_invalid', 'phone_number_not_supported', 'sms_invalid_phone_number'].includes(code)) code = 'invalid_phone';
      else if (error && (['AuthRetryableFetchError', 'TypeError'].includes(error.name) || error.status === 0 || error.status >= 500)) code = 'network_error';
      else code = 'auth_error';
    }
    return { code, message: errorMessage(code) };
  }

  function normalizePhone(value) {
    if (typeof value !== 'string') return null;
    const input = value.trim();
    if (!input || !/^[+\d\s()-]+$/.test(input)) return null;
    const compact = input.replace(/[\s()-]/g, '');
    if (/^01\d{8,9}$/.test(compact)) return '+60' + compact.slice(1);
    return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
  }

  function disabledProviders() {
    return { google: false, email: false, phone: false };
  }

  function validateRedirect(redirectTo, pageLocation) {
    try {
      const source = typeof pageLocation === 'string' ? pageLocation : pageLocation && (pageLocation.href || pageLocation.origin);
      const page = new URL(source);
      const target = new URL(redirectTo || page.href, page.href);
      const loopback = target.hostname === 'localhost' || target.hostname.endsWith('.localhost') || /^127(?:\.\d{1,3}){3}$/.test(target.hostname) || target.hostname === '[::1]';
      if (target.origin !== page.origin || target.username || target.password ||
          (target.protocol !== 'https:' && !(target.protocol === 'http:' && loopback))) return null;
      return target.href;
    } catch (_) { return null; }
  }

  function createProviderService(options) {
    options = options || {};
    const auth = options.client && options.client.auth;
    const redirectTo = validateRedirect(options.redirectTo, options.location || root.location);
    const clock = typeof options.now === 'function' ? options.now : Date.now;
    const cooldownMs = typeof options.cooldownMs === 'number' && Number.isFinite(options.cooldownMs) && options.cooldownMs >= 0 ? options.cooldownMs : 60000;
    const listeners = new Set();
    const state = {
      providers: disabledProviders(), providersLoaded: false,
      busy: false, phase: 'idle', phone: '', resendAt: 0, error: null
    };
    let refreshInFlight = null;
    let phoneGeneration = 0;
    let lastSendUntil = 0;

    function getState() {
      return { ...state, providers: { ...state.providers }, error: state.error ? { ...state.error } : null };
    }

    function notify() {
      for (const listener of listeners) {
        try { listener(getState()); } catch (_) { /* A view failure must not interrupt auth. */ }
      }
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') return function () {};
      listeners.add(listener);
      try { listener(getState()); } catch (_) { /* Match normal notification isolation. */ }
      return function () { listeners.delete(listener); };
    }

    function failure(error, context, updateState) {
      const mapped = safeError(error, context);
      if (updateState !== false) {
        state.error = mapped;
        notify();
      }
      return { data: null, error: mapped };
    }

    function currentTime() {
      const value = clock();
      return typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
    }

    function isBusy() {
      return state.busy || ['sending', 'verifying', 'redirecting'].includes(state.phase);
    }

    function providerReady(provider, method) {
      return state.providersLoaded && state.providers[provider] === true && auth && typeof auth[method] === 'function';
    }

    function refreshProviders() {
      if (refreshInFlight) return refreshInFlight;
      state.providersLoaded = false;
      state.providers = disabledProviders();
      state.error = null;
      refreshInFlight = Promise.resolve().then(function () {
        if (typeof options.fetchSettings !== 'function') throw new Error();
        return options.fetchSettings();
      }).then(function (settings) {
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error();
        const external = settings.external && typeof settings.external === 'object' ? settings.external : {};
        state.providers = {
          google: external.google === true,
          email: external.email === true,
          phone: external.phone === true
        };
        state.providersLoaded = true;
        state.error = null;
        notify();
        return { data: { ...state.providers }, error: null };
      }).catch(function () {
        state.providers = disabledProviders();
        state.providersLoaded = false;
        return failure('providers_unavailable');
      }).finally(function () { refreshInFlight = null; });
      notify();
      return refreshInFlight;
    }

    async function startGoogle() {
      if (isBusy()) return failure('busy', null, false);
      if (!providerReady('google', 'signInWithOAuth')) return failure('provider_unavailable');
      if (!redirectTo) return failure('invalid_redirect');
      ++phoneGeneration;
      state.phone = '';
      state.resendAt = lastSendUntil;
      state.error = null;
      state.phase = 'redirecting';
      state.busy = true;
      notify();
      try {
        const result = await auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, queryParams: { prompt: 'select_account' } }
        });
        if (!result || typeof result !== 'object') throw { code: 'auth_error' };
        if (result.error) throw result.error;
        if (!result.data || typeof result.data.url !== 'string' || !result.data.url.trim()) throw { code: 'auth_error' };
        return { data: result.data, error: null };
      } catch (error) {
        state.phase = 'idle';
        return failure(error);
      } finally {
        state.busy = false;
        notify();
      }
    }

    async function sendPhoneCode(value, sendOptions) {
      if (isBusy()) return failure('busy', null, false);
      if (!providerReady('phone', 'signInWithOtp')) return failure('provider_unavailable');
      const phone = normalizePhone(value);
      if (!phone) return failure('invalid_phone');
      if (lastSendUntil > currentTime()) {
        state.resendAt = lastSendUntil;
        return failure('resend_cooldown');
      }
      const generation = ++phoneGeneration;
      const otpOptions = { channel: 'sms', shouldCreateUser: true };
      if (sendOptions && typeof sendOptions.captchaToken === 'string' && sendOptions.captchaToken.trim()) otpOptions.captchaToken = sendOptions.captchaToken;
      state.phase = 'sending';
      state.error = null;
      state.busy = true;
      notify();
      try {
        if (generation !== phoneGeneration) return failure('cancelled', null, false);
        const result = await auth.signInWithOtp({ phone, options: otpOptions });
        // Cancellation cannot undo an SMS already sent by the provider.
        if (result && typeof result === 'object' && !result.error) {
          lastSendUntil = currentTime() + cooldownMs;
          state.resendAt = lastSendUntil;
        }
        if (generation !== phoneGeneration) return failure('cancelled', null, false);
        if (!result || typeof result !== 'object') throw { code: 'auth_error' };
        if (result.error) throw result.error;
        state.phone = phone;
        state.phase = 'code';
        state.error = null;
        notify();
        return { data: { phone }, error: null };
      } catch (error) {
        if (generation !== phoneGeneration) return failure('cancelled', null, false);
        state.phase = state.phone ? 'code' : 'idle';
        return failure(error, 'send');
      } finally {
        state.busy = false;
        notify();
      }
    }

    async function verifyPhoneCode(value) {
      if (isBusy()) return failure('busy', null, false);
      if (!providerReady('phone', 'verifyOtp')) return failure('provider_unavailable');
      if (!state.phone) return failure('phone_challenge_missing');
      const token = typeof value === 'string' ? value.trim() : '';
      if (!/^\d{6}$/.test(token)) return failure('invalid_otp');
      const generation = ++phoneGeneration;
      const phone = state.phone;
      state.phase = 'verifying';
      state.error = null;
      state.busy = true;
      notify();
      try {
        if (generation !== phoneGeneration) return failure('cancelled', null, false);
        const result = await auth.verifyOtp({ phone, token, type: 'sms' });
        if (generation !== phoneGeneration) return failure('cancelled', null, false);
        if (!result || typeof result !== 'object') throw { code: 'auth_error' };
        if (result.error) throw result.error;
        const session = result.data && result.data.session;
        if (!session || typeof session !== 'object' || Array.isArray(session) ||
            typeof session.access_token !== 'string' || !session.access_token.trim() ||
            !session.user || typeof session.user.id !== 'string' || !session.user.id.trim()) throw { code: 'session_missing' };
        state.phone = '';
        state.resendAt = 0;
        state.phase = 'idle';
        state.error = null;
        notify();
        return { data: result.data, error: null };
      } catch (error) {
        if (generation !== phoneGeneration) return failure('cancelled', null, false);
        state.phase = 'code';
        return failure(error, 'verify');
      } finally {
        state.busy = false;
        notify();
      }
    }

    function cancelPhone() {
      ++phoneGeneration;
      state.phone = '';
      state.resendAt = lastSendUntil;
      state.error = null;
      if (state.phase !== 'redirecting') state.phase = 'idle';
      notify();
      return { data: null, error: null };
    }

    function resetRedirect() {
      if (state.phase === 'redirecting') {
        state.phase = 'idle';
        state.error = null;
        notify();
      }
      return { data: null, error: null };
    }

    return { getState, subscribe, refreshProviders, startGoogle, sendPhoneCode, verifyPhoneCode, cancelPhone, resetRedirect };
  }

  return { createProviderService, normalizePhone, errorMessage };
});
