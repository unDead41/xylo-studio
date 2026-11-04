(function (root) {
  'use strict';

  let instanceCount = 0;
  const rangeKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
  const percent = value => Number((value * 100).toFixed(4)) + '%';
  const panText = value => value === 0 ? 'Tengah' : (value < 0 ? 'Kiri ' : 'Kanan ') + percent(Math.abs(value));

  function mount(container, app) {
    const core = root.ProStudioCore;
    if (!container || typeof container.append !== 'function') throw new TypeError('Bekas mixer diperlukan.');
    if (!core || typeof core.updateTrack !== 'function' || typeof core.clone !== 'function') throw new Error('Teras Pro Studio belum tersedia.');
    for (const name of ['getProject', 'getSelectedTrackId', 'selectTrack', 'mutate', 'announce']) {
      if (!app || typeof app[name] !== 'function') throw new TypeError('API mixer tidak lengkap: ' + name + '.');
    }

    const doc = container.ownerDocument || root.document;
    const prefix = 'pro-mixer-' + (++instanceCount);
    const rows = new Map();
    const removers = [];
    const ranges = [];
    let disposed = false;
    let gestureCount = 0;
    let rangeCount = 0;
    let selectedId = null;
    let renderedProjectId = null;

    function element(tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function listen(node, name, fn) {
      node.addEventListener(name, fn);
      const remove = () => {
        node.removeEventListener(name, fn);
        const index = removers.indexOf(remove);
        if (index >= 0) removers.splice(index, 1);
      };
      removers.push(remove);
      return remove;
    }
    function announce(message) { if (!disposed) app.announce(message); }
    function mutate(transform, label, options) {
      if (disposed) return false;
      try {
        const result = app.mutate(transform, label, options);
        render();
        return result !== false;
      } catch (error) {
        announce(error && error.message ? error.message : 'Perubahan mixer tidak dapat disimpan.');
        render();
        return false;
      }
    }
    function getTrack(id) {
      return (app.getProject().tracks || []).find(track => track.id === id) || null;
    }
    function select(id) {
      if (!disposed && getTrack(id) && app.getSelectedTrackId() !== id) app.selectTrack(id);
    }

    const section = element('section', 'pm-mixer');
    const title = element('h2', 'pm-title', 'Mixer');
    title.id = prefix + '-title';
    title.tabIndex = -1;
    section.setAttribute('aria-labelledby', title.id);
    const header = element('div', 'pm-heading');
    header.append(title, element('p', 'pm-intro', 'Imbang tahap setiap trek dan bentuk ruang bunyinya. Pilih trek untuk menyunting kesan.'));
    const body = element('div', 'pm-body');
    const channelArea = element('div', 'pm-channel-area');
    const channelList = element('div', 'pm-channels');
    channelList.setAttribute('aria-label', 'Kawalan trek');
    const empty = element('p', 'pm-empty', 'Belum ada trek. Tambah instrumen untuk mula mengadun.');
    channelArea.append(channelList, empty);
    const sidebar = element('div', 'pm-sidebar');
    const effects = element('section', 'pm-effects');
    const effectsTitle = element('h3', 'pm-card-title', 'Kesan trek');
    effectsTitle.id = prefix + '-effects-title';
    effects.setAttribute('aria-labelledby', effectsTitle.id);
    const effectsTrack = element('p', 'pm-effects-track');
    const effectsHelp = element('details', 'pm-help');
    const helpSummary = element('summary', '', 'Tentang Reverb dan Delay');
    effectsHelp.append(helpSummary,
      element('p', '', 'Reverb menambah ekor gema ruang. Delay mengulang bunyi selepas jeda mengikut tempo projek. Nilai 0% mematikan kesan; naikkan sedikit demi sedikit untuk mengekalkan kejelasan.'),
      element('p', '', 'Kesan ini ialah sintesis digital setempat. Bisu dan Solo menentukan trek yang kedengaran; Bisu tetap mematikan trek walaupun Solo dihidupkan.'));
    const effectControls = element('div', 'pm-effect-controls');
    const reset = element('button', 'pm-reset', 'Reset kesan');
    reset.type = 'button';
    effects.append(effectsTitle, effectsTrack, effectControls, reset, effectsHelp);

    const master = element('section', 'pm-master');
    const masterTitle = element('h3', 'pm-card-title', 'Output utama');
    masterTitle.id = prefix + '-master-title';
    master.setAttribute('aria-labelledby', masterTitle.id);
    const masterControls = element('div', 'pm-master-controls');
    const meterLabel = element('div', 'pm-meter-heading');
    const meterName = element('span', '', 'Tahap output');
    meterName.id = prefix + '-meter-label';
    const meterValue = element('output', 'pm-value', '0%');
    const meter = element('meter', 'pm-meter');
    meter.min = 0;
    meter.max = 1;
    meter.value = 0;
    meter.setAttribute('aria-labelledby', meterName.id);
    meter.setAttribute('aria-valuetext', 'Tahap output 0 peratus');
    const meterHelp = element('p', 'pm-meter-help', 'Tahap isyarat projek. Kelantangan pembesar suara dilaras pada peranti.');
    meterHelp.id = prefix + '-meter-help';
    meter.setAttribute('aria-describedby', meterHelp.id);
    meterLabel.append(meterName, meterValue);
    master.append(masterTitle, masterControls, meterLabel, meter, meterHelp);
    sidebar.append(effects, master);
    body.append(channelArea, sidebar);
    section.append(header, body);
    container.append(section);

    function createRange(parent, spec) {
      const field = element('div', 'pm-control');
      const heading = element('div', 'pm-control-heading');
      const label = element('label', 'pm-control-label', spec.label);
      const input = element('input', 'pm-range');
      const output = element('output', 'pm-value');
      const control = { input, output, label, gesture: null, source: null, blocked: false, name: spec.label, value: 0, spec };
      const controlRemovers = [];
      const on = (name, fn) => controlRemovers.push(listen(input, name, fn));
      input.type = 'range';
      input.id = prefix + '-range-' + (++rangeCount);
      input.min = String(spec.min === undefined ? 0 : spec.min);
      input.max = String(spec.max === undefined ? 1 : spec.max);
      input.step = '0.01';
      label.htmlFor = input.id;
      output.setAttribute('for', input.id);
      heading.append(label, output);
      field.append(heading, input);
      if (spec.edges) {
        const edges = element('div', 'pm-pan-edges');
        edges.setAttribute('aria-hidden', 'true');
        edges.append(element('span', '', 'Kiri'), element('span', '', 'Kanan'));
        field.append(edges);
      }
      parent.append(field);
      ranges.push(control);

      function begin(source = 'input', fresh = false) {
        if (fresh) { control.blocked = false; control.gesture = null; control.source = source; }
        if (control.blocked) return;
        if (!control.gesture) {
          control.source = source;
          control.gesture = { group: 'mixer:' + spec.key() + ':' + prefix + ':' + (++gestureCount), dirty: false };
        }
      }
      function finish() {
        const gesture = control.gesture;
        control.gesture = null;
        control.source = null;
        control.blocked = false;
        if (gesture && gesture.dirty) announce(control.name + ': ' + spec.format(control.value) + '.');
      }
      control.finish = finish;
      control.interrupt = () => {
        // A held pointer/key must not continue an edit after its target or value
        // was replaced elsewhere. The next physical gesture starts a new edit.
        control.blocked = control.blocked || Boolean(control.gesture || control.source);
        control.gesture = null;
      };
      control.dispose = () => {
        controlRemovers.splice(0).forEach(remove => remove());
        const index = ranges.indexOf(control);
        if (index >= 0) ranges.splice(index, 1);
      };
      on('focus', () => { if (spec.select) spec.select(); });
      on('pointerdown', () => begin('pointer', true));
      on('keydown', event => { if (rangeKeys.has(event.key)) begin('keyboard', !event.repeat); });
      on('keyup', event => { if (rangeKeys.has(event.key)) finish(); });
      // Native ranges emit change on every keyboard step, including repeats.
      on('change', () => { if (control.source !== 'keyboard') finish(); });
      on('blur', finish);
      on('input', () => {
        if (input.disabled || control.blocked) { render(); return; }
        const value = Number(input.value);
        if (!Number.isFinite(value) || value < Number(input.min) || value > Number(input.max)) return;
        begin();
        const gesture = control.gesture;
        control.value = value;
        output.textContent = spec.format(value);
        input.setAttribute('aria-valuetext', spec.format(value));
        if (spec.apply(value, { historyGroup: gesture.group, merge: true })) {
          if (control.gesture === gesture) gesture.dirty = true;
        } else { control.interrupt(); render(); }
      });
      return control;
    }

    function syncRange(control, value, label, enabled) {
      control.name = label;
      control.label.textContent = control.spec.label;
      control.input.setAttribute('aria-label', label);
      control.input.disabled = !enabled;
      if (control.gesture && control.value !== value) control.interrupt();
      control.value = value;
      if (Number(control.input.value) !== value || control.input.value === '') control.input.value = String(value);
      control.output.textContent = control.spec.format(control.value);
      control.input.setAttribute('aria-valuetext', control.spec.format(control.value));
    }

    function trackPatch(id, patch, label, options) {
      if (!getTrack(id)) return false;
      return mutate(project => core.updateTrack(project, id, patch), label, options);
    }

    function createChannel(id) {
      const node = element('article', 'pm-channel');
      node.dataset.trackId = id;
      const heading = element('h3', 'pm-channel-title');
      const choose = element('button', 'pm-select');
      choose.type = 'button';
      const name = element('span', 'pm-track-name');
      name.setAttribute('data-i18n-ignore', '');
      const selected = element('span', 'pm-selected-mark', 'Dipilih');
      choose.append(name, selected);
      heading.append(choose);
      const instrument = element('p', 'pm-instrument');
      const controls = element('div', 'pm-track-controls');
      const toggles = element('div', 'pm-toggles');
      const mute = element('button', 'pm-toggle', 'Bisu');
      const solo = element('button', 'pm-toggle', 'Solo');
      mute.type = solo.type = 'button';
      const state = element('p', 'pm-channel-state');
      const channelRemovers = [];
      toggles.append(mute, solo);
      node.append(heading, instrument, controls, toggles, state);
      channelRemovers.push(listen(choose, 'click', () => select(id)));
      channelRemovers.push(listen(mute, 'click', () => {
        const track = getTrack(id);
        if (!track) return;
        select(id);
        if (trackPatch(id, { muted: !track.muted }, 'Bisu ' + track.name)) announce(track.name + (track.muted ? ' dibunyikan.' : ' dibisukan.'));
      }));
      channelRemovers.push(listen(solo, 'click', () => {
        const track = getTrack(id);
        if (!track) return;
        select(id);
        if (trackPatch(id, { solo: !track.solo }, 'Solo ' + track.name)) announce('Solo ' + track.name + (track.solo ? ' dimatikan.' : ' dihidupkan.'));
      }));
      const volume = createRange(controls, {
        label: 'Tahap', key: () => id + ':volume', format: percent, select: () => select(id),
        apply: (value, options) => trackPatch(id, { volume: value }, 'Tahap ' + (getTrack(id) || { name: 'trek' }).name, options)
      });
      const pan = createRange(controls, {
        label: 'Pan', key: () => id + ':pan', min: -1, max: 1, format: panText, edges: true, select: () => select(id),
        apply: (value, options) => trackPatch(id, { pan: value }, 'Pan ' + (getTrack(id) || { name: 'trek' }).name, options)
      });
      const dispose = () => {
        volume.interrupt();
        pan.interrupt();
        volume.dispose();
        pan.dispose();
        channelRemovers.splice(0).forEach(remove => remove());
      };
      return { node, choose, name, selected, instrument, mute, solo, state, volume, pan, dispose };
    }

    const effectRanges = {};
    for (const [field, label] of [['reverb', 'Reverb'], ['delay', 'Delay']]) {
      effectRanges[field] = createRange(effectControls, {
        label, key: () => selectedId + ':' + field, format: percent,
        apply: (value, options) => selectedId !== null && trackPatch(selectedId, { [field]: value }, label + ' ' + (getTrack(selectedId) || { name: 'trek' }).name, options)
      });
    }
    const masterVolume = createRange(masterControls, {
      label: 'Tahap utama', key: () => 'master:volume', format: percent,
      apply: (value, options) => mutate(project => {
        if (typeof core.updateProject === 'function') return core.updateProject(project, { master: { volume: value } });
        const copy = core.clone(project);
        copy.master = Object.assign({}, copy.master, { volume: value });
        return copy;
      }, 'Tahap utama', options)
    });
    listen(reset, 'click', () => {
      const track = getTrack(selectedId);
      if (track && trackPatch(track.id, { reverb: 0, delay: 0 }, 'Reset kesan ' + track.name)) announce('Kesan ' + track.name + ' direset kepada 0%.');
    });
    const finishPointers = () => ranges.forEach(control => { if (control.source === 'pointer') control.finish(); });
    listen(doc, 'pointerup', finishPointers);
    listen(doc, 'pointercancel', finishPointers);

    function render() {
      if (disposed) return;
      const project = app.getProject();
      if (renderedProjectId !== null && renderedProjectId !== project.id) ranges.forEach(control => control.interrupt());
      renderedProjectId = project.id;
      const tracks = project.tracks || [];
      const requestedId = app.getSelectedTrackId();
      const selectedTrack = tracks.find(track => track.id === requestedId) || tracks[0] || null;
      const nextSelectedId = selectedTrack ? selectedTrack.id : null;
      if (selectedId !== nextSelectedId) Object.values(effectRanges).forEach(control => control.interrupt());
      selectedId = nextSelectedId;
      const ids = new Set(tracks.map(track => track.id));
      let restoreFocus = false;
      for (const [id, row] of rows) {
        if (!ids.has(id)) {
          if (doc.activeElement && row.node.contains(doc.activeElement)) restoreFocus = true;
          row.dispose();
          row.node.remove();
          rows.delete(id);
        }
      }
      const hasSolo = tracks.some(track => track.solo);
      tracks.forEach((track, index) => {
        let row = rows.get(track.id);
        if (!row) { row = createChannel(track.id); rows.set(track.id, row); }
        // Existing nodes remain in place during input, preserving drag and focus.
        if (channelList.children[index] !== row.node) channelList.insertBefore(row.node, channelList.children[index] || null);
        const isSelected = track.id === selectedId;
        row.node.classList.toggle('is-selected', isSelected);
        row.node.classList.toggle('is-silent', Boolean(track.muted || (hasSolo && !track.solo)));
        row.choose.setAttribute('aria-pressed', String(isSelected));
        row.choose.setAttribute('aria-label', 'Pilih trek ' + track.name);
        row.name.textContent = track.name;
        row.selected.hidden = !isSelected;
        const instrument = core.INSTRUMENTS && core.INSTRUMENTS[track.instrumentId];
        row.instrument.textContent = instrument && instrument.label ? instrument.label : track.instrumentId;
        row.mute.setAttribute('aria-pressed', String(Boolean(track.muted)));
        row.solo.setAttribute('aria-pressed', String(Boolean(track.solo)));
        row.mute.textContent = track.muted ? 'Bisu aktif' : 'Bisu';
        row.solo.textContent = track.solo ? 'Solo aktif' : 'Solo';
        row.mute.setAttribute('aria-label', 'Bisu ' + track.name);
        row.solo.setAttribute('aria-label', 'Solo ' + track.name);
        row.state.textContent = track.muted ? 'Dibisukan' : hasSolo && !track.solo ? 'Senyap: trek lain dalam Solo' : track.solo ? 'Solo aktif' : 'Dalam adunan';
        syncRange(row.volume, track.volume, 'Tahap ' + track.name, true);
        syncRange(row.pan, track.pan, 'Pan ' + track.name, true);
      });
      empty.hidden = tracks.length > 0;
      channelList.hidden = tracks.length === 0;
      if (selectedTrack) effectsTrack.setAttribute('data-i18n-ignore', '');
      else effectsTrack.removeAttribute('data-i18n-ignore');
      effectsTrack.textContent = selectedTrack ? selectedTrack.name : 'Pilih trek selepas menambah instrumen.';
      for (const [field, label] of [['reverb', 'Reverb'], ['delay', 'Delay']]) {
        syncRange(effectRanges[field], selectedTrack ? selectedTrack[field] : 0, selectedTrack ? label + ' ' + selectedTrack.name : label, Boolean(selectedTrack));
      }
      reset.disabled = !selectedTrack || (selectedTrack.reverb === 0 && selectedTrack.delay === 0);
      reset.setAttribute('aria-label', selectedTrack ? 'Reset Reverb dan Delay ' + selectedTrack.name : 'Reset kesan');
      syncRange(masterVolume, project.master ? project.master.volume : 1, 'Tahap utama', true);
      if (restoreFocus) {
        const target = selectedId !== null && rows.get(selectedId);
        (target ? target.choose : title).focus();
      }
    }

    function setLevel(level) {
      if (disposed) return;
      // The engine supplies the amplitude. No timer or decorative meter motion.
      const value = typeof level === 'number' && Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
      meter.value = value;
      meterValue.textContent = percent(value);
      meter.setAttribute('aria-valuetext', 'Tahap output ' + Number((value * 100).toFixed(4)) + ' peratus');
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      removers.splice(0).forEach(remove => remove());
      rows.clear();
      section.remove();
    }
    listen(doc, 'prostudio:change', render);
    listen(doc, 'prostudio:selection', render);
    render();
    return { render, setLevel, dispose };
  }

  root.ProStudioMixer = Object.freeze({ mount });
})(typeof window !== 'undefined' ? window : globalThis);
