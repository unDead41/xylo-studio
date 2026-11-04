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
  function pauseStudio() {
    root.XyloStudioBridge?.pauseForAccount();
    root.XyloGameBridge?.pauseForAccount();
    root.TamborinStudio?.pauseForAccount();
    root.KompangStudio?.pauseForAccount();
    for (const item of Object.values(root.SchoolBandStudios || {})) item.studio.pauseForAccount();
  }
  const ui = root.InstruAuthUI.createAuthUI({
    onSubmit(action, values) {
      const allowed = ['signIn', 'signUp', 'requestPasswordReset', 'resendConfirmation',
        'signInWithMagicLink', 'changePassword', 'changeEmail'];
      if (!allowed.includes(action)) return { ok: false, message: 'Tindakan akaun tidak tersedia.' };
      return service[action](values);
    },
    onSignOut: () => service.signOut(),
    onSendReauthCode: () => service.requestReauthentication(),
    onOpen: pauseStudio
  });
  ui.mount();
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
    ui.setState(state);
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
