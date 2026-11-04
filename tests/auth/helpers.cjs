const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');

// Read the script shipped in the standalone page. The asset override is only
// useful while regenerating index.html; normal verification exercises inline JS.
function source(id, asset) {
  if (process.env.AUTH_TEST_FROM_ASSETS === '1') {
    return fs.readFileSync(path.join(root, asset), 'utf8');
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const match = html.match(new RegExp('<script\\b[^>]*\\bid="' + id + '"[^>]*>([\\s\\S]*?)<\\/script>'));
  if (!match) throw new Error('Missing shipped inline script #' + id);
  return match[1];
}

function serviceFactory() {
  const box = { console, URL, URLSearchParams, setTimeout, clearTimeout, queueMicrotask };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(source('auth-service', 'assets/auth/auth-service.js'), box, { filename: 'inline-auth-service.js' });
  if (!box.InstruAuth?.createAuthService) throw new Error('Auth service factory was not exported');
  return box.InstruAuth;
}

const user = (overrides = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  email: 'musician@example.invalid',
  email_confirmed_at: '2026-11-04T00:00:00.000Z',
  user_metadata: { display_name: 'Musician' },
  ...overrides,
});
const session = (overrides = {}) => ({
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: 'bearer',
  user: user(),
  ...overrides,
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fakeClient({ restoredSession = null, responses = {} } = {}) {
  const calls = [];
  const listeners = new Set();
  const active = { session: restoredSession };
  const auth = {};
  const defaults = {
    getSession: () => ({ data: { session: active.session }, error: null }),
    getUser: () => ({ data: { user: active.session?.user || null }, error: null }),
    signInWithPassword: () => ({ data: { session: session(), user: user() }, error: null }),
    signUp: () => ({ data: { session: null, user: user({ email_confirmed_at: null }) }, error: null }),
    resetPasswordForEmail: () => ({ data: {}, error: null }),
    signInWithOtp: () => ({ data: { user: null, session: null }, error: null }),
    resend: () => ({ data: { user: null, session: null }, error: null }),
    reauthenticate: () => ({ data: {}, error: null }),
    updateUser: () => ({ data: { user: active.session?.user || user() }, error: null }),
    signOut: () => ({ error: null }),
    exchangeCodeForSession: () => ({ data: { session: session(), user: user(), redirectType: 'recovery' }, error: null }),
    verifyOtp: () => ({ data: { session: session(), user: user() }, error: null }),
    setSession: () => ({ data: { session: session(), user: user() }, error: null }),
  };
  for (const [method, fallback] of Object.entries(defaults)) {
    auth[method] = async (...args) => {
      calls.push({ method, args });
      const response = Object.hasOwn(responses, method) ? responses[method] : fallback;
      const result = typeof response === 'function' ? await response(...args) : await response;
      if (!result?.error && result?.data?.session) active.session = result.data.session;
      if (method === 'signOut' && !result?.error) active.session = null;
      return result;
    };
  }
  auth.onAuthStateChange = callback => {
    calls.push({ method: 'onAuthStateChange', args: [] });
    listeners.add(callback);
    return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
  };
  return {
    client: { auth }, calls, active,
    count: method => calls.filter(call => call.method === method).length,
    last: method => calls.filter(call => call.method === method).at(-1),
    emit: async (event, nextSession) => {
      active.session = nextSession;
      for (const callback of listeners) await callback(event, nextSession);
      await settle();
    },
    listenerCount: () => listeners.size,
  };
}

function environment(href = 'https://example.invalid/xylo-studio/?keep=yes#workspace', entries = {}) {
  const location = new URL(href);
  const values = new Map(Object.entries(entries));
  const history = {
    state: { retained: true },
    calls: [],
    replaceState(state, title, nextUrl) {
      this.calls.push({ state, title, url: String(nextUrl) });
      this.state = state;
      location.href = new URL(nextUrl, location).href;
    },
  };
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
  return { location, history, storage, values };
}

function harness(options = {}) {
  const fake = fakeClient(options);
  const env = environment(options.href, options.storage);
  const { createAuthService, ...exports } = serviceFactory();
  const auth = createAuthService({
    client: fake.client,
    redirectTo: 'https://example.invalid/xylo-studio/',
    ...env,
    ...options.service,
  });
  return { auth, fake, ...env, exports };
}

async function settle() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

module.exports = { source, serviceFactory, user, session, deferred, fakeClient, environment, harness, settle };
