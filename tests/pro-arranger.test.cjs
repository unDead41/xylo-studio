const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// The actual model and arranger run against a deliberately small DOM boundary.
// These checks verify editing and focus semantics, not browser layout or sound.
function fixture(instrumentId = 'xylophone', initialEvents = []) {
  let document;
  class BoundaryNode {
    get parentNode() { return this.parentElement || null; }
    get previousSibling() {
      const siblings = this.parentNode?.childNodes || [];
      return siblings[siblings.indexOf(this) - 1] || null;
    }
  }
  class TextNode extends BoundaryNode {
    constructor(value) { super(); this.nodeType = 3; this.data = String(value); }
    get textContent() { return this.data; }
    set textContent(value) { this.data = String(value); }
  }
  class Element extends BoundaryNode {
    constructor(tag) {
      super();
      this.nodeType = 1; this.tagName = tag.toUpperCase(); this.childNodes = []; this.listeners = {}; this.attrs = {};
      this.dataset = {}; this.style = { setProperty(name, value) { this[name] = value; } };
      this.className = ''; this.value = ''; this.hidden = false; this.disabled = false;
      this.tabIndex = 0; this.scrollLeft = 0; this.ownerDocument = document;
    }
    get children() { return this.childNodes.filter(node => node.nodeType === 1); }
    get lastChild() { return this.childNodes.at(-1) || null; }
    get firstChild() { return this.childNodes[0] || null; }
    set textContent(value) { this.childNodes = []; if (String(value)) this.append(new TextNode(value)); }
    get textContent() { return this.childNodes.map(child => child.textContent).join(''); }
    append(...nodes) { for (const node of nodes) { this.childNodes.push(node); node.parentElement = this; } }
    replaceChildren(...nodes) {
      if (this.contains(document.activeElement)) document.activeElement = document.body;
      for (const child of this.childNodes) child.parentElement = null;
      this.childNodes = []; this.append(...nodes);
    }
    remove() {
      if (!this.parentElement) return;
      this.parentElement.childNodes = this.parentElement.childNodes.filter(child => child !== this);
      this.parentElement = null;
    }
    contains(node) { for (let item = node; item; item = item.parentElement) if (item === this) return true; return false; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    fire(name, detail = {}) {
      const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...detail };
      for (const fn of [...(this.listeners[name] || [])]) fn(event);
      return event;
    }
    focus() { if (!this.disabled) { document.activeElement = this; this.fire('focus'); } }
    reportValidity() { return true; }
    querySelectorAll(selector) {
      const matches = node => selector[0] === '.' ? node.className.split(' ').includes(selector.slice(1)) :
        selector === '[data-pa-key]' ? node.dataset.paKey !== undefined :
        selector === '[data-pa-playhead]' ? node.dataset.paPlayhead !== undefined : node.tagName === selector.toUpperCase();
      const result = [];
      function visit(node) { for (const child of node.children) { if (matches(child)) result.push(child); visit(child); } }
      visit(this); return result;
    }
  }
  const documentListeners = {};
  document = {
    createElement: tag => new Element(tag),
    addEventListener(name, fn) { (documentListeners[name] ||= []).push(fn); },
    removeEventListener(name, fn) { documentListeners[name] = (documentListeners[name] || []).filter(item => item !== fn); },
    dispatch(name) { for (const fn of [...(documentListeners[name] || [])]) fn({ type: name }); },
    getElementById(id) { return [document.body, ...document.body.querySelectorAll('button')].find(node => node.id === id) || null; }
  };
  document.body = new Element('body'); document.activeElement = document.body;
  document.documentElement = new Element('html'); document.documentElement.append(document.body);
  const container = document.createElement('div'); document.body.append(container);
  const context = vm.createContext({ window: {}, document, console });
  for (const filename of ['core.js', 'arranger.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../studio-pro', filename), 'utf8'), context, { filename });
  const C = context.window.ProStudioCore;
  let project = C.addTrack(C.createProject({ id: 'arranger-fixture', lengthBars: 4 }), instrumentId);
  const trackId = project.tracks[0].id;
  for (const event of initialEvents) project = C.addEvent(project, trackId, event);
  project.tracks[0].sourceTake = { schema: 'xylo-studio-take/v2', title: 'Rakam', bpm: 80, ppq: 24, instrument_id: 'xylophone', end_tick: 6, events: [{ raw_ms: 73, midi: 60, onset_tick: 0, duration_tick: 6 }], raw_capture: [{ raw_ms: 73, source: 'manual' }] };
  project = C.clone(project);
  const sourceEvidence = JSON.stringify(project.tracks[0].sourceTake);
  let selectedTrackId = trackId;
  const announcements = [], auditions = [], mutations = [];
  const app = {
    getProject: () => C.clone(project), getSelectedTrackId: () => selectedTrackId,
    selectTrack(id) { selectedTrackId = id; document.dispatch('prostudio:selection'); },
    mutate(transform, label) {
      try {
        const next = transform(C.clone(project));
        const errors = C.validate(next); if (errors.length) throw Error(errors[0]);
        project = next;
        if (!project.tracks.some(track => track.id === selectedTrackId)) selectedTrackId = project.tracks[0]?.id || null;
        mutations.push(label); document.dispatch('prostudio:change'); return true;
      } catch (error) { announcements.push(error.message); return false; }
    },
    announce: text => announcements.push(text), audition: (track, event) => auditions.push([track.id, event.id])
  };
  const view = context.window.ProStudioArranger.mount(container, app);
  const get = key => container.querySelectorAll('[data-pa-key]').find(node => node.dataset.paKey === key);
  function enableTranslation() {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    const script = html.match(/<script id="studio-i18n">([\s\S]*?)<\/script>/);
    assert.ok(script, 'The integrated inline translator must remain available.');
    vm.runInContext(script[1], context, { filename: 'studio-i18n' });
    return context.window.StudioI18n;
  }
  return { C, app, view, container, document, get, project: () => project, trackId, sourceEvidence, announcements, auditions, mutations, documentListeners, enableTranslation };
}

