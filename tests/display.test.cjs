'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const KEY = 'e-instru-display-v1';
const THEMES = ['system', 'light', 'dark'];
const VISIONS = ['standard', 'protanopia', 'deuteranopia', 'tritanopia', 'contrast'];
const plain = value => JSON.parse(JSON.stringify(value));

// Execute the preference owner shipped in the standalone HTML. Native focus,
// dialog layout, contrast and actual paint still require browser verification.
function shippedSource() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const match = html.match(/<script\b[^>]*\bid="studio-display"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(match, 'The standalone page must contain the display controller');
  return match[1];
}

function fixture({ saved, dark = false, storage = {}, failRead = false, failWrite = false,
  failAccess = false, mediaMode = 'modern', initialMeta = true } = {}) {
  const dataset = {}, variables = {}, writes = [], reads = [], events = [];
  const savedValues = new Map(Object.entries(storage));
  if (saved !== undefined) savedValues.set(KEY, saved);
  const listeners = new Map(), documentListeners = new Map(), elements = new Map();
  const on = (map, type, listener) => {
    if (!map.has(type)) map.set(type, []);
    map.get(type).push(listener);
  };
  const fire = (map, type, event) => {
    for (const listener of map.get(type) || []) listener(event);
  };
  let document;
  class Element {
    constructor(id) {
      this.id = id; this.value = ''; this.textContent = ''; this.open = false;
      this.hidden = false; this.disabled = false; this.isConnected = true;
      this.attributes = new Map(); this.listeners = new Map(); this.focusCount = 0;
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    addEventListener(type, listener) { on(this.listeners, type, listener); }
    fire(type, extra = {}) {
      const event = { type, target: this, preventDefault() { this.defaultPrevented = true; }, ...extra };
      fire(this.listeners, type, event); return event;
    }
    focus() { document.activeElement = this; this.focusCount++; }
    showModal() { this.open = true; }
    close() { this.open = false; this.fire('close'); }
    closest() { return this.hidden ? this : null; }
  }
  const meta = new Element('theme-color');
  let mountedMeta = initialMeta ? meta : null;
  document = {
    readyState: 'loading', activeElement: null, body: {},
    documentElement: { dataset, style: { setProperty: (name, value) => { variables[name] = value; } } },
    getElementById: id => elements.get(id) || null,
    querySelector: selector => selector === 'meta[name="theme-color"]' ? mountedMeta
      : selector === 'dialog[open]' ? [...elements.values()].find(el => el.open) || null : null,
    addEventListener: (type, listener) => on(documentListeners, type, listener),
  };
  const storageBoundary = {
    getItem(key) {
      reads.push(key); if (failRead) throw Error('Storage read blocked');
      return savedValues.get(key) ?? null;
    },
    setItem(key, value) {
      writes.push([key, value]); if (failWrite) throw Error('Storage write blocked');
      savedValues.set(key, value);
    },
  };
  const mediaListeners = [], media = { matches: dark };
  if (mediaMode === 'legacy') media.addListener = listener => { mediaListeners.push(listener); };
  else if (mediaMode === 'modern') media.addEventListener = (type, listener) => {
    if (type === 'change') mediaListeners.push(listener);
  };
  const window = {
    addEventListener: (type, listener) => on(listeners, type, listener),
    dispatchEvent(event) { events.push(event); fire(listeners, event.type, event); return true; },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
  };
  Object.defineProperty(window, 'localStorage', { get() {
    if (failAccess) throw Error('Storage access blocked'); return storageBoundary;
  } });
  if (mediaMode !== 'missing') window.matchMedia = () => {
    if (mediaMode === 'throws') throw Error('Media preference unavailable'); return media;
  };
  vm.runInNewContext(shippedSource(), { window, document }, { filename: 'inline-studio-display.js' });
  return {
    api: window.StudioDisplay, document, dataset, variables, storage: savedValues,
    reads, writes, events, media, meta, elements, storageBoundary,
    storageEvent(key, newValue, storageArea) { fire(listeners, 'storage', { key, newValue, storageArea }); },
    changeSystemTheme(matches) {
      media.matches = matches; for (const listener of mediaListeners) listener({ matches });
    },
    ready({ withControls = true } = {}) {
      mountedMeta = meta;
      if (withControls) for (const id of ['displayDialog', 'displaySettingsBtn', 'displayTheme', 'displayVision',
        'displayClose', 'displayDone', 'displayReset', 'displaySaveStatus']) elements.set(id, new Element(id));
      document.readyState = 'interactive'; fire(documentListeners, 'DOMContentLoaded', {});
    },
    element(id) { return elements.get(id); },
    opener(id = 'current-route-control') { return new Element(id); },
  };
}

test('the standalone bootstrap matches its editable source and runs before body paint', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(shippedSource().trim(), fs.readFileSync(path.join(root, 'studio-pro/display.js'), 'utf8').trim());
  const styles = html.match(/<style\b[^>]*\bid="display-styles"[^>]*>([\s\S]*?)<\/style>/);
  assert.ok(styles, 'The standalone page must contain the complete display styles');
  assert.equal(styles[1].trim(), fs.readFileSync(path.join(root, 'studio-pro/display.css'), 'utf8').trim());
  assert.ok(html.indexOf('id="studio-display"') < html.indexOf('<meta name="theme-color"'), 'Saved choices apply before theme metadata');
  assert.ok(html.indexOf('id="studio-display"') < html.indexOf('<style'), 'Saved choices apply before the first stylesheet and body');
});

