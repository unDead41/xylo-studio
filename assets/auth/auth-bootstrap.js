/* Account integration is optional; all instrument data stays in local storage. */
(function (root) {
  'use strict';
  const config = root.InstruAuthConfig;
  let client = null;
  try {
    if (config && root.supabase && /^https?:$/.test(root.location.protocol)) {
      client = root.supabase.createClient(config.url, config.publishableKey, {
        auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true,
          autoRefreshToken: true, storageKey: config.storageKey }
      });
    }
  } catch (_) { /* The guest studio remains usable if account storage fails. */ }
  const service = root.InstruAuth.createAuthService({ client, redirectTo: config && config.redirectTo });
  let providers = null;
  let providerUI = null;
  let providerBusy = false;
  const providerIsBusy = () => {
    const state = providers && providers.getState();
    return Boolean(state && (state.busy || ['sending', 'verifying', 'redirecting'].includes(state.phase)));
  };
  function pauseStudio() {
    root.XyloStudioBridge?.pauseForAccount();
    root.XyloGameBridge?.pauseForAccount();
    root.TamborinStudio?.pauseForAccount();
    root.KompangStudio?.pauseForAccount();
    for (const item of Object.values(root.SchoolBandStudios || {})) item.studio.pauseForAccount();
  }
  const ui = root.InstruAuthUI.createAuthUI({
    onSubmit(action, values) {
      if (providerIsBusy()) return { ok: false, message: 'Permintaan log masuk sedang diproses. Tunggu sebentar.' };
      const allowed = ['signIn', 'signUp', 'requestPasswordReset', 'resendConfirmation',
        'signInWithMagicLink', 'changePassword', 'changeEmail'];
      if (!allowed.includes(action)) return { ok: false, message: 'Tindakan akaun tidak tersedia.' };
      return service[action](values);
    },
    onSignOut: () => providerIsBusy() ? { ok: false, message: 'Tunggu permintaan semasa selesai.' } : service.signOut(),
    onSendReauthCode: () => providerIsBusy() ? { ok: false, message: 'Tunggu permintaan semasa selesai.' } : service.requestReauthentication(),
    onOpen() {
      pauseStudio();
      if (providerUI && !providerIsBusy()) void providerUI.refresh();
    },
    onDismiss() {
      providers?.cancelPhone();
      providerUI?.reset();
    }
  });
  ui.mount();
  if (root.InstruAuthProviders && root.InstruAuthProviderUI) {
    const providerAuth = {};
    for (const method of ['signInWithOAuth', 'signInWithOtp', 'verifyOtp']) {
      providerAuth[method] = args => {
        const state = service.getState();
        if (!state.ready || state.busy) return Promise.resolve({ data: null, error: { code: 'busy' } });
        if (!client || state.user) return Promise.resolve({ data: null, error: { code: 'provider_unavailable' } });
        return client.auth[method](args);
      };
    }
    providers = root.InstruAuthProviders.createProviderService({
      client: { auth: providerAuth }, redirectTo: config && config.redirectTo,
      location: root.location,
      async fetchSettings() {
        if (!config || config.projectRef !== 'ahvyieyojqciohdogsqc' || config.url !== 'https://ahvyieyojqciohdogsqc.supabase.co' || !config.publishableKey.startsWith('sb_publishable_')) throw new Error('Unavailable');
        const response = await root.fetch(config.url + '/auth/v1/settings', {
          method: 'GET', headers: { apikey: config.publishableKey, Accept: 'application/json' },
          credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error('Unavailable');
        return response.json();
      }
    });
    providerUI = root.InstruAuthProviderUI.mount({
      root: ui.getProviderRoot(), service: providers,
      onAuthenticated() { providerUI.reset(); }
    });
    providers.subscribe(state => {
      providerBusy = Boolean(state.busy || ['sending', 'verifying', 'redirecting'].includes(state.phase));
      ui.setState({ ...service.getState(), providerBusy });
    });
    root.addEventListener('pageshow', event => {
      if (event.persisted) {
        providers.resetRedirect();
        void providerUI.refresh();
      }
    });
  }
  let profileUser = null;
  let profileGeneration = 0;
  let profilePending = false;
  let profileComplete = false;
  let profileRetryAt = 0;
  async function ensureProfile(user, generation) {
    try {
      const { data, error } = await client.from('profiles').select('id').eq('id', user.id).maybeSingle();
      if (generation !== profileGeneration) return;
      if (error) throw error;
      if (!data) {
        const rawName = user.user_metadata && user.user_metadata.display_name;
        const displayName = typeof rawName === 'string' ? Array.from(rawName.trim()).slice(0, 80).join('') : '';
        // RLS checks this ID on both reads and inserts; no privileged key is used.
        const inserted = await client.from('profiles').insert({ id: user.id, display_name: displayName });
        if (inserted?.error && inserted.error.code !== '23505') throw inserted.error;
      }
      if (generation === profileGeneration) profileComplete = true;
    } catch (_) {
      // Retry on a later auth event after a bounded delay, without blocking music.
      if (generation === profileGeneration) profileRetryAt = Date.now() + 60000;
    } finally {
      if (generation === profileGeneration) profilePending = false;
    }
  }
  service.subscribe(state => {
    ui.setState({ ...state, providerBusy });
    providerUI?.setDisabled(!state.ready || state.busy || Boolean(state.configurationError) || Boolean(state.user));
    if (!state.ready) return;
    const userId = state.user && state.user.id || null;
    if (userId !== profileUser) {
      profileUser = userId;
      profileGeneration++;
      profilePending = false;
      profileComplete = false;
      profileRetryAt = 0;
    }
    if (client && userId && !profilePending && !profileComplete && Date.now() >= profileRetryAt) {
      profilePending = true;
      void ensureProfile(state.user, profileGeneration);
    }
  });
  void service.init();
})(window);
