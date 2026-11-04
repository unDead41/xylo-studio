const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Host boundary checks execute the actual project modules. They do not measure
// a browser's download, localStorage quota, focus geometry or cross-process race.
const coreSource = fs.readFileSync('studio-pro/core.js', 'utf8');
const projectSource = fs.readFileSync('studio-pro/projects.js', 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { data, writes: 0, fail: null,
    getItem(key) { if (this.fail === 'read') throw Error('Denied'); return data.has(key) ? data.get(key) : null; },
    setItem(key, value) {
      if (this.fail) { const error = Error('Denied'); error.name = this.fail === 'quota' ? 'QuotaExceededError' : 'SecurityError'; throw error; }
      this.writes += 1; data.set(key, value);
    }
  };
}

function fixture(storage = memoryStorage()) {
  const windowListeners = new Map();
  const downloads = [], blobs = [], revoked = [], timers = [];
  const documentListeners = new Map();
  let document;
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.nodeType = 1; this.ownerDocument = document;
      this.children = []; this.parentNode = null; this.attributes = {}; this.listeners = new Map();
      this.value = ''; this.className = ''; this._text = ''; this.disabled = false; this.files = []; this.open = false;
      this.classList = { toggle: (name, on) => { const classes = new Set(this.className.split(/\s+/).filter(Boolean)); if (on) classes.add(name); else classes.delete(name); this.className = [...classes].join(' '); },
        contains: name => this.className.split(/\s+/).includes(name) };
      const parent = this;
      this.textNode = { nodeType: 3, parentNode: parent, parentElement: parent, previousSibling: null,
        get data() { return parent._text; }, set data(value) { parent._text = String(value); } };
    }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this._text = String(value); this.children = []; }
    get childNodes() { return [...(this._text ? [this.textNode] : []), ...this.children]; }
    get parentElement() { return this.parentNode; }
    get lastChild() { return this.childNodes.at(-1) || null; }
    get previousSibling() { const nodes = this.parentNode?.childNodes || []; return nodes[nodes.indexOf(this) - 1] || null; }
    appendChild(node) { this.children.push(node); node.parentNode = this; return node; }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    replaceChildren(...nodes) { this.children.forEach(node => { node.parentNode = null; }); this.children = []; this._text = ''; this.append(...nodes); }
    remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; } }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key] ?? null; }
    hasAttribute(key) { return Object.hasOwn(this.attributes, key); }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener(name, listener) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(listener); }
    removeEventListener(name, listener) { this.listeners.set(name, (this.listeners.get(name) || []).filter(fn => fn !== listener)); }
    async fire(name) { if (this.disabled) return; for (const listener of this.listeners.get(name) || []) await listener({ target: this }); }
    click() { if (this.tagName === 'A') downloads.push({ filename: this.download, href: this.href }); else return this.fire('click'); }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; for (const listener of this.listeners.get('close') || []) listener({ target: this }); }
  }
  document = { activeElement: null, createElement: tag => new Element(tag),
    addEventListener(name, listener) { if (!documentListeners.has(name)) documentListeners.set(name, []); documentListeners.get(name).push(listener); },
    removeEventListener(name, listener) { documentListeners.set(name, (documentListeners.get(name) || []).filter(fn => fn !== listener)); },
    dispatch(name) { for (const listener of documentListeners.get(name) || []) listener({ type: name }); }
  };
  document.documentElement = new Element('html');
  document.body = new Element('body');
  document.documentElement.appendChild(document.body);
  const box = { document, localStorage: storage, Blob,
    URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:local-' + blobs.length; }, revokeObjectURL(url) { revoked.push(url); } },
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout(id) { timers[id - 1] = () => {}; },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    addEventListener(name, listener) { if (!windowListeners.has(name)) windowListeners.set(name, []); windowListeners.get(name).push(listener); },
    removeEventListener(name, listener) { windowListeners.set(name, (windowListeners.get(name) || []).filter(fn => fn !== listener)); }
  };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(coreSource, box);
  vm.runInContext(projectSource, box);
  const statuses = [];
  const store = box.ProStudioProjects.createStore({ storage, onStatus: (message, meta) => statuses.push({ message, ...meta }) });
  const C = box.ProStudioCore;
  let project = C.createProject({ id: 'project-one', title: 'Lagu kelas' });
  const confirmations = [], announcements = [], replacements = [];
  const app = { getStore: () => store, getProject: () => C.clone(project),
    mutate(transform, label) { const draft = C.clone(project); const next = transform(draft); project = C.projectFromJSON(C.exportProject(next || draft)); document.dispatch('prostudio:change'); return true; },
    replaceProject(next, label) { project = C.projectFromJSON(C.exportProject(next)); replacements.push({ project: C.clone(project), label }); document.dispatch('prostudio:change'); return true; },
    announce: message => announcements.push(message), confirm: options => confirmations.push(options)
  };
  function all(root = document.body) { return [root, ...root.children.flatMap(child => all(child))]; }
  document.getElementById = id => all(document.documentElement).find(node => node.id === id) || null;
  document.querySelector = selector => selector === 'dialog[open]' ? all().find(node => node.tagName === 'DIALOG' && node.open) || null : null;
  document.dispatchEvent = event => { for (const listener of documentListeners.get(event.type) || []) listener(event); return true; };
  const container = new Element('div'); document.body.appendChild(container);
  return { box, C, store, storage, statuses, app, document, container, confirmations, announcements, replacements, downloads, blobs, revoked, timers,
    setProject(next) { project = C.clone(next); },
    mount() { return box.ProStudioProjectPanel.mount(container, app); },
    enableTranslation() {
      const source = fs.readFileSync('index.html', 'utf8').match(/<script\s+id="studio-i18n"[^>]*>([\s\S]*?)<\/script>/)?.[1];
      assert.ok(source, 'The shipped translator must be available for project-name preservation checks');
      vm.runInContext(source, box);
      return box.StudioI18n;
    },
    enableShell() {
      const markup = fs.readFileSync('studio-pro/shell.html', 'utf8');
      for (const match of markup.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)) {
        const node = document.createElement(match[1]); node.id = match[2];
        for (const attribute of match[0].matchAll(/\b([a-z-]+)="([^"]*)"/g)) node.setAttribute(attribute[1], attribute[2]);
        node.hidden = /\shidden(?:\s|>)/.test(match[0]); document.body.appendChild(node);
      }
      vm.runInContext(fs.readFileSync('studio-pro/shell.js', 'utf8'), box);
      return box.ProStudioApp;
    },
    runTimers() { const pending = timers.slice(); pending.forEach((fn, index) => { timers[index] = () => {}; fn(); }); },
    action(name, root = container) { return all(root).find(node => node.getAttribute('data-pro-project-action') === name); },
    findClass(name, root = container) { return all(root).find(node => node.className.split(' ').includes(name)); },
    findTag(tag) { return all(container).find(node => node.tagName === tag.toUpperCase()); },
    fireStorage(key, area = storage) { for (const listener of windowListeners.get('storage') || []) listener({ key, storageArea: area }); },
    documentListeners
  };
}

