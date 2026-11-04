const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, serviceFactory, user, session, deferred, settle } = require('./helpers.cjs');

const apiError = (code, message = code, status = 400) => ({ name: 'AuthApiError', code, message, status });
const noCredentials = url => {
  const parsed = new URL(url);
  for (const key of ['code', 'token_hash', 'access_token', 'refresh_token', 'error', 'error_code', 'error_description']) {
    assert.equal(parsed.searchParams.has(key), false, 'query retained ' + key);
    assert.equal(new URLSearchParams(parsed.hash.slice(1)).has(key), false, 'fragment retained ' + key);
  }
};

test('a link opened without its PKCE verifier explains the same-browser requirement for the pinned SDK', async () => {
  const { auth } = harness({
    href: 'https://example.invalid/xylo-studio/?code=one-use-code&auth_flow=recovery',
    responses: { exchangeCodeForSession: { data: { session: null }, error: {
      name: 'AuthPKCECodeVerifierMissingError', code: 'pkce_code_verifier_not_found', status: 400
    } } }
  });
  await auth.init();
  assert.equal(auth.getState().callback.errorCode, 'pkce_verifier_missing');
  assert.match(auth.getState().callback.message, /pelayar/);
  assert.equal(auth.getState().recovery, false);
  auth.destroy();
});

test('missing auth configuration becomes a ready error state without blocking the guest app', async () => {
  const { createAuthService } = serviceFactory();
  const auth = createAuthService({ client: null });
  await auth.init();
  assert.equal(auth.getState().ready, true);
  assert.equal(auth.getState().user, null);
  assert.ok(auth.getState().configurationError);
  assert.equal((await auth.signIn({ email: 'guest@example.invalid', password: 'password1' })).ok, false);
  auth.destroy();
});

test('init restores an existing session and emits the final ready user state', async () => {
  const restoredSession = session();
  const { auth, fake } = harness({ restoredSession });
  const seen = [];
  const unsubscribe = auth.subscribe(state => seen.push(state));
  await auth.init();
  assert.equal(auth.getState().ready, true);
  assert.equal(auth.getState().user.id, restoredSession.user.id);
  assert.equal(auth.getState().recovery, false);
  assert.equal(fake.count('getSession'), 1);
  assert.ok(seen.some(state => state.ready && state.user?.id === restoredSession.user.id));
  unsubscribe();
  auth.destroy();
});

test('auth state changes restore and remove account state without a reload', async () => {
  const { auth, fake } = harness();
  await auth.init();
  await fake.emit('SIGNED_IN', session());
  assert.equal(auth.getState().user.email, user().email);
  await fake.emit('SIGNED_OUT', null);
  assert.equal(auth.getState().session, null);
  assert.equal(auth.getState().user, null);
  assert.equal(auth.getState().recovery, false);
  auth.destroy();
  assert.equal(fake.listenerCount(), 0);
});

test('sign-in trims email and forwards the exact password, then reflects the authenticated user', async () => {
  const { auth, fake } = harness();
  await auth.init();
  const result = await auth.signIn({ email: '  MUSICIAN@example.invalid ', password: ' password with spaces ' });
  assert.equal(result.ok, true);
  assert.equal(fake.last('signInWithPassword').args[0].email, 'MUSICIAN@example.invalid');
  assert.equal(fake.last('signInWithPassword').args[0].password, ' password with spaces ');
  assert.equal(auth.getState().user.id, user().id);
  auth.destroy();
});

test('sign-in errors are usable messages without exposing backend internals', async () => {
  const { auth } = harness({ responses: { signInWithPassword: { data: { session: null, user: null }, error: apiError('invalid_credentials', 'Internal database password check failed') } } });
  await auth.init();
  const result = await auth.signIn({ email: 'musician@example.invalid', password: 'wrong' });
  assert.equal(result.ok, false);
  assert.ok(result.message);
  assert.doesNotMatch(result.message, /Internal database|password check failed/);
  assert.equal(auth.getState().user, null);
  assert.equal(auth.getState().busy, false);
  auth.destroy();
});