test('arranger limits the editor to one 16-step chromatic bar and preserves roving focus', () => {
  const s = fixture();
  assert.equal(s.container.querySelectorAll('.pa-cell').length, 13 * 16);
  assert.equal(s.container.querySelectorAll('.pa-cell').filter(node => node.tabIndex === 0).length, 1);
  assert.equal(s.container.querySelectorAll('.pa-note-label').at(-1).textContent, 'C4');
  s.get('cell-60-0').focus();
  s.get('cell-60-0').fire('keydown', { key: 'ArrowRight' });
  assert.equal(s.document.activeElement.dataset.paKey, 'cell-60-1');
  s.get('cell-60-1').fire('click');
  assert.equal(s.project().tracks[0].events[0].tick, 6);
  assert.equal(s.project().tracks[0].events[0].midi, 60);
  assert.equal(s.document.activeElement.dataset.paKey, 'cell-60-1');
  assert.equal(s.auditions.length, 1);
  assert.equal(s.get('cell-60-1').getAttribute('aria-pressed'), 'true');
  assert.equal(JSON.stringify(s.project().tracks[0].sourceTake), s.sourceEvidence);
});

test('precise inspector saves tick, gate, pitch and velocity beyond the step grid', () => {
  const s = fixture('xylophone', [{ tick: 0, midi: 60 }]);
  s.get('event-tick').value = '101'; s.get('event-duration').value = '11';
  s.get('event-voice').value = '63'; s.get('event-velocity').value = '47';
  s.get('save-event').focus();
  s.container.querySelectorAll('form')[0].fire('submit');
  const event = s.project().tracks[0].events[0];
  assert.equal(event.tick, 101); assert.equal(event.durationTick, 11); assert.equal(event.midi, 63); assert.equal(event.velocity, 0.47);
  assert.equal(s.get('bar-select').value, '1');
  assert.equal(s.document.activeElement.dataset.paKey, 'save-event');
  assert.equal(s.get('cell-63-0').getAttribute('aria-pressed'), 'true');
  assert.equal(JSON.stringify(s.project().tracks[0].sourceTake), s.sourceEvidence);
});