function arrangement(C, id = 'project-one') {
  let project = C.createProject({ id, title: 'Kelas, "ceria"', bpm: 120, lengthBars: 8 });
  project = C.addTrack(project, 'xylophone');
  project = C.addEvent(project, project.tracks[0].id, { tick: 24, durationTick: 12, midi: 64, velocity: .7 });
  project = C.addTrack(project, 'kompang');
  project = C.addEvent(project, project.tracks[1].id, { tick: 48, action: 'edge', velocity: .6 });
  return project;
}

test('empty project store never writes or touches existing instrument workspaces', () => {
  const storage = memoryStorage({ 'xylo-studio-v1': 'legacy', 'e-instru-percussion-v1:kompang': 'percussion' });
  const f = fixture(storage);
  assert.deepEqual(plain(f.store.list()), []);
  assert.equal(f.store.getActiveId(), null);
  assert.equal(storage.writes, 0);
  assert.equal(storage.data.get('xylo-studio-v1'), 'legacy');
  assert.equal(storage.data.get('e-instru-percussion-v1:kompang'), 'percussion');
});

test('store validates actual Core projects and returns independent snapshots', () => {
  const f = fixture(); const project = arrangement(f.C);
  const saved = f.store.save(project);
  assert.equal(saved.id, project.id);
  assert.equal(f.store.getActiveId(), project.id);
  saved.tracks[0].events[0].midi = 72;
  project.title = 'Changed by caller';
  assert.equal(f.store.load(saved.id).tracks[0].events[0].midi, 64);
  assert.equal(f.store.load(saved.id).title, 'Kelas, "ceria"');
  const metadata = f.store.list()[0];
  assert.equal(metadata.trackCount, 2); assert.equal(metadata.lengthBars, 8);
  assert.equal('tracks' in metadata, false);
  assert.equal(fixture(f.storage).store.load(saved.id).tracks[1].events[0].action, 'edge');
});