test('unknown, banned, unconfirmed, and incorrect-password sign-ins share a neutral failure', async () => {
  const messages = [];
  const codes = [];
  for (const code of ['invalid_credentials', 'email_not_confirmed', 'user_not_found', 'user_banned', 'invalid_login_credentials']) {
    const { auth } = harness({ responses: { signInWithPassword: { data: { session: null, user: null }, error: apiError(code, 'Private backend details') } } });
    await auth.init();
    const result = await auth.signIn({ email: 'musician@example.invalid', password: 'password1' });
    assert.equal(result.ok, false);
    messages.push(result.message);
    codes.push(result.errorCode);
    auth.destroy();
  }
  assert.equal(new Set(messages).size, 1);
  assert.equal(new Set(codes).size, 1);
});

test('invalid email and absent password are rejected before any sign-in request', async () => {
  const { auth, fake } = harness();
  await auth.init();
  for (const values of [{ email: 'not-an-email', password: 'password1' }, { email: 'musician@example.invalid', password: '' }]) {
    assert.equal((await auth.signIn(values)).ok, false);
  }
  assert.equal(fake.count('signInWithPassword'), 0);
  auth.destroy();
});

test('pending operations reject duplicate submission and always release busy state', async () => {
  const pending = deferred();
  const { auth, fake } = harness({ responses: { signInWithPassword: pending.promise } });
  await auth.init();
  const first = auth.signIn({ email: 'musician@example.invalid', password: 'password1' });
  await settle();
  assert.ok(auth.getState().busy);
  const second = await auth.signIn({ email: 'musician@example.invalid', password: 'password1' });
  assert.equal(second.ok, false);
  assert.equal(fake.count('signInWithPassword'), 1);
  pending.resolve({ data: { user: user(), session: session() }, error: null });
  assert.equal((await first).ok, true);
  assert.equal(auth.getState().busy, false);
  auth.destroy();
});

test('a rejected transport operation releases busy and allows retry', async () => {
  let attempts = 0;
  const { auth } = harness({ responses: { signInWithPassword: async () => {
    if (++attempts === 1) throw new TypeError('Failed to fetch');
    return { data: { user: user(), session: session() }, error: null };
  } } });
  await auth.init();
  assert.equal((await auth.signIn({ email: 'musician@example.invalid', password: 'password1' })).ok, false);
  assert.equal(auth.getState().busy, false);
  assert.equal((await auth.signIn({ email: 'musician@example.invalid', password: 'password1' })).ok, true);
  auth.destroy();
});

test('signup confirmation and existing-account outcomes use the same neutral public result', async () => {
  const variants = [
    { data: { user: user({ email_confirmed_at: null }), session: null }, error: null },
    { data: { user: user({ identities: [] }), session: null }, error: null },
    { data: { user: null, session: null }, error: apiError('user_already_exists', 'User already registered') },
    { data: { user: null, session: null }, error: apiError('email_exists', 'User already registered') },
  ];
  const messages = [];
  for (const response of variants) {
    const { auth, fake } = harness({ responses: { signUp: response } });
    await auth.init();
    const result = await auth.signUp({ name: 'Musician', email: 'musician@example.invalid', password: 'password1' });
    assert.equal(result.ok, true);
    assert.equal(auth.getState().user, null);
    assert.equal(auth.getState().session, null);
    assert.ok(result.message);
    assert.doesNotMatch(result.message, /already registered|account exists|telah berdaftar|sudah berdaftar/i);
    assert.equal(fake.count('signUp'), 1);
    messages.push(result.message);
    auth.destroy();
  }
  assert.equal(new Set(messages).size, 1);
});

test('signup validates bounded passwords before contacting Supabase', async () => {
  const { auth, fake } = harness();
  await auth.init();
  for (const password of ['', '1234567', 'a'.repeat(129)]) {
    assert.equal((await auth.signUp({ name: 'Musician', email: 'musician@example.invalid', password })).ok, false);
  }
  assert.equal(fake.count('signUp'), 0);
  for (const password of ['12345678', 'a'.repeat(128)]) {
    assert.equal((await auth.signUp({ name: 'Musician', email: 'musician@example.invalid', password })).ok, true);
  }
  assert.equal(fake.count('signUp'), 2);
  auth.destroy();
});