test('keyboard Delete removes the actual event in a step and keeps focus on that cell', () => {
  const s = fixture('xylophone', [{ tick: 5, midi: 60 }]);
  const cell = s.get('cell-60-0'); cell.focus();
  const keyboard = cell.fire('keydown', { key: 'Delete' });
  assert.equal(keyboard.defaultPrevented, true);
  assert.equal(s.project().tracks[0].events.length, 0);
  assert.equal(s.document.activeElement.dataset.paKey, 'cell-60-0');
  assert.equal(s.get('cell-60-0').getAttribute('aria-pressed'), 'false');
});

test('project rerender preserves an active inspector draft and its focus', () => {
  const s = fixture('xylophone', [{ tick: 0, midi: 60 }]);
  s.get('event-tick').value = '13'; s.get('event-tick').focus();
  s.document.dispatch('prostudio:change');
  assert.equal(s.document.activeElement.dataset.paKey, 'event-tick');
  assert.equal(s.get('event-tick').value, '13');
  assert.equal(s.project().tracks[0].events[0].tick, 0);
});

test('percussion editor has two labelled rows and edits an action without inventing MIDI', () => {
  const s = fixture('kompang');
  assert.equal(s.container.querySelectorAll('.pa-cell').length, 32);
  assert.deepEqual(s.container.querySelectorAll('.pa-note-label').map(node => node.textContent), ['Tengah', 'Tepi']);
  s.get('cell-edge-3').fire('click');
  assert.equal(s.project().tracks[0].events[0].action, 'edge');
  assert.equal(s.project().tracks[0].events[0].midi, null);
  s.get('event-voice').value = 'center';
  s.container.querySelectorAll('form')[0].fire('submit');
  assert.equal(s.project().tracks[0].events[0].action, 'center');
  assert.equal(s.get('transpose-up'), undefined);
});

test('recorder defaults to C5 and range changes stay within the real model range', () => {
  const s = fixture('recorder');
  const labels = s.container.querySelectorAll('.pa-note-label').map(node => node.textContent);
  assert.equal(labels[0], 'C6'); assert.equal(labels.at(-1), 'C5');
  s.get('pitch-range').value = '96'; s.get('pitch-range').fire('change');
  assert.equal(s.container.querySelectorAll('.pa-cell').length, 3 * 16);
  assert.equal(s.container.querySelectorAll('.pa-note-label')[0].textContent, 'D7');
});

test('changing an empty track instrument resets the editor to that instrument range', () => {
  const s = fixture('kompang');
  s.app.mutate(project => s.C.updateTrack(project, s.trackId, { instrumentId: 'recorder' }), 'Tukar instrumen');
  assert.equal(s.container.querySelectorAll('.pa-note-label').at(-1).textContent, 'C5');
  s.get('cell-72-0').fire('click');
  assert.equal(s.project().tracks[0].events[0].midi, 72);
});

test('BM/EN translation preserves literal track names while translating action labels', () => {
  const s = fixture('kompang', [{ tick: 0, action: 'center' }]);
  s.app.mutate(project => s.C.updateTrack(project, s.trackId, { name: 'Rakam' }), 'Nama khas');
  const evidence = JSON.stringify(s.project());
  const api = s.enableTranslation();
  assert.notEqual(api.t('Rakam', 'en'), 'Rakam', 'Use a real dictionary collision as the user name.');
  assert.notEqual(api.t('Tengah', 'en'), 'Tengah', 'The canonical action label must actually translate.');
  for (const language of ['en', 'ms', 'en']) {
    api.setLanguage(language);
    const name = s.container.querySelectorAll('.pa-track-choice')[0].children[0];
    assert.equal(name.textContent, '1. Rakam');
    assert.equal(name.getAttribute('data-i18n-ignore'), '');
    assert.equal(s.get('track-name').value, 'Rakam');
    assert.equal(s.container.querySelectorAll('.pa-note-label')[0].textContent, api.t('Tengah', language));
    assert.equal(s.get('remove-track').getAttribute('data-i18n-ignore'), null);
    assert.equal(JSON.stringify(s.project()), evidence);
  }
  const marker = s.container.querySelectorAll('.pa-event-marker')[0];
  assert.equal(marker.getAttribute('data-i18n-ignore'), null);
  assert.doesNotMatch(marker.getAttribute('aria-label'), /Rakam|Record/);
  s.app.mutate(project => s.C.updateTrack(project, s.trackId, { name: 'Tengah' }), 'Nama khas baharu');
  api.refresh();
  assert.equal(s.container.querySelectorAll('.pa-track-choice')[0].children[0].textContent, '1. Tengah');
  assert.equal(s.container.querySelectorAll('.pa-note-label')[0].textContent, api.t('Tengah', 'en'));
  assert.equal(JSON.stringify(s.project().tracks[0].sourceTake), s.sourceEvidence);
});