test('unchanged save and active selection do not rewrite the store', () => {
  const f = fixture(); const project = arrangement(f.C);
  f.store.save(project); const writes = f.storage.writes;
  assert.ok(f.store.save(project)); assert.equal(f.store.setActiveId(project.id), true);
  assert.equal(f.storage.writes, writes);
});

test('returning to the saved snapshot clears a stale quota warning without rewriting storage', () => {
  const f = fixture(); const saved = arrangement(f.C); f.store.save(saved);
  const raw = f.storage.data.get(f.box.ProStudioProjects.STORAGE_KEY); const writes = f.storage.writes;
  f.storage.fail = 'quota'; const changed = f.C.updateProject(saved, { title: 'Pending edit' });
  assert.equal(f.store.save(changed), false); assert.equal(f.store.getStatus().code, 'quota');
  assert.ok(f.store.save(saved)); assert.equal(f.store.getStatus().code, 'saved');
  assert.equal(f.storage.writes, writes); assert.equal(f.storage.data.get(f.box.ProStudioProjects.STORAGE_KEY), raw);
});

test('bounded store retains all twenty projects and refuses silent eviction', () => {
  const f = fixture();
  for (let i = 0; i < 20; i += 1) assert.ok(f.store.save(f.C.createProject({ id: 'p-' + i, title: 'Lagu ' + i })));
  const before = f.storage.data.get(f.box.ProStudioProjects.STORAGE_KEY);
  assert.equal(f.store.save(f.C.createProject({ id: 'overflow' })), false);
  assert.equal(f.store.getStatus().code, 'limit');
  assert.equal(f.store.list().length, 20);
  assert.equal(f.storage.data.get(f.box.ProStudioProjects.STORAGE_KEY), before);
  const first = f.store.load('p-0'); first.title = 'Still editable'; assert.ok(f.store.save(first));
  assert.equal(f.store.remove('p-2'), true);
  assert.ok(f.store.save(f.C.createProject({ id: 'replacement' })));
});

test('invalid project, raw audio payload and unknown schema cannot enter persistence', () => {
  const f = fixture(); const project = arrangement(f.C);
  project.tracks[0].events[0].midi = 999;
  assert.equal(f.store.save(project), false);
  assert.equal(f.store.getStatus().code, 'invalid');
  const audio = f.C.createProject({ id: 'audio' }); audio.raw_audio = [0, 1];
  assert.equal(f.store.save(audio), false);
  const wrong = f.C.createProject({ id: 'wrong' }); wrong.schema = 'other';
  assert.equal(f.store.save(wrong), false);
  assert.equal(f.storage.writes, 0);
});

test('actual source take evidence survives local project round trips', () => {
  const f = fixture();
  const html = fs.readFileSync('index.html', 'utf8');
  vm.runInContext(html.match(/<script id="xylo-core">([\s\S]*?)<\/script>/)[1], f.box);
  const take = f.box.XyloCore.fromTaps([{ midi: 60, raw_ms: 0 }, { midi: 62, raw_ms: 755 }], 80, 12, 2, 4);
  const project = f.C.importTake(f.C.createProject({ id: 'evidence' }), take);
  assert.ok(f.store.save(project));
  const restored = f.store.load('evidence');
  assert.deepEqual(plain(restored.tracks[0].sourceTake), plain(take));
  assert.equal(Object.isFrozen(restored.tracks[0].sourceTake.raw_capture), true);
});

test('corrupt and unsupported stored data remain byte-for-byte untouched', () => {
  for (const value of ['{broken', '', '{"schema":"future/v2"}', '{"schema":"e-instru-project-library/v1","version":2}']) {
    const storage = memoryStorage({ 'e-instru-pro-projects/v1': value }); const f = fixture(storage);
    assert.equal(f.store.getStatus().code, 'corrupt');
    assert.equal(f.store.save(f.C.createProject()), false);
    assert.equal(f.store.remove('anything'), false);
    assert.equal(f.store.setActiveId(null), false);
    assert.equal(storage.data.get('e-instru-pro-projects/v1'), value);
    assert.equal(storage.writes, 0);
    assert.ok(f.statuses.some(status => status.code === 'corrupt'));
  }
});

test('duplicate stored identities or a missing active project make the store read-only', () => {
  const f = fixture(); f.store.save(f.C.createProject({ id: 'one' }));
  const key = f.box.ProStudioProjects.STORAGE_KEY; const value = JSON.parse(f.storage.data.get(key));
  value.projects.push(value.projects[0]);
  const duplicates = fixture(memoryStorage({ [key]: JSON.stringify(value) }));
  assert.equal(duplicates.store.getStatus().code, 'corrupt');
  value.projects.pop(); value.activeId = 'missing';
  assert.equal(fixture(memoryStorage({ [key]: JSON.stringify(value) })).store.getStatus().code, 'corrupt');
});