test('password reset requests use an allowed callback and keep existence private', async () => {
  const { auth, fake } = harness();
  await auth.init();
  const result = await auth.requestPasswordReset({ email: '  MUSICIAN@example.invalid ' });
  assert.equal(result.ok, true);
  const request = fake.last('resetPasswordForEmail');
  assert.equal(request.args[0], 'MUSICIAN@example.invalid');
  const callback = new URL(request.args[1].redirectTo);
  assert.equal(callback.origin, 'https://example.invalid');
  assert.equal(callback.pathname, '/xylo-studio/');
  assert.equal(callback.searchParams.get('auth_flow'), 'recovery');
  assert.equal(auth.getState().user, null);
  assert.ok(result.message);
  assert.doesNotMatch(result.message, /account does not exist|not registered|tidak berdaftar/i);
  auth.destroy();
});

test('missing-account reset requests return the same result as existing-account requests', async () => {
  const results = [];
  for (const error of [null, apiError('user_not_found'), apiError('email_not_found')]) {
    const { auth } = harness({ responses: { resetPasswordForEmail: { data: {}, error } } });
    await auth.init();
    const result = await auth.requestPasswordReset({ email: 'musician@example.invalid' });
    assert.equal(result.ok, true);
    results.push(result.message);
    auth.destroy();
  }
  assert.equal(new Set(results).size, 1);
});

test('magic-link sign-in cannot silently create a new account', async () => {
  const { auth, fake } = harness();
  await auth.init();
  assert.equal((await auth.signInWithMagicLink({ email: 'musician@example.invalid' })).ok, true);
  assert.equal(fake.last('signInWithOtp').args[0].options.shouldCreateUser, false);
  assert.equal(new URL(fake.last('signInWithOtp').args[0].options.emailRedirectTo).searchParams.get('auth_flow'), 'magiclink');
  assert.equal(auth.getState().user, null);
  auth.destroy();
});

test('resending signup confirmation remains neutral and does not sign in', async () => {
  const { auth, fake } = harness();
  await auth.init();
  const result = await auth.resendConfirmation({ email: 'musician@example.invalid' });
  assert.equal(result.ok, true);
  assert.equal(fake.last('resend').args[0].type, 'signup');
  assert.equal(fake.last('resend').args[0].email, 'musician@example.invalid');
  assert.equal(auth.getState().user, null);
  auth.destroy();
});

test('a normal password change sends the exact current password for backend validation', async () => {
  const { auth, fake } = harness({ restoredSession: session() });
  await auth.init();
  const result = await auth.changePassword({ currentPassword: ' old ', password: 'new-password1' });
  assert.equal(result.ok, true);
  const attrs = fake.last('updateUser').args[0];
  assert.equal(attrs.current_password, ' old ');
  assert.equal(attrs.password, 'new-password1');
  assert.equal(fake.count('signInWithPassword'), 0, 'password change should not replace the current session by signing in');
  auth.destroy();
});

test('normal password change requires a signed-in user, current password, and valid new password', async () => {
  const guest = harness();
  await guest.auth.init();
  assert.equal((await guest.auth.changePassword({ currentPassword: 'old', password: 'new-password1' })).ok, false);
  assert.equal(guest.fake.count('updateUser'), 0);
  guest.auth.destroy();
  const { auth, fake } = harness({ restoredSession: session() });
  await auth.init();
  for (const values of [
    { currentPassword: '', password: 'new-password1' },
    { currentPassword: 'old', password: 'short' },
    { currentPassword: 'old', password: 'x'.repeat(129) },
  ]) assert.equal((await auth.changePassword(values)).ok, false);
  assert.equal(fake.count('updateUser'), 0);
  auth.destroy();
});

test('incorrect current password fails without changing or removing the existing session', async () => {
  const restoredSession = session();
  const { auth, fake } = harness({ restoredSession, responses: { updateUser: { data: { user: null }, error: apiError('invalid_credentials', 'Current password is incorrect') } } });
  await auth.init();
  const result = await auth.changePassword({ currentPassword: 'wrong', password: 'new-password1' });
  assert.equal(result.ok, false);
  assert.equal(auth.getState().user.id, restoredSession.user.id);
  assert.equal(auth.getState().busy, false);
  assert.equal(fake.count('updateUser'), 1);
  auth.destroy();
});

