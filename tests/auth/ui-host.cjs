const vm = require('node:vm');
const { source, settle } = require('./helpers.cjs');

// A DOM boundary for controller behavior only. Native dialog layout, pointer
// hit-testing, tab order, and browser focus behavior still require a browser.
function uiHost(options = {}) {
  const listeners = new Map();
  let doc;

  function matchesSimple(node, selector) {
    if (!node || node.nodeType !== 1) return false;
    let part = selector.trim();
    const negative = [...part.matchAll(/:not\(([^)]+)\)/g)].map(match => match[1]);
    part = part.replace(/:not\([^)]+\)/g, '');
    if (negative.some(exclusion => matchesSimple(node, exclusion))) return false;
    const tag = part.match(/^[a-z][a-z\d-]*/i)?.[0];
    if (tag && node.tagName !== tag.toUpperCase()) return false;
    for (const match of part.matchAll(/#([\w-]+)/g)) if (node.id !== match[1]) return false;
    for (const match of part.matchAll(/\.([\w-]+)/g)) if (!node.className.split(/\s+/).includes(match[1])) return false;
    for (const match of part.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)) {
      if (!node.hasAttribute(match[1])) return false;
      if (match[2] !== undefined && node.getAttribute(match[1]) !== match[2]) return false;
    }
    return true;
  }
  function matches(node, selector) {
    return selector.split(',').some(group => {
      const parts = group.trim().split(/\s+(?![^\[]*\])/);
      if (!matchesSimple(node, parts.pop())) return false;
      let cursor = node.parentElement;
      for (let i = parts.length - 1; i >= 0; i--) {
        while (cursor && !matchesSimple(cursor, parts[i])) cursor = cursor.parentElement;
        if (!cursor) return false;
        cursor = cursor.parentElement;
      }
      return true;
    });
  }
  function handlers(target) {
    if (!listeners.has(target)) listeners.set(target, new Map());
    return listeners.get(target);
  }
  function addEventListener(type, callback) {
    const map = handlers(this);
    if (!map.has(type)) map.set(type, new Set());
    map.get(type).add(callback);
  }
  function removeEventListener(type, callback) { handlers(this).get(type)?.delete(callback); }
  async function fire(type, extra = {}) {
    const event = {
      type, target: this, currentTarget: this, defaultPrevented: false, propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; }, ...extra,
    };
    for (const callback of handlers(this).get(type) || []) await callback(event);
    await settle();
    return event;
  }
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.nodeType = 1;
      this.children = []; this.attributes = new Map(); this.parentElement = null;
      this._text = ''; this.value = ''; this.open = false; this.focusCalls = 0;
      this.classList = {
        add: (...values) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...values])].join(' '); },
        remove: (...values) => { this.className = this.className.split(/\s+/).filter(value => !values.includes(value)).join(' '); },
        contains: value => this.className.split(/\s+/).includes(value),
      };
    }
    get id() { return this.getAttribute('id') || ''; }
    set id(value) { this.setAttribute('id', value); }
    get className() { return this.getAttribute('class') || ''; }
    set className(value) { this.setAttribute('class', value); }
    get type() { return this.getAttribute('type') || (this.tagName === 'INPUT' ? 'text' : ''); }
    set type(value) { this.setAttribute('type', value); }
    get value() { return this._value || ''; }
    set value(value) { this._value = this.type === 'email' ? String(value).replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '') : String(value); }
    get hidden() { return this.hasAttribute('hidden'); }
    set hidden(value) { this.toggleAttribute('hidden', value); }
    get disabled() { return this.hasAttribute('disabled'); }
    set disabled(value) { this.toggleAttribute('disabled', value); }
    get required() { return this.hasAttribute('required'); }
    set required(value) { this.toggleAttribute('required', value); }
    get inert() { return this.hasAttribute('inert'); }
    set inert(value) { this.toggleAttribute('inert', value); }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this._text = String(value); for (const child of this.children) child.parentElement = null; this.children = []; }
    get isConnected() { return this === doc.body || Boolean(this.parentElement?.isConnected); }
    get validity() { return { typeMismatch: this.type === 'email' && Boolean(this.value) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value) }; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    toggleAttribute(name, active) { if (active) this.setAttribute(name, ''); else this.removeAttribute(name); }
    append(...nodes) { for (const node of nodes) this.appendChild(node); }
    appendChild(node) { node.remove(); node.parentElement = this; this.children.push(node); return node; }
    insertBefore(node, before) {
      node.remove(); node.parentElement = this;
      const index = this.children.indexOf(before);
      if (index < 0) throw new Error('insertBefore target is not a child');
      this.children.splice(index, 0, node); return node;
    }
    remove() {
      if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
      this.parentElement = null;
    }
    matches(selector) { return matches(this, selector); }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    querySelectorAll(selector) {
      const result = [];
      const visit = node => { for (const child of node.children) { if (child.matches(selector)) result.push(child); visit(child); } };
      visit(this); return result;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    focus() { this.focusCalls++; doc.activeElement = this; }
    showModal() { this.open = true; this.setAttribute('open', ''); }
    close() { this.open = false; this.removeAttribute('open'); for (const callback of handlers(this).get('close') || []) callback({ target: this }); }
    getBoundingClientRect() { return { left: 100, right: 500, top: 100, bottom: 600, width: 400, height: 500 }; }
  }
  Object.assign(Element.prototype, { addEventListener, removeEventListener, fire });
  doc = {
    activeElement: null,
    createElement: tag => new Element(tag),
    createElementNS: (_, tag) => new Element(tag),
    addEventListener, removeEventListener, fire,
    querySelector: selector => doc.body.matches(selector) ? doc.body : doc.body.querySelector(selector),
    querySelectorAll: selector => doc.body.querySelectorAll(selector),
    getElementById: id => doc.body.querySelector('#' + id),
  };
  doc.body = new Element('body');
  const header = doc.createElement('header'); header.className = 'header';
  const headerInner = doc.createElement('div'); headerInner.className = 'header-inner'; header.appendChild(headerInner);
  const guest = doc.createElement('button'); guest.id = 'guestInstrument'; guest.textContent = 'Play instrument';
  doc.body.append(header, guest); guest.focus();
  const box = { document: doc, console, setTimeout, clearTimeout };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(source('auth-ui', 'assets/auth/auth-ui.js'), box, { filename: 'inline-auth-ui.js' });
  const calls = [];
  const ui = box.InstruAuthUI.createAuthUI({
    document: doc, state: { ready: true },
    onSubmit: async (action, values) => { calls.push({ action, values }); return { ok: true, message: 'Request completed.' }; },
    ...options,
  });
  ui.mount();
  return {
    doc, ui, guest, calls,
    byId: id => {
      const node = doc.getElementById(id);
      if (!node) throw new Error('Missing element #' + id);
      return node;
    },
    async submit(id, values) {
      const form = doc.getElementById(id);
      for (const [name, value] of Object.entries(values)) {
        const input = form.querySelector('[name="' + name + '"]');
        if (!input) throw new Error('Missing form field ' + name);
        input.value = value;
      }
      await form.fire('submit');
    },
  };
}

module.exports = { uiHost };
