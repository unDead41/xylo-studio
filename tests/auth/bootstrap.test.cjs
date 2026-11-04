const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { source, serviceFactory, fakeClient, environment, user, session, deferred, settle } = require('./helpers.cjs');

function bootstrap({ restoredSession = null, responses = {}, profile = { data: null, error: null }, config = true, createFailure = false } = {}) {
  const fake = fakeClient({ restoredSession, responses });
  const env = environment();
  const profileCalls = [], uiStates = [], pauses = [];
  let service, uiOptions, clientOptions, mounted = false;
  const client = { ...fake.client, from(table) {
    let owner;
    const query = {
      select(columns) { profileCalls.push({ operation: 'select', table, columns }); return query; },
      eq(column, value) { owner = value; profileCalls.push({ operation: 'eq', column, value }); return query; },
      async maybeSingle() { return typeof profile === 'function' ? profile(owner) : profile; },
      async insert(values) { profileCalls.push({ operation: 'insert', table, values }); return { error: null }; },
    };
    return query;
  } };
  const factory = serviceFactory().createAuthService;
  const pause = name => ({ pauseForAccount: () => pauses.push(name) });
  const box = {
    console, location: env.location,
    InstruAuthConfig: config ? { url: 'https://project.supabase.invalid', publishableKey: 'test-publishable-key', redirectTo: 'https://example.invalid/xylo-studio/', storageKey: 'test-auth-storage' } : null,
    supabase: { createClient(url, key, options) {
      if (createFailure) throw new Error('Storage unavailable');
      clientOptions = { url, key, options }; return client;
    } },
    InstruAuth: { createAuthService(options) { service = factory({ ...options, ...env }); return service; } },
    InstruAuthUI: { createAuthUI(options) {
      uiOptions = options;
      return { mount() { mounted = true; }, setState(state) { uiStates.push(state); } };
    } },
    XyloStudioBridge: pause('pitched'), XyloGameBridge: pause('game'),
    TamborinStudio: pause('tamborin'), KompangStudio: pause('kompang'),
    SchoolBandStudios: Object.fromEntries(['snare', 'bass_drum', 'cymbals', 'triangle'].map(name => [name, { studio: pause(name) }])),
  };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(source('auth-bootstrap', 'assets/auth/auth-bootstrap.js'), box, { filename: 'inline-auth-bootstrap.js' });
  return {
    fake, service, profileCalls, uiStates, pauses, uiOptions,
    get mounted() { return mounted; }, get clientOptions() { return clientOptions; },
    inserts: () => profileCalls.filter(call => call.operation === 'insert'),
  };
}

test('bootstrap enables PKCE with one callback owner and mounts account UI before session restoration', async () => {
  const pending = deferred();
  const app = bootstrap({ responses: { getSession: pending.promise } });
  assert.equal(app.mounted, true);
  assert.equal(app.clientOptions.options.auth.flowType, 'pkce');
  assert.equal(app.clientOptions.options.auth.detectSessionInUrl, false);
  assert.equal(app.clientOptions.options.auth.persistSession, true);
  assert.equal(app.clientOptions.options.auth.autoRefreshToken, true);
  assert.ok(app.uiStates.some(state => !state.ready));
  pending.resolve({ data: { session: null }, error: null });
  await settle();
  assert.equal(app.service.getState().ready, true);
  app.service.destroy();
});

test('profile synchronization waits for initialized auth state before reading or inserting', async () => {
  const pending = deferred();
  const app = bootstrap({ responses: { getSession: pending.promise } });
  await app.fake.emit('SIGNED_IN', session());
  assert.equal(app.service.getState().ready, false);
  assert.equal(app.profileCalls.length, 0);
  pending.resolve({ data: { session: session() }, error: null });
  await settle();
  assert.equal(app.service.getState().ready, true);
  assert.equal(app.inserts().length, 1);
  assert.equal(app.inserts()[0].table, 'profiles');
  assert.equal(app.inserts()[0].values.id, user().id);
  assert.equal(app.inserts()[0].values.display_name, 'Musician');
  app.service.destroy();
});

test('repeat session notifications for one user do not repeat the profile read or insert', async () => {
  const app = bootstrap({ restoredSession: session() });
  await settle();
  assert.equal(app.inserts().length, 1);
  await app.fake.emit('SIGNED_IN', session());
  await app.fake.emit('TOKEN_REFRESHED', session({ access_token: 'refreshed-access-token' }));
  await app.fake.emit('USER_UPDATED', session({ user: user({ user_metadata: { display_name: 'New Name' } }) }));
  assert.equal(app.inserts().length, 1);
  assert.equal(app.profileCalls.filter(call => call.operation === 'select').length, 1);
  app.service.destroy();
});

test('an existing profile is read without overwriting its stored display name', async () => {
  const app = bootstrap({ restoredSession: session(), profile: { data: { id: user().id }, error: null } });
  await settle();
  assert.equal(app.profileCalls.filter(call => call.operation === 'select').length, 1);
  assert.equal(app.inserts().length, 0);
  assert.equal(app.service.getState().user.id, user().id);
  app.service.destroy();
});

test('a stale profile lookup cannot insert a former user after logout', async () => {
  const pending = deferred();
  const app = bootstrap({ restoredSession: session(), profile: pending.promise });
  await settle();
  await app.fake.emit('SIGNED_OUT', null);
  pending.resolve({ data: null, error: null });
  await settle();
  assert.equal(app.inserts().length, 0);
  assert.equal(app.service.getState().user, null);
  app.service.destroy();
});

test('a profile error leaves auth and account UI usable without attempting an insert', async () => {
  const app = bootstrap({ restoredSession: session(), profile: { data: null, error: { code: '42501' } } });
  await settle();
  assert.equal(app.service.getState().user.id, user().id);
  assert.ok(app.uiStates.some(state => state.ready && state.user?.id === user().id));
  assert.equal(app.inserts().length, 0);
  app.service.destroy();
});

for (const options of [{ config: false }, { createFailure: true }]) test('guest bootstrap survives missing or failed account configuration: ' + JSON.stringify(options), async () => {
  const app = bootstrap(options);
  await settle();
  assert.equal(app.mounted, true);
  assert.equal(app.service.getState().ready, true);
  assert.equal(app.service.getState().user, null);
  assert.ok(app.service.getState().configurationError);
  assert.equal(app.profileCalls.length, 0);
  assert.equal((await app.uiOptions.onSubmit('signIn', { email: 'musician@example.invalid', password: 'password1' })).ok, false);
  app.service.destroy();
});

test('opening account controls pauses every available studio and the game', async () => {
  const app = bootstrap();
  await settle();
  app.uiOptions.onOpen();
  assert.deepEqual(app.pauses, ['pitched', 'game', 'tamborin', 'kompang', 'snare', 'bass_drum', 'cymbals', 'triangle']);
  assert.equal((await app.uiOptions.onSubmit('deleteUser', {})).ok, false);
  app.service.destroy();
});