test('nonce reauthentication is explicit and forwarded with a password change', async () => {
  const { auth, fake } = harness({ restoredSession: session() });
  await auth.init();
  assert.equal((await auth.requestReauthentication()).ok, true);
  assert.equal(fake.count('reauthenticate'), 1);
  assert.equal((await auth.changePassword({ currentPassword: 'old', password: 'new-password1', nonce: '123456' })).ok, true);
  assert.equal(fake.last('updateUser').args[0].nonce, '123456');
  auth.destroy();
});

test('a recovery PKCE callback exchanges once, clears auth URL fields, and allows a new password', async () => {
  const { auth, fake, location, history } = harness({ href: 'https://example.invalid/xylo-studio/?keep=yes&code=one-use-code&auth_flow=recovery#workspace' });
  await auth.init();
  assert.equal(fake.count('exchangeCodeForSession'), 1);
  assert.equal(fake.last('exchangeCodeForSession').args[0], 'one-use-code');
  assert.equal(auth.getState().recovery, true);
  assert.equal(auth.getState().callback.status, 'success');
  noCredentials(location.href);
  assert.equal(location.searchParams.get('keep'), 'yes');
  assert.equal(location.hash, '#workspace');
  assert.ok(history.calls.length);
  assert.equal((await auth.changePassword({ password: 'new-password1' })).ok, true);
  assert.equal(fake.last('updateUser').args[0].password, 'new-password1');
  assert.equal(Object.hasOwn(fake.last('updateUser').args[0], 'current_password'), false);
  assert.equal(auth.getState().recovery, false);
  auth.destroy();
});

test('an expired PKCE callback fails closed and removes the one-use code from the URL', async () => {
  const { auth, fake, location } = harness({
    href: 'https://example.invalid/xylo-studio/?keep=yes&code=expired-code&auth_flow=recovery',
    responses: { exchangeCodeForSession: { data: { session: null, user: null }, error: apiError('otp_expired', 'Token has expired or is invalid') } },
  });
  await auth.init();
  assert.equal(auth.getState().ready, true);
  assert.equal(auth.getState().user, null);
  assert.equal(auth.getState().recovery, false);
  assert.equal(auth.getState().callback.status, 'error');
  noCredentials(location.href);
  assert.equal(location.searchParams.get('keep'), 'yes');
  assert.equal((await auth.changePassword({ password: 'new-password1' })).ok, false);
  assert.equal(fake.count('updateUser'), 0);
  auth.destroy();
});

test('the trusted exchange redirect type identifies recovery without a caller-controlled flow marker', async () => {
  const { auth } = harness({ href: 'https://example.invalid/xylo-studio/?code=recovery-code' });
  await auth.init();
  assert.equal(auth.getState().recovery, true);
  auth.destroy();
});

test('a signup callback creates a normal session instead of password recovery', async () => {
  const { auth, fake } = harness({
    href: 'https://example.invalid/xylo-studio/?code=confirmation-code',
    responses: { exchangeCodeForSession: { data: { session: session(), user: user(), redirectType: 'signup' }, error: null } },
  });
  await auth.init();
  assert.equal(auth.getState().callback.status, 'success');
  assert.equal(auth.getState().user.id, user().id);
  assert.equal(auth.getState().recovery, false);
  assert.equal((await auth.changePassword({ password: 'new-password1' })).ok, false);
  assert.equal(fake.count('updateUser'), 0);
  auth.destroy();
});

test('a caller-controlled recovery marker cannot override the SDK signup redirect type', async () => {
  const { auth, fake } = harness({
    href: 'https://example.invalid/xylo-studio/?code=confirmation-code&auth_flow=recovery',
    responses: { exchangeCodeForSession: { data: { session: session(), user: user(), redirectType: 'signup' }, error: null } },
  });
  await auth.init();
  assert.equal(auth.getState().recovery, false);
  assert.equal((await auth.changePassword({ password: 'new-password1' })).ok, false);
  assert.equal(fake.count('updateUser'), 0);
  auth.destroy();
});

test('a flow marker alone never upgrades an existing normal session into recovery', async () => {
  const { auth, fake } = harness({ restoredSession: session(), href: 'https://example.invalid/xylo-studio/?auth_flow=recovery' });
  await auth.init();
  assert.equal(auth.getState().recovery, false);
  assert.equal((await auth.changePassword({ password: 'new-password1' })).ok, false);
  assert.equal(fake.count('updateUser'), 0);
  auth.destroy();
});