test('denied localStorage and quota failures are explicit and never report a successful save', () => {
  const missing = fixture(null);
  assert.equal(missing.store.getStatus().code, 'unavailable');
  assert.equal(missing.store.save(missing.C.createProject()), false);
  const deniedStorage = memoryStorage(); deniedStorage.fail = 'read'; const denied = fixture(deniedStorage);
  assert.equal(denied.store.getStatus().code, 'unavailable');
  const f = fixture(); f.storage.fail = 'quota';
  assert.equal(f.store.save(f.C.createProject()), false);
  assert.equal(f.store.getStatus().code, 'quota');
  assert.match(f.store.getStatus().message, /Eksport JSON/);
  assert.equal(f.store.list().length, 0);
  f.storage.fail = null;
  assert.ok(f.store.save(f.C.createProject()));
});

test('default storage works and a denied browser storage getter does not abort startup', () => {
  const f = fixture();
  const normal = f.box.ProStudioProjects.createStore({ storage: undefined });
  assert.ok(normal.save(f.C.createProject({ id: 'default-storage' })));
  Object.defineProperty(f.box, 'localStorage', { configurable: true, get() { throw Error('Access denied'); } });
  const denied = f.box.ProStudioProjects.createStore();
  assert.equal(denied.getStatus().code, 'unavailable');
  assert.equal(denied.save(f.C.createProject()), false);
});

test('two open stores cannot silently overwrite each other even after a metadata read', () => {
  const storage = memoryStorage(); const first = fixture(storage); const second = fixture(storage);
  assert.ok(first.store.save(first.C.createProject({ id: 'first' })));
  const before = storage.data.get(first.box.ProStudioProjects.STORAGE_KEY);
  second.store.list();
  assert.equal(second.store.getStatus().code, 'conflict');
  assert.equal(second.store.save(second.C.createProject({ id: 'second' })), false);
  assert.equal(second.store.setActiveId(null), false);
  assert.equal(storage.data.get(first.box.ProStudioProjects.STORAGE_KEY), before);
  assert.ok(second.statuses.some(status => /tab lain/.test(status.message)));
});

test('storage events and a competing write immediately after setItem surface a conflict', () => {
  const f = fixture(); const key = f.box.ProStudioProjects.STORAGE_KEY;
  f.storage.data.set(key, '{}'); f.fireStorage(key);
  assert.equal(f.store.getStatus().code, 'conflict');
  const storage = memoryStorage(); const originalSet = storage.setItem;
  storage.setItem = function (key, value) { originalSet.call(this, key, value); this.data.set(key, '{"other-tab":true}'); };
  const race = fixture(storage);
  assert.equal(race.store.save(race.C.createProject()), false);
  assert.equal(race.store.getStatus().code, 'conflict');
  assert.equal(storage.data.get(key), '{"other-tab":true}');
});

test('active selection and delete are validated without changing the current project object', () => {
  const f = fixture(); f.store.save(f.C.createProject({ id: 'one' })); f.store.save(f.C.createProject({ id: 'two' }));
  assert.equal(f.store.setActiveId('missing'), false);
  assert.equal(f.store.getActiveId(), 'two');
  assert.equal(f.store.setActiveId('one'), true);
  assert.equal(f.store.remove('missing'), false);
  assert.equal(f.store.remove('one'), true);
  assert.equal(f.store.getActiveId(), null);
  assert.equal(f.store.load('one'), null);
  assert.equal(f.store.load('two').id, 'two');
});

test('panel renders native labelled project controls and removes its document listener on disposal', () => {
  const f = fixture(); const panel = f.mount();
  assert.ok(f.action('save')); assert.ok(f.action('load')); assert.ok(f.action('delete'));
  assert.equal(f.findClass('pro-projects-import').accept, '.json,application/json');
  assert.match(f.container.textContent, /Tiada akaun/);
  assert.equal(f.documentListeners.get('prostudio:change').length, 1);
  panel.dispose(); panel.dispose();
  assert.equal(f.container.children.length, 0);
  assert.equal(f.documentListeners.get('prostudio:change').length, 0);
});

test('a disposed panel cannot mutate or replace the application through detached controls', async () => {
  const f = fixture(); const panel = f.mount(); const input = f.findClass('pro-projects-name');
  const save = f.action('save'); const original = f.app.getProject();
  panel.dispose(); input.value = 'Late edit'; await input.fire('change'); await save.click();
  assert.deepEqual(plain(f.app.getProject()), plain(original));
  assert.equal(f.storage.writes, 0);
});