test('a new display preference follows system changes without writing storage', () => {
  const f = fixture({ dark: true });
  assert.deepEqual(plain(f.api.get()), { theme: 'system', vision: 'standard' });
  assert.equal(f.dataset.theme, 'dark');
  f.changeSystemTheme(false); assert.equal(f.dataset.theme, 'light');
  f.changeSystemTheme(true); assert.equal(f.api.resolvedTheme(), 'dark');
  assert.deepEqual(f.writes, []);
});

test('explicit light and dark choices ignore system changes until system is restored', () => {
  const f = fixture({ dark: true });
  f.api.set({ theme: 'light' }); f.changeSystemTheme(false); f.changeSystemTheme(true);
  assert.equal(f.dataset.theme, 'light');
  f.api.set({ theme: 'dark' }); f.changeSystemTheme(false);
  assert.equal(f.dataset.theme, 'dark');
  f.api.set({ theme: 'system' }); assert.equal(f.dataset.theme, 'light');
  f.changeSystemTheme(true); assert.equal(f.dataset.theme, 'dark');
});

for (const mediaMode of ['legacy', 'missing', 'throws']) {
  test('system preference remains usable when matchMedia is ' + mediaMode, () => {
    const f = fixture({ mediaMode, dark: true });
    assert.equal(f.dataset.theme, mediaMode === 'legacy' ? 'dark' : 'light');
    if (mediaMode === 'legacy') { f.changeSystemTheme(false); assert.equal(f.dataset.theme, 'light'); }
    assert.doesNotThrow(() => f.api.set({ theme: 'dark', vision: 'contrast' }));
    assert.equal(f.dataset.theme, 'dark'); assert.equal(f.dataset.vision, 'contrast');
  });
}