for (const type of ['recovery', 'invite']) test(type + ' token-hash callback verifies the OTP before enabling password setup', async () => {
  const { auth, fake, location } = harness({ href: 'https://example.invalid/xylo-studio/?keep=yes&token_hash=one-use-token&type=' + type });
  await auth.init();
  assert.equal(fake.count('verifyOtp'), 1);
  assert.equal(fake.last('verifyOtp').args[0].token_hash, 'one-use-token');
  assert.equal(fake.last('verifyOtp').args[0].type, type);
  assert.equal(auth.getState().recovery, true);
  assert.equal(auth.getState().callback.status, 'success');
  noCredentials(location.href);
  assert.equal((await auth.changePassword({ password: 'new-password1' })).ok, true);
  assert.equal(Object.hasOwn(fake.last('updateUser').args[0], 'current_password'), false);
  auth.destroy();
});

for (const suffix of [
  '?code=',
  '?token_hash=one-use-token&type=unknown',
  '?token_hash=one-use-token',
  '?code=mixed&token_hash=ambiguous&type=recovery',
  '#access_token=partial&type=recovery',
  '#refresh_token=partial&type=recovery',
  '#access_token=access&refresh_token=refresh&type=unknown',
]) test('malformed callback fails closed: ' + suffix, async () => {
  const { auth, fake, location } = harness({ href: 'https://example.invalid/xylo-studio/' + suffix });
  await auth.init();
  assert.equal(auth.getState().user, null);
  assert.equal(auth.getState().recovery, false);
  assert.equal(auth.getState().callback.status, 'error');
  assert.equal(fake.count('verifyOtp'), 0);
  assert.equal(fake.count('setSession'), 0);
  noCredentials(location.href);
  auth.destroy();
});

test('an implicit invite callback adopts the session and removes both tokens from the URL', async () => {
  const { auth, fake, location } = harness({ href: 'https://example.invalid/xylo-studio/?keep=yes#access_token=invite-access&refresh_token=invite-refresh&type=invite&expires_in=3600&token_type=bearer' });
  await auth.init();
  assert.equal(fake.count('setSession'), 1);
  assert.equal(fake.last('setSession').args[0].access_token, 'invite-access');
  assert.equal(fake.last('setSession').args[0].refresh_token, 'invite-refresh');
  assert.equal(auth.getState().recovery, true);
  noCredentials(location.href);
  assert.equal(location.searchParams.get('keep'), 'yes');
  auth.destroy();
});

test('a provider error callback is readable, cannot enable password setup, and is scrubbed', async () => {
  const { auth, fake, location } = harness({ href: 'https://example.invalid/xylo-studio/?keep=yes#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&type=recovery' });
  await auth.init();
  assert.equal(auth.getState().callback.status, 'error');
  assert.ok(auth.getState().callback.message);
  assert.equal(auth.getState().recovery, false);
  assert.equal(fake.count('exchangeCodeForSession'), 0);
  assert.equal(fake.count('setSession'), 0);
  noCredentials(location.href);
  auth.destroy();
});

test('a callback failure does not turn an already signed-in account into recovery', async () => {
  const restoredSession = session();
  const { auth } = harness({
    restoredSession,
    href: 'https://example.invalid/xylo-studio/?code=bad-code&auth_flow=recovery',
    responses: { exchangeCodeForSession: { data: { session: null, user: null }, error: apiError('flow_state_not_found') } },
  });
  await auth.init();
  assert.equal(auth.getState().recovery, false);
  assert.equal(auth.getState().callback.status, 'error');
  assert.equal(auth.getState().user.id, restoredSession.user.id);
  auth.destroy();
});

test('a recovery session restores after a same-session reload but cannot transfer recovery to another account', async () => {
  const first = harness({ href: 'https://example.invalid/xylo-studio/?code=recovery-code&auth_flow=recovery' });
  await first.auth.init();
  assert.equal(first.auth.getState().recovery, true);
  const stored = Object.fromEntries(first.values);
  const recoveredSession = first.auth.getState().session;
  first.auth.destroy();
  const reloaded = harness({ restoredSession: recoveredSession, storage: stored });
  await reloaded.auth.init();
  assert.equal(reloaded.auth.getState().recovery, true);
  await reloaded.fake.emit('SIGNED_IN', session({ user: user({ id: '22222222-2222-4222-8222-222222222222', email: 'other@example.invalid' }) }));
  assert.equal(reloaded.auth.getState().recovery, false);
  reloaded.auth.destroy();
});