test('manual save validates title and updates local metadata without app replacement', async () => {
  const f = fixture(); f.mount(); const input = f.findClass('pro-projects-name');
  input.value = '   '; await f.action('save').click();
  assert.equal(input.getAttribute('aria-invalid'), 'true'); assert.equal(f.storage.writes, 0);
  input.value = '  Lagu baharu  '; await f.action('save').click();
  assert.equal(input.getAttribute('aria-invalid'), null);
  assert.equal(f.store.load('project-one').title, 'Lagu baharu');
  assert.equal(f.replacements.length, 0);
});

test('focused project title survives autosave refresh while another title update is visible after blur', () => {
  const f = fixture(); f.mount(); const input = f.findClass('pro-projects-name');
  input.focus(); input.value = 'Uncommitted typing';
  f.app.mutate(project => { project.title = 'External edit'; });
  assert.equal(input.value, 'Uncommitted typing');
  f.document.activeElement = null; f.document.dispatch('prostudio:change');
  assert.equal(input.value, 'External edit');
});

test('new project and loading over unsaved edits wait for the native app confirmation', async () => {
  const f = fixture(); f.mount();
  await f.action('new').click(); assert.equal(f.replacements.length, 0);
  assert.equal(f.confirmations.length, 1); assert.match(f.confirmations[0].message, /belum disimpan/);
  f.confirmations.shift().onConfirm(); assert.equal(f.replacements.length, 1);
  f.setProject(arrangement(f.C));
  f.store.save(f.C.createProject({ id: 'saved-other', title: 'Lain' }));
  f.document.dispatch('prostudio:change'); const select = f.findClass('pro-projects-select');
  select.value = 'saved-other'; await select.fire('change'); await f.action('load').click();
  assert.equal(f.confirmations.length, 1);
  assert.equal(f.app.getProject().id, 'project-one');
  f.confirmations[0].onConfirm(); assert.equal(f.app.getProject().id, 'saved-other');
});

test('duplicate stores all tracks under a new project identity without changing source', async () => {
  const f = fixture(); f.setProject(arrangement(f.C)); f.store.save(f.app.getProject()); f.mount();
  await f.action('duplicate').click();
  const duplicate = f.app.getProject(); assert.notEqual(duplicate.id, 'project-one');
  assert.match(duplicate.title, /\(salinan\)$/); assert.equal(duplicate.tracks.length, 2);
  assert.equal(f.store.load('project-one').title, 'Kelas, "ceria"');
  assert.deepEqual(plain(f.store.load(duplicate.id).tracks), plain(duplicate.tracks));
});

test('deletion waits for confirmation and replaces the active project to prevent autosave resurrection', async () => {
  const f = fixture(); f.store.save(f.app.getProject()); f.mount();
  await f.action('delete').click();
  assert.equal(f.confirmations.length, 1); assert.ok(f.store.load('project-one'));
  f.confirmations[0].onConfirm();
  assert.equal(f.store.load('project-one'), null);
  assert.notEqual(f.app.getProject().id, 'project-one');
  assert.equal(f.app.getProject().tracks.length, 0);
});

test('JSON and CSV exports contain the complete actual arrangement and revoke local URLs', async () => {
  const f = fixture(); f.setProject(arrangement(f.C)); f.mount();
  await f.action('export-json').click(); await f.action('export-csv').click();
  assert.equal(f.downloads.length, 2);
  assert.match(f.downloads[0].filename, /\.json$/); assert.match(f.downloads[1].filename, /\.csv$/);
  assert.deepEqual(JSON.parse(await f.blobs[0].text()), plain(f.app.getProject()));
  const csv = await f.blobs[1].text();
  assert.equal(csv, f.C.csv(f.app.getProject())); assert.match(csv, /xylophone/); assert.match(csv, /kompang/); assert.match(csv, /edge/);
  f.timers.forEach(timer => timer()); assert.equal(f.revoked.length, 2);
});

test('import rejects wrong type, empty, oversized, corrupt and legacy-take files with inline errors', async () => {
  const f = fixture(); f.mount(); const input = f.findClass('pro-projects-import');
  for (const file of [
    { name: 'sound.wav', type: 'audio/wav', size: 1, text: async () => '{}' },
    { name: 'audio.json', type: 'audio/wav', size: 1, text: async () => '{}' },
    { name: 'empty.json', type: '', size: 0, text: async () => '' },
    { name: 'big.json', type: 'application/json', size: 4 * 1024 * 1024 + 1, text: async () => '{}' },
    { name: 'bad.json', type: '', size: 4, text: async () => 'nope' },
    { name: 'take.json', type: 'application/json', size: 40, text: async () => '{"schema":"xylo-studio-take/v2","events":[]}' }
  ]) {
    input.files = [file]; await input.fire('change');
    assert.match(f.findClass('pro-projects-message').textContent, /Import gagal/);
    assert.equal(f.replacements.length, 0);
    assert.equal(input.value, ''); assert.equal(input.disabled, false);
  }
});