test('every theme and vision combination restores independently and survives another reload', () => {
  for (const theme of THEMES) for (const vision of VISIONS) {
    const f = fixture({ dark: true, saved: JSON.stringify({ theme, vision }) });
    assert.equal(f.dataset.theme, theme === 'light' ? 'light' : 'dark');
    assert.equal(f.dataset.vision, vision);
    f.api.set({ theme: 'light' }); assert.equal(f.api.get().vision, vision);
    f.api.set({ vision: 'standard' }); assert.equal(f.api.get().theme, 'light');
    f.api.set({ theme, vision });
    const restored = fixture({ dark: true, saved: f.storage.get(KEY) });
    assert.deepEqual(plain(restored.api.get()), { theme, vision });
    const palette = restored.api.palette(); assert.equal(palette.length, 8);
    palette.forEach((color, index) => {
      assert.match(color, /^#[0-9a-f]{6}$/i);
      assert.equal(restored.variables['--vision-note-' + index], color);
    });
  }
});

for (const saved of ['null', 'false', 'true', '0', '42', '"dark"', '[]', '["dark","contrast"]',
  '{}', '{"theme":null,"vision":null}', '{"theme":[],"vision":{}}',
  '{"theme":"javascript:bad","vision":"bad"}', 'not-json', '{']) {
  test('invalid saved preference falls back without rewriting evidence: ' + saved, () => {
    const f = fixture({ saved });
    assert.deepEqual(plain(f.api.get()), { theme: 'system', vision: 'standard' });
    assert.equal(f.dataset.theme, 'light'); assert.equal(f.dataset.vision, 'standard');
    assert.equal(f.storage.get(KEY), saved); assert.deepEqual(f.writes, []);
    f.ready(); assert.doesNotMatch(f.element('displaySaveStatus').textContent, /tidak tersedia/);
  });
}

test('normalization rejects non-record and inherited choices while preserving valid fields', () => {
  const f = fixture();
  for (const value of [undefined, null, false, true, 0, 42, '', 'dark', [], ['dark', 'contrast'],
    Object.create({ theme: 'dark', vision: 'contrast' })]) {
    assert.deepEqual(plain(f.api.normalize(value)), { theme: 'system', vision: 'standard' });
  }
  const decoratedArray = []; decoratedArray.theme = 'dark'; decoratedArray.vision = 'contrast';
  assert.deepEqual(plain(f.api.normalize(decoratedArray)), { theme: 'system', vision: 'standard' });
  assert.deepEqual(plain(f.api.normalize({ theme: 'dark', vision: 'unknown' })), { theme: 'dark', vision: 'standard' });
  assert.deepEqual(plain(f.api.normalize({ theme: false, vision: 'tritanopia' })), { theme: 'system', vision: 'tritanopia' });
  f.api.set({ theme: 'dark', vision: 'contrast' });
  for (const patch of [null, undefined, [], 'light']) {
    assert.deepEqual(plain(f.api.set(patch)), { theme: 'dark', vision: 'contrast' });
  }
});

for (const failure of ['failRead', 'failWrite', 'failAccess']) {
  test('blocked ' + failure + ' keeps in-session choices and reports their storage limit', () => {
    const f = fixture({ [failure]: true }); f.ready();
    if (failure !== 'failWrite') assert.match(f.element('displaySaveStatus').textContent, /sesi ini.*tidak tersedia/);
    assert.doesNotThrow(() => f.api.set({ theme: 'dark', vision: 'deuteranopia' }));
    assert.deepEqual(plain(f.api.get()), { theme: 'dark', vision: 'deuteranopia' });
    assert.equal(f.dataset.theme, 'dark'); assert.equal(f.dataset.vision, 'deuteranopia');
    if (failure !== 'failRead') assert.match(f.element('displaySaveStatus').textContent, /sesi ini.*tidak tersedia/);
    else assert.doesNotMatch(f.element('displaySaveStatus').textContent, /tidak tersedia/);
  });
}

test('display writes only its preference key and preserves every music storage value', () => {
  const music = {
    'xylo-studio-v1': '{"legacy":"unchanged"}', 'xylo-studio-v2': '{"raw_capture":[0,455.5]}',
    'xylo-game-settings-v1': '{"song":2,"variant":"long","level":"hard"}',
    'xylo-game-best-v1': '{"2:long:hard:120:v1":9000}',
  };
  for (const instrument of ['tamborin', 'kompang', 'snare', 'bass_drum', 'cymbals', 'triangle']) {
    music['e-instru-percussion-v1:' + instrument] = '{"instrument":"' + instrument + '","raw_capture":[0,400]}';
  }
  const f = fixture({ storage: music });
  for (const vision of VISIONS) f.api.set({ theme: 'dark', vision, take: { events: ['must not persist'] } });
  f.api.set({ theme: 'system', vision: 'standard' });
  assert.deepEqual(f.reads, [KEY]); assert.ok(f.writes.length > 0);
  assert.ok(f.writes.every(([key]) => key === KEY));
  for (const [key, value] of Object.entries(music)) assert.equal(f.storage.get(key), value, key);
  assert.deepEqual(JSON.parse(f.storage.get(KEY)), { theme: 'system', vision: 'standard' });
});

test('cross-tab changes, removal and clear apply without writes or unrelated storage effects', () => {
  const f = fixture();
  f.storageEvent(KEY, JSON.stringify({ theme: 'dark', vision: 'protanopia' }), f.storageBoundary);
  assert.deepEqual(plain(f.api.get()), { theme: 'dark', vision: 'protanopia' });
  f.storageEvent('xylo-studio-v2', JSON.stringify({ theme: 'light', vision: 'contrast' }));
  f.storageEvent(KEY, '{broken-json');
  f.storageEvent(KEY, JSON.stringify({ theme: 'light', vision: 'contrast' }), {});
  assert.deepEqual(plain(f.api.get()), { theme: 'dark', vision: 'protanopia' });
  f.storageEvent(KEY, null);
  assert.deepEqual(plain(f.api.get()), { theme: 'system', vision: 'standard' });
  f.storageEvent(KEY, JSON.stringify({ theme: 'dark', vision: 'tritanopia' }));
  f.storageEvent(null, null, f.storageBoundary);
  assert.deepEqual(plain(f.api.get()), { theme: 'system', vision: 'standard' });
  assert.deepEqual(f.writes, []);
});

test('returned preferences, palettes and display-change events cannot mutate the saved choice', () => {
  const f = fixture(); f.api.set({ theme: 'dark', vision: 'contrast' });
  const returned = f.api.get(), palette = f.api.palette(), event = f.events.at(-1);
  assert.equal(event.type, 'studiodisplaychange');
  assert.deepEqual(plain(event.detail), {
    theme: 'dark', vision: 'contrast', resolvedTheme: 'dark', palette: plain(f.api.palette()),
  });
  returned.theme = 'light'; palette[0] = '#123456'; event.detail.vision = 'standard';
  event.detail.palette[0] = '#123456';
  assert.deepEqual(plain(f.api.get()), { theme: 'dark', vision: 'contrast' });
  assert.notEqual(f.api.palette()[0], '#123456');
  assert.deepEqual(JSON.parse(f.storage.get(KEY)), { theme: 'dark', vision: 'contrast' });
});

test('head bootstrap updates late metadata after DOM ready even without dialog controls', () => {
  const f = fixture({ saved: JSON.stringify({ theme: 'dark', vision: 'standard' }), initialMeta: false });
  assert.equal(f.meta.getAttribute('content'), null); assert.equal(f.dataset.theme, 'dark');
  f.ready({ withControls: false }); assert.equal(f.meta.getAttribute('content'), '#101B26');
});

test('browser chrome metadata follows both theme and high-contrast backgrounds', () => {
  const f = fixture();
  for (const [theme, vision, background] of [
    ['light', 'standard', '#EDF3F7'], ['dark', 'standard', '#101B26'],
    ['light', 'contrast', '#FFFFFF'], ['dark', 'contrast', '#000000'],
  ]) {
    f.api.set({ theme, vision }); assert.equal(f.meta.getAttribute('content'), background);
  }
});

test('dialog focus, current selections and expanded state return to the active route control', () => {
  const f = fixture(); f.ready();
  const opener = f.opener(); opener.focus();
  const trigger = f.element('displaySettingsBtn'), dialog = f.element('displayDialog');
  assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(trigger.getAttribute('aria-controls'), 'displayDialog');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  trigger.fire('click');
  assert.equal(dialog.open, true); assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(f.document.activeElement, f.element('displayTheme'));
  assert.equal(f.events.filter(event => event.type === 'studiodisplayopen').length, 1);
  f.element('displayTheme').value = 'dark'; f.element('displayTheme').fire('change');
  f.element('displayVision').value = 'tritanopia'; f.element('displayVision').fire('change');
  assert.deepEqual(plain(f.api.get()), { theme: 'dark', vision: 'tritanopia' });
  assert.equal(f.events.filter(event => event.type === 'studiodisplayopen').length, 1);
  f.element('displayDone').fire('click');
  assert.equal(dialog.open, false); assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(f.document.activeElement, opener);
});

test('Escape closes with focus recovery and an existing modal blocks another opening', () => {
  const f = fixture(); f.ready(); const opener = f.opener(); opener.focus();
  const dialog = f.element('displayDialog'); f.element('displaySettingsBtn').fire('click');
  assert.equal(dialog.fire('cancel').defaultPrevented, true);
  assert.equal(dialog.open, false); assert.equal(f.document.activeElement, opener);
  dialog.open = true; const eventCount = f.events.length;
  f.element('displaySettingsBtn').fire('click'); assert.equal(f.events.length, eventCount);
});

test('preference/media/cross-tab updates never emit the deliberate Game-pause opening event', () => {
  const f = fixture(); f.ready();
  f.api.set({ theme: 'dark' }); f.changeSystemTheme(true);
  f.storageEvent(KEY, JSON.stringify({ theme: 'light', vision: 'contrast' }));
  assert.equal(f.events.filter(event => event.type === 'studiodisplayopen').length, 0);
});

test('Reset changes only display preferences and a removed opener falls back to the trigger', () => {
  const f = fixture({ saved: JSON.stringify({ theme: 'dark', vision: 'tritanopia' }) }); f.ready();
  const opener = f.opener(); opener.focus(); f.element('displaySettingsBtn').fire('click');
  f.element('displayReset').fire('click');
  assert.deepEqual(plain(f.api.get()), { theme: 'system', vision: 'standard' });
  assert.equal(f.element('displayTheme').value, 'system'); assert.equal(f.element('displayVision').value, 'standard');
  opener.isConnected = false; f.element('displayClose').fire('click');
  assert.equal(f.document.activeElement, f.element('displaySettingsBtn'));
});