test('successful normal sign-in exits recovery mode and removes its restoration marker', async () => {
  const { auth, values } = harness({ href: 'https://example.invalid/xylo-studio/?code=recovery-code&auth_flow=recovery' });
  await auth.init();
  assert.equal(auth.getState().recovery, true);
  assert.ok(values.size);
  assert.equal((await auth.signIn({ email: 'musician@example.invalid', password: 'password1' })).ok, true);
  assert.equal(auth.getState().recovery, false);
  assert.equal(values.size, 0);
  auth.destroy();
});

test('corrupt or expired recovery markers never skip the current password requirement', async () => {
  for (const marker of ['not-json', JSON.stringify({ userId: user().id, type: 'recovery', expiresAt: Date.now() - 1000 })]) {
    const { auth, fake } = harness({ restoredSession: session(), storage: { 'e-instru-auth-recovery-v1': marker } });
    await auth.init();
    assert.equal(auth.getState().recovery, false);
    assert.equal((await auth.changePassword({ password: 'new-password1' })).ok, false);
    assert.equal(fake.count('updateUser'), 0);
    auth.destroy();
  }
});

test('a failing optional recovery storage does not block a verified recovery session', async () => {
  const denied = () => { throw new Error('Storage access denied'); };
  const { auth, fake } = harness({
    href: 'https://example.invalid/xylo-studio/?code=recovery-code&auth_flow=recovery',
    service: { storage: { getItem: denied, setItem: denied, removeItem: denied } },
  });
  await auth.init();
  assert.equal(auth.getState().ready, true);
  assert.equal(auth.getState().recovery, true);
  assert.equal((await auth.changePassword({ password: 'new-password1' })).ok, true);
  assert.equal(fake.count('updateUser'), 1);
  auth.destroy();
});

test('email changes require a session and use the email-change callback without erasing current identity', async () => {
  const guest = harness();
  await guest.auth.init();
  assert.equal((await guest.auth.changeEmail({ email: 'new@example.invalid' })).ok, false);
  assert.equal(guest.fake.count('updateUser'), 0);
  guest.auth.destroy();
  const { auth, fake } = harness({ restoredSession: session() });
  await auth.init();
  assert.equal((await auth.changeEmail({ email: ' new@example.invalid ' })).ok, true);
  assert.equal(fake.last('updateUser').args[0].email, 'new@example.invalid');
  assert.equal(new URL(fake.last('updateUser').args[1].emailRedirectTo).searchParams.get('auth_flow'), 'email_change');
  assert.equal(auth.getState().user.id, user().id);
  auth.destroy();
});

test('initializing twice does not exchange a one-use callback or subscribe twice', async () => {
  const { auth, fake } = harness({ href: 'https://example.invalid/xylo-studio/?code=recovery-code&auth_flow=recovery' });
  await Promise.all([auth.init(), auth.init()]);
  assert.equal(fake.count('exchangeCodeForSession'), 1);
  assert.equal(fake.count('getSession'), 1);
  assert.equal(fake.listenerCount(), 1);
  auth.destroy();
});

test('logout clears local auth state while preserving unrelated application storage', async () => {
  const { auth, fake, values } = harness({ restoredSession: session(), storage: { 'xylo-studio-v2': 'preserved-take', 'e-instru-percussion-v1:kompang': 'preserved-percussion' } });
  await auth.init();
  assert.equal((await auth.signOut()).ok, true);
  assert.equal(fake.last('signOut').args[0].scope, 'local');
  assert.equal(auth.getState().user, null);
  assert.equal(auth.getState().session, null);
  assert.equal(auth.getState().recovery, false);
  assert.equal(values.get('xylo-studio-v2'), 'preserved-take');
  assert.equal(values.get('e-instru-percussion-v1:kompang'), 'preserved-percussion');
  auth.destroy();
});