test('quantization strength and transpose use pure model edits and keep source evidence', () => {
  const s = fixture('xylophone', [{ tick: 5, midi: 60 }]);
  s.get('quantize-grid').value = '12'; s.get('quantize-grid').fire('change');
  s.get('quantize-strength').value = '50'; s.get('quantize-strength').fire('input');
  s.get('quantize-track').fire('click');
  assert.equal(s.project().tracks[0].events[0].tick, 3);
  s.get('transpose-up').fire('click');
  assert.equal(s.project().tracks[0].events[0].midi, 61);
  assert.equal(JSON.stringify(s.project().tracks[0].sourceTake), s.sourceEvidence);
});

test('a rejected model edit is not announced as successful', () => {
  const s = fixture('recorder', [{ tick: 0, midi: 72 }]);
  s.get('transpose-down').fire('click');
  assert.equal(s.project().tracks[0].events[0].midi, 72);
  assert.match(s.announcements.at(-1), /rekoder|julat|72/i);
  assert.equal(s.announcements.some(message => message === 'Nada trek diturunkan satu semiton.'), false);
});

test('track duplication selects its independent copy; deletion returns focus to a remaining track', () => {
  const s = fixture('xylophone', [{ tick: 0, midi: 60 }]);
  s.get('duplicate-track').fire('click');
  assert.equal(s.project().tracks.length, 2);
  assert.equal(s.app.getSelectedTrackId(), s.project().tracks[1].id);
  assert.notEqual(s.project().tracks[0].events[0].id, s.project().tracks[1].events[0].id);
  s.get('remove-track').fire('click');
  assert.equal(s.project().tracks.length, 1);
  assert.equal(s.document.activeElement.dataset.paKey, 'track-' + s.trackId);
});

test('playhead updates avoid rerender, internal scroll survives changes, and dispose removes listeners', () => {
  const s = fixture();
  const cell = s.get('cell-60-0');
  s.container.querySelectorAll('.pa-overview-scroll')[0].scrollLeft = 120;
  s.container.querySelectorAll('.pa-editor-scroll')[0].scrollLeft = 80;
  s.view.setPlayhead(24);
  assert.equal(s.get('cell-60-0'), cell);
  const cursor = s.container.querySelectorAll('[data-pa-playhead]')[0];
  assert.equal(cursor.style.left, '6.25%'); assert.equal(cursor.hidden, false);
  s.document.dispatch('prostudio:change');
  assert.equal(s.container.querySelectorAll('.pa-overview-scroll')[0].scrollLeft, 120);
  assert.equal(s.container.querySelectorAll('.pa-editor-scroll')[0].scrollLeft, 80);
  s.view.setPlayhead(null);
  assert.equal(s.container.querySelectorAll('[data-pa-playhead]').every(node => node.hidden), true);
  s.view.dispose(); s.view.dispose();
  assert.equal(s.container.children.length, 0);
  assert.equal(s.documentListeners['prostudio:change'].length, 0);
  assert.equal(s.documentListeners['prostudio:selection'].length, 0);
});
