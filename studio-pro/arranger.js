(function (global) {
  'use strict';

  const BAR_TICKS = 96;
  const STEP_TICKS = 6;
  const STEPS = 16;
  const COLORS = ['#126B66', '#5273A6', '#96663C', '#835D91', '#397B85', '#8F5D65', '#667D3B', '#79684C'];
  const FALLBACKS = {
    xylophone: { label: 'Xylophone', pitched: true, minMidi: 1, maxMidi: 127, defaultMidi: 60, actions: [] },
    recorder: { label: 'Rekoder soprano', pitched: true, minMidi: 72, maxMidi: 98, defaultMidi: 72, actions: [] },
    tamborin: { label: 'Tamborin', actions: ['tap', 'shake'] },
    kompang: { label: 'Kompang', actions: ['center', 'edge'] },
    snare: { label: 'Dram Sisi', actions: ['hit', 'rim'] },
    bass_drum: { label: 'Dram Bes', actions: ['hit', 'soft'] },
    cymbals: { label: 'Simbal', actions: ['crash', 'soft'] },
    triangle: { label: 'Segi Tiga', actions: ['open', 'muted'] }
  };
  const ACTION_LABELS = { tap: 'Ketuk', shake: 'Goncang', center: 'Tengah', edge: 'Tepi', hit: 'Ketuk kuat', rim: 'Ketuk rim', soft: 'Ketuk lembut', crash: 'Laga kuat', open: 'Terbuka', muted: 'Redam' };

  function el(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function noteName(midi) {
    const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    return names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  }

  function mount(container, app) {
    if (!container || !app || typeof app.getProject !== 'function' || typeof app.mutate !== 'function') {
      throw new Error('Susunan memerlukan bekas dan projek studio.');
    }
    const C = global.ProStudioCore;
    if (!C) throw new Error('Model Studio Pro belum tersedia.');
    const doc = container.ownerDocument || global.document;
    const root = el(doc, 'section', 'pro-arranger');
    root.setAttribute('aria-label', 'Susunan berbilang trek');
    container.append(root);
    let disposed = false;
    let lastTrackId = null;
    let lastInstrumentId = null;
    let selectedEventId = null;
    let bar = 0;
    let gridValue = null;
    let gridStep = 0;
    let rangeBase = null;
    let quantizeGrid = 6;
    let quantizeStrength = 100;
    let playhead = null;
    let pendingFocus = null;
    let errorNode = null;
    let overviewScroll = null;
    let editorScroll = null;
    let matrix = null;
    let gridButtons = [];
    let playheadNodes = [];
    let totalTicks = BAR_TICKS;

    const descriptors = () => C.INSTRUMENTS || FALLBACKS;
    const descriptor = track => descriptors()[track.instrumentId] || FALLBACKS[track.instrumentId] || FALLBACKS.xylophone;
    const isPitched = desc => desc.pitched === true || desc.kind === 'pitched';
    const actionLabel = (desc, action) => (desc.actionLabels && desc.actionLabels[action]) || ACTION_LABELS[action] || action;
    const eventName = (track, event) => isPitched(descriptor(track)) ? noteName(event.midi) : actionLabel(descriptor(track), event.action);
    const projectTicks = project => Math.max(1, Number(project.lengthBars) || 1) * BAR_TICKS;
    const trackEvents = track => [...(track.events || [])].sort((a, b) => a.tick - b.tick || String(a.id).localeCompare(String(b.id)));
    const inBar = event => event.tick >= bar * BAR_TICKS && event.tick < (bar + 1) * BAR_TICKS;
    const key = (node, value) => { node.dataset.paKey = value; return node; };

    function button(text, className, onClick, focusKey) {
      const node = el(doc, 'button', className || 'pa-button', text);
      node.type = 'button';
      if (focusKey) key(node, focusKey);
      if (onClick) node.addEventListener('click', onClick);
      return node;
    }

    function option(select, value, text) {
      const item = el(doc, 'option', '', text);
      item.value = String(value);
      select.append(item);
    }

    function field(label, control, className) {
      const wrap = el(doc, 'label', 'pa-field' + (className ? ' ' + className : ''));
      wrap.append(el(doc, 'span', 'pa-field-label', label), control);
      return wrap;
    }

    function announce(message) {
      if (typeof app.announce === 'function') app.announce(message);
    }

    function fail(error) {
      const message = error && error.message ? error.message : String(error);
      if (errorNode) { errorNode.textContent = message; errorNode.hidden = false; }
      announce(message);
    }

    function commit(transform, label) {
      try {
        const accepted = app.mutate(transform, label);
        if (accepted === false) { pendingFocus = null; return false; }
        render();
        announce(label + '.');
        return true;
      } catch (error) {
        pendingFocus = null;
        fail(error);
        return false;
      }
    }

    function captureFocus() {
      const active = doc.activeElement;
      if (!active || !root.contains(active)) return null;
      const result = { key: active.dataset && active.dataset.paKey, trackId: lastTrackId, eventId: selectedEventId, value: active.value };
      try {
        if (typeof active.selectionStart === 'number') {
          result.start = active.selectionStart;
          result.end = active.selectionEnd;
        }
      } catch (_) { /* Number inputs do not expose a selection. */ }
      return result;
    }

    function restoreFocus(saved) {
      const wanted = pendingFocus || (saved && saved.key);
      pendingFocus = null;
      if (!wanted) return;
      const node = [...root.querySelectorAll('[data-pa-key]')].find(item => item.dataset.paKey === wanted);
      if (!node || node.disabled) return;
      if (saved && saved.key === wanted && saved.trackId === lastTrackId &&
        (wanted === 'track-name' || (saved.eventId === selectedEventId && /^event-(tick|duration|voice|velocity)$/.test(wanted)))) {
        node.value = saved.value;
      }
      try { node.focus({ preventScroll: true }); } catch (_) { node.focus(); }
      if (saved && saved.key === wanted && saved.start !== undefined && typeof node.setSelectionRange === 'function') {
        try { node.setSelectionRange(saved.start, saved.end); } catch (_) { /* Native number/select control. */ }
      }
    }

    function selectEvent(track, event, audition) {
      selectedEventId = event.id;
      bar = Math.floor(event.tick / BAR_TICKS);
      gridStep = Math.min(STEPS - 1, Math.floor((event.tick % BAR_TICKS) / STEP_TICKS));
      gridValue = isPitched(descriptor(track)) ? event.midi : event.action;
      if (isPitched(descriptor(track)) && (event.midi < rangeBase || event.midi > rangeBase + 12)) {
        rangeBase = Math.max(descriptor(track).minMidi || 1, Math.min(descriptor(track).maxMidi - 12, Math.floor(event.midi / 12) * 12));
      }
      if (typeof app.selectTrack === 'function' && app.getSelectedTrackId() !== track.id) app.selectTrack(track.id);
      render();
      if (audition && typeof app.audition === 'function') app.audition(track, event);
    }

    function setBar(value) {
      const project = app.getProject();
      bar = Math.max(0, Math.min(project.lengthBars - 1, value));
      selectedEventId = null;
      render();
    }

    function removeEvent(track, event, focusKey) {
      pendingFocus = focusKey || 'event-select';
      commit(project => C.removeEvent(project, track.id, event.id), 'Not dibuang');
    }

    function addEvent(track, value, step) {
      const pitched = isPitched(descriptor(track));
      gridValue = value;
      gridStep = step;
      const event = { tick: bar * BAR_TICKS + step * STEP_TICKS, durationTick: STEP_TICKS, velocity: 0.8 };
      if (pitched) event.midi = value;
      else event.action = value;
      const succeeded = commit(project => {
        const before = new Set(project.tracks.find(item => item.id === track.id).events.map(item => item.id));
        const next = C.addEvent(project, track.id, event);
        const added = next.tracks.find(item => item.id === track.id).events.find(item => !before.has(item.id));
        selectedEventId = added ? added.id : null;
        return next;
      }, pitched ? 'Not ditambah' : 'Ketukan ditambah');
      if (succeeded && typeof app.audition === 'function') {
        const current = app.getProject().tracks.find(item => item.id === track.id);
        const added = current && current.events.find(item => item.id === selectedEventId);
        if (added) app.audition(current, added);
      }
    }

    function renderOverview(project, selectedTrack) {
      overviewScroll = el(doc, 'div', 'pa-overview-scroll');
      overviewScroll.setAttribute('role', 'region');
      overviewScroll.setAttribute('aria-label', 'Garis masa semua trek; tatal mendatar untuk melihat bar lain');
      overviewScroll.tabIndex = 0;
      key(overviewScroll, 'overview-scroll');
      const overview = el(doc, 'div', 'pa-overview');
      overview.style.minWidth = (152 + Math.max(432, project.lengthBars * 64)) + 'px';
      const ruler = el(doc, 'div', 'pa-overview-row pa-ruler');
      ruler.append(el(doc, 'span', 'pa-ruler-title', 'Trek / bar'));
      const bars = el(doc, 'div', 'pa-bars');
      bars.style.gridTemplateColumns = 'repeat(' + project.lengthBars + ', minmax(0, 1fr))';
      for (let i = 0; i < project.lengthBars; i++) {
        const label = el(doc, 'span', 'pa-bar-number' + (i === bar ? ' is-current' : ''), i + 1);
        label.setAttribute('aria-hidden', 'true');
        bars.append(label);
      }
      ruler.append(bars);
      overview.append(ruler);
      project.tracks.forEach((track, index) => {
        const row = el(doc, 'div', 'pa-overview-row' + (selectedTrack && track.id === selectedTrack.id ? ' is-selected' : ''));
        row.style.setProperty('--pa-color', COLORS[index % COLORS.length]);
        const choose = button('', 'pa-track-choice', () => {
          if (typeof app.selectTrack === 'function') app.selectTrack(track.id);
          render();
        }, 'track-' + track.id);
        choose.setAttribute('aria-pressed', String(!!selectedTrack && track.id === selectedTrack.id));
        const trackName = el(doc, 'strong', '', (index + 1) + '. ' + track.name);
        trackName.setAttribute('data-i18n-ignore', '');
        choose.append(trackName, el(doc, 'small', '', descriptor(track).label + ' · ' + track.events.length + ' not'));
        row.append(choose);
        const lane = el(doc, 'div', 'pa-track-lane');
        lane.style.backgroundSize = (100 / project.lengthBars) + '% 100%';
        const currentBar = el(doc, 'span', 'pa-current-bar');
        currentBar.style.left = (bar / project.lengthBars * 100) + '%';
        currentBar.style.width = (100 / project.lengthBars) + '%';
        currentBar.setAttribute('aria-hidden', 'true');
        lane.append(currentBar);
        for (const event of trackEvents(track)) {
          const name = eventName(track, event);
          const marker = button('', 'pa-event-marker' + (!isPitched(descriptor(track)) ? ' is-percussion' : '') + (track.id === (selectedTrack && selectedTrack.id) && event.id === selectedEventId ? ' is-selected' : ''), () => {
            // Selecting a different track can emit a synchronous selection event.
            if (typeof app.selectTrack === 'function') app.selectTrack(track.id);
            selectEvent(track, event, true);
          }, 'overview-event-' + track.id + '-' + event.id);
          marker.style.left = (event.tick / projectTicks(project) * 100) + '%';
          marker.style.width = Math.max(0.12, event.durationTick / projectTicks(project) * 100) + '%';
          marker.style.top = (8 + (isPitched(descriptor(track)) ? (127 - event.midi) % 3 : Math.max(0, descriptor(track).actions.indexOf(event.action))) * 9) + 'px';
          marker.tabIndex = -1;
          marker.title = 'Trek ' + (index + 1) + ' · ' + name + ' · tick ' + event.tick + ' · tempoh ' + event.durationTick;
          marker.setAttribute('aria-label', marker.title);
          lane.append(marker);
        }
        const cursor = el(doc, 'span', 'pa-playhead');
        cursor.dataset.paPlayhead = 'overview';
        cursor.setAttribute('aria-hidden', 'true');
        playheadNodes.push(cursor);
        lane.append(cursor);
        row.append(lane);
        overview.append(row);
      });
      overviewScroll.append(overview);
      root.append(overviewScroll);
    }

    function renderTrackTools(project, track) {
      const tools = el(doc, 'div', 'pa-track-tools');
      const name = key(el(doc, 'input', 'pa-name-input'), 'track-name');
      name.type = 'text';
      name.value = track.name;
      name.maxLength = 60;
      name.setAttribute('aria-label', 'Nama trek terpilih');
      name.addEventListener('change', () => commit(current => C.updateTrack(current, track.id, { name: name.value }), 'Nama trek dikemas kini'));
      tools.append(name);
      const actions = el(doc, 'div', 'pa-button-row');
      const duplicate = button('Gandakan trek', 'pa-button', () => {
        let duplicateId;
        if (commit(current => {
          const ids = new Set(current.tracks.map(item => item.id));
          const next = C.duplicateTrack(current, track.id);
          duplicateId = next.tracks.find(item => !ids.has(item.id)).id;
          return next;
        }, 'Trek digandakan') && typeof app.selectTrack === 'function') app.selectTrack(duplicateId);
      }, 'duplicate-track');
      duplicate.disabled = project.tracks.length >= 8;
      const remove = button('Buang trek', 'pa-button pa-destructive', () => {
        let empty = false;
        const accepted = commit(current => {
          const next = C.removeTrack(current, track.id);
          empty = next.tracks.length === 0;
          pendingFocus = empty ? null : 'track-' + next.tracks[0].id;
          return next;
        }, 'Trek dibuang');
        if (accepted && empty) {
          const add = doc.getElementById('proAddTrack');
          if (add) add.focus();
        }
      }, 'remove-track');
      actions.append(duplicate, remove);
      tools.append(actions);
      root.append(tools);
    }

    function renderEditor(project, track) {
      const desc = descriptor(track);
      const pitched = isPitched(desc);
      const editor = el(doc, 'div', 'pa-editor');
      const heading = el(doc, 'div', 'pa-editor-heading');
      heading.append(el(doc, 'h3', '', pitched ? 'Editor not' : 'Editor ketukan'));
      const navigation = el(doc, 'div', 'pa-bar-navigation');
      const previous = button('Sebelum', 'pa-button pa-compact', () => setBar(bar - 1), 'previous-bar');
      previous.disabled = bar === 0;
      previous.setAttribute('aria-label', 'Bar sebelumnya');
      const barSelect = key(el(doc, 'select', 'pa-bar-select'), 'bar-select');
      barSelect.setAttribute('aria-label', 'Bar yang disunting');
      for (let i = 0; i < project.lengthBars; i++) option(barSelect, i, 'Bar ' + (i + 1) + ' / ' + project.lengthBars);
      barSelect.value = String(bar);
      barSelect.addEventListener('change', () => setBar(Number(barSelect.value)));
      const next = button('Selepas', 'pa-button pa-compact', () => setBar(bar + 1), 'next-bar');
      next.disabled = bar >= project.lengthBars - 1;
      next.setAttribute('aria-label', 'Bar seterusnya');
      navigation.append(previous, barSelect, next);
      heading.append(navigation);
      editor.append(heading);
      const settings = el(doc, 'div', 'pa-grid-settings');
      settings.append(el(doc, 'p', 'pa-small-text', '16 langkah / bar · 6 tick / langkah'));
      if (pitched) {
        const ranges = key(el(doc, 'select', 'pa-range-select'), 'pitch-range');
        const bases = new Set([rangeBase]);
        for (let midi = 12; midi <= 120; midi += 12) if (midi >= desc.minMidi && midi <= desc.maxMidi) bases.add(midi);
        for (const base of [...bases].sort((a, b) => a - b)) option(ranges, base, noteName(base) + '–' + noteName(Math.min(desc.maxMidi, base + 12)));
        ranges.value = String(rangeBase);
        ranges.setAttribute('aria-label', 'Julat nada editor');
        ranges.addEventListener('change', () => { rangeBase = Number(ranges.value); gridValue = rangeBase; render(); });
        settings.append(field('Julat nada', ranges, 'pa-inline-field'));
      }
      editor.append(settings);
      const hint = el(doc, 'p', 'pa-grid-hint', 'Klik ruang kosong untuk tambah; pilih not untuk sunting. Anak panah: gerak fokus. Delete: buang not pada ruang itu.');
      editor.append(hint);
      editorScroll = el(doc, 'div', 'pa-editor-scroll');
      editorScroll.setAttribute('role', 'region');
      editorScroll.setAttribute('aria-label', 'Grid satu bar; tatal mendatar untuk semua 16 langkah');
      matrix = el(doc, 'div', 'pa-note-grid');
      matrix.setAttribute('role', 'group');
      matrix.setAttribute('aria-label', 'Bar ' + (bar + 1) + ', grid 16 langkah');
      const corner = el(doc, 'span', 'pa-grid-corner', pitched ? 'Nada' : 'Tindakan');
      corner.setAttribute('aria-hidden', 'true');
      matrix.append(corner);
      for (let step = 0; step < STEPS; step++) {
        const number = el(doc, 'span', 'pa-step-number' + (step % 4 === 0 ? ' is-beat' : ''), step + 1);
        number.setAttribute('aria-hidden', 'true');
        matrix.append(number);
      }
      const rows = pitched ? Array.from({ length: Math.min(13, desc.maxMidi - rangeBase + 1) }, (_, i) => Math.min(desc.maxMidi, rangeBase + 12) - i) : desc.actions;
      if (!rows.includes(gridValue)) gridValue = pitched ? rangeBase : rows[0];
      gridButtons = [];
      const events = trackEvents(track).filter(inBar);
      rows.forEach((value, rowIndex) => {
        const label = pitched ? noteName(value) : actionLabel(desc, value);
        const rowLabel = el(doc, 'span', 'pa-note-label' + (pitched && label.includes('♯') ? ' is-sharp' : ''), label);
        rowLabel.setAttribute('aria-hidden', 'true');
        matrix.append(rowLabel);
        for (let step = 0; step < STEPS; step++) {
          const tick = bar * BAR_TICKS + step * STEP_TICKS;
          const cellEvents = events.filter(event => (pitched ? event.midi === value : event.action === value) && event.tick >= tick && event.tick < tick + STEP_TICKS);
          const event = cellEvents.find(item => item.id === selectedEventId) || cellEvents[0];
          const cell = button(cellEvents.length > 1 ? cellEvents.length : '', 'pa-cell' + (step % 4 === 0 ? ' is-beat' : '') + (event ? ' is-filled' : '') + (cellEvents.some(item => item.id === selectedEventId) ? ' is-selected' : ''), () => {
            if (event) selectEvent(track, event, true);
            else addEvent(track, value, step);
          }, 'cell-' + value + '-' + step);
          cell.tabIndex = gridValue === value && gridStep === step ? 0 : -1;
          cell.setAttribute('aria-pressed', String(!!event));
          cell.setAttribute('aria-label', label + ', bar ' + (bar + 1) + ', langkah ' + (step + 1) + ', tick ' + tick + (event ? ', ' + cellEvents.length + ' not; pilih untuk sunting' : '; tambah not'));
          cell.title = event ? label + ' · tick ' + event.tick + ' · tempoh ' + event.durationTick + ' · kekuatan ' + Math.round(event.velocity * 100) + '%' : label + ' · tick ' + tick;
          cell.addEventListener('focus', () => {
            gridValue = value;
            gridStep = step;
            for (const item of gridButtons) item.node.tabIndex = item.value === value && item.step === step ? 0 : -1;
          });
          cell.addEventListener('keydown', keyboard => {
            let targetRow = rowIndex;
            let targetStep = step;
            if (keyboard.key === 'ArrowLeft') targetStep--;
            else if (keyboard.key === 'ArrowRight') targetStep++;
            else if (keyboard.key === 'ArrowUp') targetRow--;
            else if (keyboard.key === 'ArrowDown') targetRow++;
            else if (keyboard.key === 'Home') { targetStep = 0; if (keyboard.ctrlKey) targetRow = 0; }
            else if (keyboard.key === 'End') { targetStep = STEPS - 1; if (keyboard.ctrlKey) targetRow = rows.length - 1; }
            else if (keyboard.key === 'Delete' || keyboard.key === 'Backspace') {
              keyboard.preventDefault();
              if (event) removeEvent(track, event, 'cell-' + value + '-' + step);
              return;
            } else return;
            keyboard.preventDefault();
            targetRow = Math.max(0, Math.min(rows.length - 1, targetRow));
            targetStep = Math.max(0, Math.min(STEPS - 1, targetStep));
            const target = gridButtons.find(item => item.value === rows[targetRow] && item.step === targetStep);
            if (target) target.node.focus();
          });
          gridButtons.push({ node: cell, value, step });
          matrix.append(cell);
        }
      });
      const cursor = el(doc, 'span', 'pa-playhead pa-editor-playhead');
      cursor.dataset.paPlayhead = 'editor';
      cursor.setAttribute('aria-hidden', 'true');
      playheadNodes.push(cursor);
      matrix.append(cursor);
      editorScroll.append(matrix);
      editor.append(editorScroll);
      root.append(editor);
    }

    function renderEventInspector(project, track) {
      const desc = descriptor(track);
      const pitched = isPitched(desc);
      const events = trackEvents(track);
      const current = events.find(event => event.id === selectedEventId);
      const inspector = el(doc, 'div', 'pa-event-inspector');
      const choose = key(el(doc, 'select', 'pa-event-select'), 'event-select');
      option(choose, '', 'Pilih not atau tambah pada grid');
      for (const [index, event] of events.entries()) option(choose, event.id, (index + 1) + '. ' + eventName(track, event) + ' · bar ' + (Math.floor(event.tick / BAR_TICKS) + 1) + ' · tick ' + event.tick);
      choose.value = current ? current.id : '';
      choose.addEventListener('change', () => {
        const event = events.find(item => item.id === choose.value);
        if (event) selectEvent(track, event, false);
      });
      inspector.append(field(pitched ? 'Not terpilih' : 'Ketukan terpilih', choose, 'pa-event-chooser'));
      if (!current) {
        inspector.append(el(doc, 'p', 'pa-empty-editor', 'Bar ini belum mempunyai not terpilih. Tambah melalui grid atau pilih not daripada senarai.'));
        root.append(inspector);
        return;
      }
      const form = el(doc, 'form', 'pa-event-form');
      const tick = key(el(doc, 'input'), 'event-tick');
      tick.type = 'number'; tick.min = '0'; tick.max = String(projectTicks(project) - 1); tick.step = '1'; tick.required = true; tick.value = String(current.tick);
      const duration = key(el(doc, 'input'), 'event-duration');
      duration.type = 'number'; duration.min = '1'; duration.max = String(projectTicks(project)); duration.step = '1'; duration.required = true; duration.value = String(current.durationTick);
      const voice = key(el(doc, 'select'), 'event-voice');
      if (pitched) {
        for (let midi = desc.minMidi || 1; midi <= desc.maxMidi; midi++) option(voice, midi, noteName(midi) + ' · MIDI ' + midi);
        voice.value = String(current.midi);
      } else {
        for (const action of desc.actions) option(voice, action, actionLabel(desc, action));
        voice.value = current.action;
      }
      const velocity = key(el(doc, 'input'), 'event-velocity');
      velocity.type = 'number'; velocity.min = '0'; velocity.max = '100'; velocity.step = '1'; velocity.required = true; velocity.value = String(Math.round(current.velocity * 100));
      form.append(field('Mula (tick)', tick), field('Tempoh (tick)', duration), field(pitched ? 'Nada' : 'Tindakan', voice), field('Kekuatan (%)', velocity));
      const actions = el(doc, 'div', 'pa-event-actions');
      const apply = button('Simpan not', 'pa-button pa-primary', null, 'save-event');
      apply.type = 'submit';
      const audition = button('Dengar not', 'pa-button', () => { if (typeof app.audition === 'function') app.audition(track, current); }, 'audition-event');
      const remove = button('Buang not', 'pa-button pa-destructive', () => removeEvent(track, current), 'remove-event');
      actions.append(apply, audition, remove);
      form.append(actions);
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;
        const patch = { tick: Number(tick.value), durationTick: Number(duration.value), velocity: Number(velocity.value) / 100 };
        if (pitched) patch.midi = Number(voice.value);
        else patch.action = voice.value;
        if (patch.tick + patch.durationTick > projectTicks(project)) { fail(new Error('Not mesti tamat dalam panjang projek.')); return; }
        const oldBar = bar;
        bar = Math.floor(patch.tick / BAR_TICKS);
        if (!commit(currentProject => C.updateEvent(currentProject, track.id, current.id, patch), 'Not dikemas kini')) bar = oldBar;
      });
      inspector.append(form);
      root.append(inspector);
    }

    function renderTimingTools(track) {
      const timing = el(doc, 'div', 'pa-timing-tools');
      const grid = key(el(doc, 'select'), 'quantize-grid');
      for (const [value, label] of [[3, '1/32 · 3 tick'], [6, '1/16 · 6 tick'], [12, '1/8 · 12 tick'], [24, '1/4 · 24 tick'], [48, '1/2 · 48 tick']]) option(grid, value, label);
      grid.value = String(quantizeGrid);
      grid.addEventListener('change', () => { quantizeGrid = Number(grid.value); });
      const strength = key(el(doc, 'input'), 'quantize-strength');
      strength.type = 'range'; strength.min = '0'; strength.max = '100'; strength.step = '1'; strength.value = String(quantizeStrength);
      const strengthValue = el(doc, 'output', '', quantizeStrength + '%');
      strength.addEventListener('input', () => { quantizeStrength = Number(strength.value); strengthValue.textContent = quantizeStrength + '%'; });
      const strengthWrap = el(doc, 'div', 'pa-strength-control');
      strength.setAttribute('aria-label', 'Kekuatan kuantisasi');
      strengthWrap.append(strength, strengthValue);
      timing.append(field('Grid kuantisasi', grid), field('Kekuatan', strengthWrap));
      const quantize = button('Kemas masa trek', 'pa-button', () => commit(project => C.quantizeTrack(project, track.id, quantizeGrid, quantizeStrength / 100), 'Masa trek dikemas kini'), 'quantize-track');
      quantize.disabled = !track.events.length;
      timing.append(quantize);
      if (isPitched(descriptor(track))) {
        const transpose = el(doc, 'div', 'pa-transpose');
        const down = button('Nada −1', 'pa-button', () => commit(project => C.transposeTrack(project, track.id, -1), 'Nada trek diturunkan satu semiton'), 'transpose-down');
        const up = button('Nada +1', 'pa-button', () => commit(project => C.transposeTrack(project, track.id, 1), 'Nada trek dinaikkan satu semiton'), 'transpose-up');
        down.setAttribute('aria-label', 'Turunkan semua not trek satu semiton');
        up.setAttribute('aria-label', 'Naikkan semua not trek satu semiton');
        down.disabled = up.disabled = !track.events.length;
        transpose.append(down, up);
        timing.append(transpose);
      }
      root.append(timing);
    }

    function render() {
      if (disposed) return;
      const project = app.getProject();
      if (!project || !Array.isArray(project.tracks)) return;
      totalTicks = projectTicks(project);
      const savedFocus = captureFocus();
      const oldOverviewScroll = overviewScroll ? overviewScroll.scrollLeft : 0;
      const oldEditorScroll = editorScroll ? editorScroll.scrollLeft : 0;
      const wantedTrackId = typeof app.getSelectedTrackId === 'function' ? app.getSelectedTrackId() : null;
      const track = project.tracks.find(item => item.id === wantedTrackId) || project.tracks[0];
      bar = Math.max(0, Math.min(project.lengthBars - 1, bar));
      if (track && (track.id !== lastTrackId || track.instrumentId !== lastInstrumentId)) {
        lastTrackId = track.id;
        lastInstrumentId = track.instrumentId;
        selectedEventId = null;
        rangeBase = descriptor(track).defaultMidi || 60;
        gridValue = isPitched(descriptor(track)) ? rangeBase : descriptor(track).actions[0];
        gridStep = 0;
      }
      if (track && !track.events.some(event => event.id === selectedEventId)) {
        const first = trackEvents(track).find(inBar);
        selectedEventId = first ? first.id : null;
        if (first) {
          const desc = descriptor(track);
          gridStep = Math.min(STEPS - 1, Math.floor((first.tick % BAR_TICKS) / STEP_TICKS));
          gridValue = isPitched(desc) ? first.midi : first.action;
          if (isPitched(desc) && (first.midi < rangeBase || first.midi > rangeBase + 12)) {
            rangeBase = Math.max(desc.minMidi || 1, Math.floor(first.midi / 12) * 12);
          }
        }
      }
      root.hidden = !track;
      root.replaceChildren();
      overviewScroll = editorScroll = matrix = null;
      gridButtons = [];
      playheadNodes = [];
      errorNode = el(doc, 'p', 'pa-error');
      errorNode.hidden = true;
      errorNode.setAttribute('role', 'alert');
      root.append(errorNode);
      if (track) {
        renderOverview(project, track);
        renderTrackTools(project, track);
        renderEditor(project, track);
        renderEventInspector(project, track);
        renderTimingTools(track);
      } else {
        lastTrackId = null;
        lastInstrumentId = null;
        selectedEventId = null;
      }
      if (overviewScroll) overviewScroll.scrollLeft = oldOverviewScroll;
      if (editorScroll) editorScroll.scrollLeft = oldEditorScroll;
      restoreFocus(savedFocus);
      setPlayhead(playhead);
    }

    function setPlayhead(tick) {
      if (disposed) return;
      playhead = Number.isFinite(tick) && tick >= 0 ? tick : null;
      for (const cursor of playheadNodes) {
        if (cursor.dataset.paPlayhead === 'overview') {
          cursor.hidden = playhead === null || playhead > totalTicks;
          if (!cursor.hidden) cursor.style.left = (playhead / totalTicks * 100) + '%';
        } else {
          const progress = playhead === null ? -1 : (playhead - bar * BAR_TICKS) / BAR_TICKS;
          cursor.hidden = progress < 0 || progress > 1;
          if (!cursor.hidden) cursor.style.left = 'calc(60px + ' + (progress * 100) + '% - ' + (progress * 60) + 'px)';
        }
      }
    }

    doc.addEventListener('prostudio:change', render);
    doc.addEventListener('prostudio:selection', render);
    render();
    return {
      render,
      setPlayhead,
      dispose() {
        if (disposed) return;
        disposed = true;
        doc.removeEventListener('prostudio:change', render);
        doc.removeEventListener('prostudio:selection', render);
        root.remove();
        gridButtons = [];
        playheadNodes = [];
      }
    };
  }

  global.ProStudioArranger = Object.freeze({ mount });
})(typeof window !== 'undefined' ? window : globalThis);