test('valid JSON import confirms unsaved replacement, preserves all tracks, and checks colliding saved identity', async () => {
  const f = fixture(); f.mount(); const input = f.findClass('pro-projects-import');
  const project = arrangement(f.C, 'incoming'); const text = f.C.exportProject(project);
  input.files = [{ name: 'project.JSON', type: '', size: Buffer.byteLength(text), text: async () => text }];
  await input.fire('change'); assert.equal(f.replacements.length, 0); assert.equal(f.confirmations.length, 1);
  f.confirmations.shift().onConfirm(); assert.deepEqual(plain(f.app.getProject()), plain(project));
  f.store.save(project);
  const changed = f.C.updateProject(project, { title: 'Incoming replacement' }); const changedText = f.C.exportProject(changed);
  input.files = [{ name: 'project.json', type: 'application/json', size: Buffer.byteLength(changedText), text: async () => changedText }];
  await input.fire('change'); assert.equal(f.confirmations.length, 1);
  assert.match(f.confirmations[0].message, /Identiti fail/);
  assert.equal(f.app.getProject().title, project.title);
});

test('dispose during file read prevents late import from replacing any project', async () => {
  const f = fixture(); const panel = f.mount(); const input = f.findClass('pro-projects-import');
  const text = f.C.exportProject(arrangement(f.C, 'incoming')); let finish;
  input.files = [{ name: 'project.json', type: '', size: text.length, text: () => new Promise(resolve => { finish = resolve; }) }];
  const pending = input.fire('change'); panel.dispose(); finish(text); await pending;
  assert.equal(f.confirmations.length, 0); assert.equal(f.replacements.length, 0);
});

test('passive language changes preserve literal project names, selected IDs, project JSON and export data', async () => {
  const f = fixture(); const i18n = f.enableTranslation();
  const project = f.C.updateProject(arrangement(f.C), { title: 'Rakam' });
  project.tracks[0].name = 'Henti';
  f.setProject(project); f.store.save(project); const panel = f.mount();
  const input = f.findClass('pro-projects-name'); const select = f.findClass('pro-projects-select');
  const saved = f.storage.data.get(f.box.ProStudioProjects.STORAGE_KEY);
  const json = f.C.exportProject(f.app.getProject());
  const probe = f.document.createElement('span'); probe.textContent = 'Rakam'; f.container.appendChild(probe);
  for (const language of ['en', 'ms', 'en']) {
    i18n.setLanguage(language); i18n.refresh();
    const option = select.children.find(node => node.value === project.id);
    assert.equal(option.getAttribute('data-i18n-ignore'), '');
    assert.ok(option.textContent.startsWith('Rakam · '), 'A custom title matching the dictionary must remain literal');
    assert.equal(select.value, project.id); assert.equal(input.value, 'Rakam');
    assert.equal(probe.textContent, language === 'en' ? 'Record' : 'Rakam', 'Ordinary labels must still translate');
    assert.equal(f.storage.data.get(f.box.ProStudioProjects.STORAGE_KEY), saved);
    assert.equal(f.C.exportProject(f.app.getProject()), json);
  }
  await f.action('export-json').click(); await f.action('export-csv').click();
  assert.equal(JSON.parse(await f.blobs[0].text()).title, 'Rakam');
  assert.equal(JSON.parse(await f.blobs[0].text()).tracks[0].name, 'Henti');
  assert.match(await f.blobs[1].text(), /"Rakam"/); assert.match(await f.blobs[1].text(), /"Henti"/);
  panel.dispose();
});

test('local option metadata rerenders on language changes and releases the language listener on disposal', () => {
  const f = fixture(); const listeners = new Set(); let english = false;
  f.box.StudioI18n = { t(text) { return english ? text.replace(' trek · ', ' tracks · ') : text; },
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
  f.setProject(f.C.updateProject(arrangement(f.C), { title: 'Henti' })); f.store.save(f.app.getProject());
  const panel = f.mount(); const select = f.findClass('pro-projects-select');
  assert.equal(select.children[1].textContent, 'Henti · 2 trek · 120 BPM');
  english = true; for (const listener of listeners) listener('en', 'ms');
  assert.equal(select.children[1].textContent, 'Henti · 2 tracks · 120 BPM');
  assert.equal(f.action('save').getAttribute('data-i18n-ignore'), null);
  panel.dispose(); assert.equal(listeners.size, 0);
});

test('all three original starters are independent playable four-bar scores validated by actual Core', () => {
  const f = fixture(); const expected = {
    'melody-percussion': ['xylophone', 'kompang'],
    'school-rhythm': ['tamborin', 'triangle'],
    march: ['snare', 'bass_drum', 'cymbals']
  };
  for (const [kind, instruments] of Object.entries(expected)) {
    const project = f.box.ProStudioProjects.createStarter(kind);
    assert.deepEqual(plain(f.C.validate(project)), []); assert.equal(project.lengthBars, 4);
    assert.ok(project.bpm >= 40 && project.bpm <= 200); assert.equal(project.loop.enabled, false);
    assert.deepEqual(plain(project.tracks.map(track => track.instrumentId)), instruments);
    const eventIds = new Set();
    for (const track of project.tracks) {
      const instrument = f.C.INSTRUMENTS[track.instrumentId];
      assert.ok(track.volume > 0); assert.equal(track.muted, false); assert.equal(track.solo, false);
      assert.ok(track.events.length > 0 && track.events.length <= f.C.MAX_EVENTS);
      assert.equal(Object.hasOwn(track, 'sourceTake'), false); assert.equal(Object.hasOwn(track, 'raw_capture'), false);
      assert.deepEqual([...new Set(track.events.map(event => Math.floor(event.tick / f.C.BAR_TICKS)))], [0, 1, 2, 3]);
      for (const event of track.events) {
        assert.ok(event.velocity > 0); assert.ok(event.tick + event.durationTick <= 4 * f.C.BAR_TICKS);
        assert.equal(eventIds.has(event.id), false); eventIds.add(event.id);
        if (instrument.pitched) { assert.equal(Number.isInteger(event.midi), true); assert.equal(event.action, null); }
        else { assert.equal(event.midi, null); assert.ok(instrument.actions.includes(event.action)); }
      }
    }
    assert.deepEqual(plain(f.C.projectFromJSON(f.C.exportProject(project))), plain(project));
    assert.equal(f.C.csv(project).split('\r\n').length, 1 + project.tracks.reduce((sum, track) => sum + track.events.length, 0));
    const other = f.box.ProStudioProjects.createStarter(kind); assert.notEqual(other.id, project.id);
    project.tracks[0].events[0].velocity = 0;
    assert.ok(other.tracks[0].events[0].velocity > 0, 'A caller must never mutate the next starter');
  }
  assert.throws(() => f.box.ProStudioProjects.createStarter('not-a-template'), /Pilih contoh/);
  assert.equal(f.storage.writes, 0, 'Creating a starter must not touch persistence');
});

test('starter disclosure and focus route stay passive until the user opens an example', () => {
  const f = fixture(); const panel = f.mount(); const before = f.C.exportProject(f.app.getProject());
  const details = f.findClass('pro-projects-starters'); const select = f.findClass('pro-projects-starter-select');
  assert.equal(details.tagName, 'DETAILS'); assert.equal(details.open, false);
  assert.equal(select.tagName, 'SELECT'); assert.equal(select.children.length, 3);
  assert.equal(select.id, 'pro-projects-1-starter'); assert.equal(select.getAttribute('data-pro-project-starter'), '');
  assert.ok(select.getAttribute('aria-describedby')); assert.ok(f.action('starter'));
  assert.match(details.textContent, /2 trek · 100 BPM · 4 bar/);
  assert.equal(panel.focusStarter(), true); assert.equal(details.open, true); assert.equal(f.document.activeElement, select);
  assert.equal(f.C.exportProject(f.app.getProject()), before); assert.equal(f.storage.writes, 0);
  panel.dispose(); assert.equal(panel.focusStarter(), false);
});

test('live shell starter replacement preserves pending source edits before cancelling their autosave', async () => {
  const f = fixture(); const app = f.enableShell(); app.enter();
  app.mutate(project => f.C.addTrack(f.C.updateProject(project, { title: 'Rakam' }), 'xylophone'), 'Pending track');
  app.mutate(project => f.C.addEvent(project, project.tracks[0].id, { midi: 64, tick: 24 }), 'Pending note');
  const previous = app.getProject(); const previousJSON = f.C.exportProject(previous);
  assert.equal(app.getStore().load(previous.id), null);
  const select = f.findClass('pro-projects-starter-select', f.document.body); select.value = 'march'; await select.fire('change');
  await f.action('starter', f.document.body).click();
  assert.equal(f.document.getElementById('proConfirmDialog').open, false);
  assert.equal(app.getProject().title, 'Rentak perarakan'); assert.equal(app.getProject().tracks.length, 3);
  assert.equal(f.C.exportProject(app.getStore().load(previous.id)), previousJSON);
  f.runTimers();
  assert.equal(f.C.exportProject(app.getStore().load(previous.id)), previousJSON);
  assert.equal(app.getStore().getActiveId(), app.getProject().id);
  assert.equal(app.getStore().load(previous.id).title, 'Rakam');
});

test('live shell quota and corrupt storage keep pending projects until native discard confirmation', async () => {
  for (const failure of ['quota', 'corrupt']) {
    const storage = memoryStorage(failure === 'corrupt' ? { 'e-instru-pro-projects/v1': '{broken' } : {});
    const f = fixture(storage); const app = f.enableShell(); app.enter();
    app.mutate(project => f.C.addTrack(f.C.updateProject(project, { title: 'Henti' }), 'kompang'), 'Pending work');
    if (failure === 'quota') storage.fail = 'quota';
    const previous = f.C.exportProject(app.getProject()); const raw = storage.data.get(f.box.ProStudioProjects.STORAGE_KEY);
    await f.action('starter', f.document.body).click();
    assert.equal(f.document.getElementById('proConfirmDialog').open, true);
    assert.match(f.document.getElementById('proConfirmMessage').textContent, /belum disimpan/);
    assert.equal(f.C.exportProject(app.getProject()), previous);
    await f.document.getElementById('proConfirmCancel').fire('click');
    assert.equal(f.C.exportProject(app.getProject()), previous); assert.equal(storage.data.get(f.box.ProStudioProjects.STORAGE_KEY), raw);
  }
});

test('a full local library is preserved when an unsavable starter replacement is cancelled or explicitly accepted', async () => {
  const f = fixture(); const app = f.enableShell(); app.enter();
  app.mutate(project => f.C.addTrack(f.C.updateProject(project, { title: 'Pending arrangement' }), 'tamborin'));
  for (let i = 0; i < 20; i += 1) app.getStore().save(f.C.createProject({ id: 'saved-' + i, title: 'Saved ' + i }));
  const raw = f.storage.data.get(f.box.ProStudioProjects.STORAGE_KEY); const previous = f.C.exportProject(app.getProject());
  await f.action('starter', f.document.body).click();
  assert.equal(f.document.getElementById('proConfirmDialog').open, true);
  assert.equal(f.C.exportProject(app.getProject()), previous);
  await f.document.getElementById('proConfirmCancel').fire('click');
  assert.equal(f.storage.data.get(f.box.ProStudioProjects.STORAGE_KEY), raw);
  await f.action('starter', f.document.body).click();
  await f.document.getElementById('proConfirmAccept').fire('click'); f.runTimers();
  assert.equal(app.getProject().title, 'Melodi dan rentak'); assert.equal(app.getProject().tracks.length, 2);
  assert.equal(f.storage.data.get(f.box.ProStudioProjects.STORAGE_KEY), raw, 'Explicitly opening an unsaved example must never evict a stored project');
  assert.equal(app.getStore().list().length, 20);
});

test('starter titles localize on creation while user names and previous projects stay literal', () => {
  const f = fixture(); let english = false;
  const labels = { 'Melodi dan rentak': 'Melody and rhythm', 'Rentak sekolah': 'School rhythm', 'Rentak perarakan': 'March rhythm',
    Kompang: 'Kompang', Tamborin: 'Tambourine', 'Segi Tiga': 'Triangle', 'Dram Sisi': 'Snare drum', 'Dram Bes': 'Bass drum', Simbal: 'Cymbals' };
  f.box.StudioI18n = { t: source => english ? labels[source] || source : source };
  const first = f.box.ProStudioProjects.createStarter('melody-percussion');
  f.store.save(f.C.updateProject(first, { title: 'Rakam' })); const raw = f.storage.data.get(f.box.ProStudioProjects.STORAGE_KEY);
  english = true;
  assert.equal(f.box.ProStudioProjects.createStarter('melody-percussion').title, 'Melody and rhythm');
  const school = f.box.ProStudioProjects.createStarter('school-rhythm');
  assert.equal(school.title, 'School rhythm'); assert.equal(school.tracks[1].name, 'Triangle');
  assert.equal(first.title, 'Melodi dan rentak'); assert.equal(f.store.load(first.id).title, 'Rakam');
  assert.equal(f.storage.data.get(f.box.ProStudioProjects.STORAGE_KEY), raw);
});
