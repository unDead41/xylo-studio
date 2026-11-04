(function (root) {
  'use strict';

  const STORAGE_KEY = 'e-instru-pro-projects/v1';
  const STORAGE_SCHEMA = 'e-instru-project-library/v1';
  const MAX_PROJECTS = 20;
  const MAX_FILE_BYTES = 4 * 1024 * 1024;
  const MAX_STORE_BYTES = 8 * 1024 * 1024;
  let panelSequence = 0;

  function core() {
    if (!root.ProStudioCore) throw new Error('Model Studio Pro belum tersedia.');
    return root.ProStudioCore;
  }

  function byteLength(text) {
    let bytes = 0;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      if (code < 128) bytes += 1;
      else if (code < 2048) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length &&
               text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) {
        bytes += 4;
        i += 1;
      } else bytes += 3;
    }
    return bytes;
  }

  function projectCopy(project) {
    const text = core().exportProject(project);
    if (typeof text !== 'string' || byteLength(text) > MAX_FILE_BYTES) {
      throw new Error('Projek melebihi had fail JSON 4 MB.');
    }
    return core().projectFromJSON(text);
  }

  function sameProject(a, b) {
    return !!a && !!b && core().exportProject(a) === core().exportProject(b);
  }

  function makeWriterId() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function createStore(options) {
    options = options || {};
    let storage;
    let expectedRaw = null;
    let locked = false;
    let lastStatus = { code: 'ready', level: 'info', message: 'Simpanan projek tersedia.' };
    let state = { schema: STORAGE_SCHEMA, version: 1, revision: 0, writer: '', activeId: null, projects: [] };
    const writer = makeWriterId();

    function report(code, message, level) {
      const next = { code: code, level: level || 'info', message: message };
      const changed = next.code !== lastStatus.code || next.message !== lastStatus.message;
      lastStatus = next;
      if (changed && typeof options.onStatus === 'function') {
        try { options.onStatus(message, { code: next.code, level: next.level }); } catch (_) { /* A UI callback cannot invalidate a saved project. */ }
      }
      return false;
    }

    function unavailable() {
      locked = true;
      return report('unavailable', 'Simpanan pelayar tidak tersedia. Eksport JSON sebelum menutup halaman.', 'error');
    }

    function conflict() {
      locked = true;
      return report('conflict', 'Simpanan berubah dalam tab lain. Eksport JSON projek semasa dan muat semula halaman sebelum menyimpan.', 'error');
    }

    function decode(text) {
      if (typeof text !== 'string' || byteLength(text) > MAX_STORE_BYTES) throw new Error('Had simpanan tidak sah.');
      const value = JSON.parse(text);
      if (!value || value.schema !== STORAGE_SCHEMA || value.version !== 1 ||
          !Number.isSafeInteger(value.revision) || value.revision < 1 ||
          typeof value.writer !== 'string' || !value.writer || value.writer.length > 150 ||
          !Array.isArray(value.projects) || value.projects.length > MAX_PROJECTS) throw new Error('Format simpanan tidak sah.');
      const ids = new Set();
      const projects = value.projects.map(function (entry) {
        if (!entry || typeof entry.updatedAt !== 'string' || entry.updatedAt.length > 32 ||
            !Number.isFinite(Date.parse(entry.updatedAt))) throw new Error('Tarikh simpanan tidak sah.');
        const project = projectCopy(entry.project);
        if (ids.has(project.id)) throw new Error('Identiti projek berulang.');
        ids.add(project.id);
        return { project: project, updatedAt: entry.updatedAt };
      });
      if (value.activeId !== null && (typeof value.activeId !== 'string' || !ids.has(value.activeId))) {
        throw new Error('Projek aktif tidak sah.');
      }
      return { schema: STORAGE_SCHEMA, version: 1, revision: value.revision,
        writer: value.writer, activeId: value.activeId, projects: projects };
    }

    try {
      storage = options.storage === undefined ? root.localStorage : options.storage;
      if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') unavailable();
      else {
        expectedRaw = storage.getItem(STORAGE_KEY);
        if (expectedRaw !== null) {
          try { state = decode(expectedRaw); }
          catch (_) {
            locked = true;
            report('corrupt', 'Simpanan projek rosak atau versinya tidak disokong. Data asal dikekalkan; eksport JSON projek semasa sebelum memuat semula.', 'error');
          }
        }
      }
    } catch (_) { unavailable(); }

    function checkCurrent() {
      if (locked) return false;
      try {
        if (storage.getItem(STORAGE_KEY) !== expectedRaw) return conflict();
      } catch (_) { return unavailable(); }
      return true;
    }

    function write(next, message) {
      if (!checkCurrent()) return false;
      if (state.revision >= Number.MAX_SAFE_INTEGER) {
        return report('limit', 'Had semakan simpanan dicapai. Eksport JSON untuk sandaran.', 'error');
      }
      next.revision = state.revision + 1;
      next.writer = writer;
      const text = JSON.stringify(next);
      if (byteLength(text) > MAX_STORE_BYTES) {
        return report('limit', 'Had saiz simpanan projek dicapai. Eksport JSON dan padam projek lama sebelum mencuba lagi.', 'error');
      }
      try {
        storage.setItem(STORAGE_KEY, text);
      } catch (error) {
        const quota = error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22 || error.code === 1014);
        return report(quota ? 'quota' : 'unavailable', quota ?
          'Simpanan pelayar penuh. Eksport JSON; padam projek lama atau kosongkan ruang sebelum mencuba lagi.' :
          'Projek belum disimpan kerana simpanan pelayar tidak tersedia. Eksport JSON sebelum menutup halaman.', 'error');
      }
      expectedRaw = text;
      // A second tab can write between the comparison and setItem; report a lost race as well.
      try {
        if (storage.getItem(STORAGE_KEY) !== text) return conflict();
      } catch (_) { return unavailable(); }
      state = next;
      report('saved', message, 'success');
      return true;
    }

    function nextState(projects, activeId) {
      return { schema: STORAGE_SCHEMA, version: 1, revision: state.revision,
        writer: writer, activeId: activeId, projects: projects };
    }

    function list() {
      checkCurrent();
      return state.projects.slice().sort(function (a, b) {
        return b.updatedAt.localeCompare(a.updatedAt) || a.project.title.localeCompare(b.project.title);
      }).map(function (entry) {
        const project = entry.project;
        return { id: project.id, title: project.title, bpm: project.bpm,
          lengthBars: project.lengthBars, trackCount: project.tracks.length, updatedAt: entry.updatedAt };
      });
    }

    function load(id) {
      checkCurrent();
      const entry = state.projects.find(function (item) { return item.project.id === id; });
      return entry ? projectCopy(entry.project) : null;
    }

    function save(value) {
      if (!checkCurrent()) return false;
      let project;
      try { project = projectCopy(value); }
      catch (error) { return report('invalid', 'Projek belum disimpan: ' + error.message, 'error'); }
      const previous = state.projects.find(function (entry) { return entry.project.id === project.id; });
      if (!previous && state.projects.length >= MAX_PROJECTS) {
        return report('limit', 'Had 20 projek dicapai. Eksport JSON dan padam projek lama sebelum menyimpan projek baharu.', 'error');
      }
      if (previous && sameProject(previous.project, project) && state.activeId === project.id) return projectCopy(project);
      const projects = state.projects.filter(function (entry) { return entry.project.id !== project.id; });
      projects.push({ project: project, updatedAt: new Date().toISOString() });
      return write(nextState(projects, project.id), 'Projek disimpan di pelayar ini. Eksport JSON untuk sandaran.') ? projectCopy(project) : false;
    }

    function remove(id) {
      if (!checkCurrent()) return false;
      if (!state.projects.some(function (entry) { return entry.project.id === id; })) {
        return report('missing', 'Projek tersimpan tidak ditemui.', 'error');
      }
      return write(nextState(state.projects.filter(function (entry) { return entry.project.id !== id; }),
        state.activeId === id ? null : state.activeId), 'Salinan projek dipadam daripada pelayar ini.');
    }

    function setActiveId(id) {
      if (!checkCurrent()) return false;
      if (id !== null && !state.projects.some(function (entry) { return entry.project.id === id; })) {
        return report('missing', 'Simpan projek dahulu sebelum menjadikannya projek aktif.', 'error');
      }
      if (id === state.activeId) return true;
      return write(nextState(state.projects.slice(), id), 'Projek aktif dikemas kini.');
    }

    function onStorage(event) {
      if (event && (event.key === STORAGE_KEY || event.key === null) &&
          (!event.storageArea || event.storageArea === storage)) checkCurrent();
    }
    if (typeof root.addEventListener === 'function') root.addEventListener('storage', onStorage);

    return Object.freeze({
      list: list, load: load, save: save, remove: remove,
      getActiveId: function () { checkCurrent(); return state.activeId; },
      setActiveId: setActiveId,
      getStatus: function () { return Object.assign({}, lastStatus); },
      dispose: function () { if (typeof root.removeEventListener === 'function') root.removeEventListener('storage', onStorage); }
    });
  }

  function mount(container, app) {
    const C = core();
    if (!container || !container.ownerDocument || !app || typeof app.getProject !== 'function') {
      throw new Error('Panel projek memerlukan bekas dan aplikasi Studio Pro.');
    }
    const doc = container.ownerDocument;
    const prefix = 'pro-projects-' + (++panelSequence) + '-';
    let disposed = false;
    let busy = false;
    let selectedId = '';
    let importSequence = 0;
    const section = element('section', 'pro-projects');
    const heading = element('h2', '', 'Projek & fail');
    heading.id = prefix + 'heading';
    section.setAttribute('aria-labelledby', heading.id);
    section.appendChild(heading);
    section.appendChild(element('p', 'pro-projects-intro', 'Simpan susunan berbilang trek di pelayar ini. Eksport JSON untuk salinan sandaran.'));

    const nameField = element('div', 'pro-projects-field');
    const nameLabel = element('label', '', 'Nama projek');
    const nameInput = element('input', 'pro-projects-name');
    nameInput.type = 'text';
    nameInput.id = prefix + 'name';
    nameInput.maxLength = 100;
    nameInput.required = true;
    nameInput.autocomplete = 'off';
    nameLabel.htmlFor = nameInput.id;
    const nameHelp = element('span', 'pro-projects-help', '1–100 aksara. Nama digunakan pada fail eksport.');
    nameHelp.id = prefix + 'name-help';
    nameInput.setAttribute('aria-describedby', nameHelp.id);
    nameField.append(nameLabel, nameInput, nameHelp);
    section.appendChild(nameField);
    const dirtyState = element('p', 'pro-projects-state');
    section.appendChild(dirtyState);

    const primaryActions = element('div', 'pro-projects-actions');
    const saveButton = button('save', 'Simpan sekarang', 'primary');
    const newButton = button('new', 'Projek baharu');
    const duplicateButton = button('duplicate', 'Gandakan');
    primaryActions.append(saveButton, newButton, duplicateButton);
    section.appendChild(primaryActions);

    const library = element('div', 'pro-projects-library');
    const listLabel = element('label', '', 'Projek dalam pelayar');
    const select = element('select', 'pro-projects-select');
    select.id = prefix + 'list';
    listLabel.htmlFor = select.id;
    const count = element('span', 'pro-projects-help');
    count.id = prefix + 'count';
    select.setAttribute('aria-describedby', count.id);
    const localActions = element('div', 'pro-projects-actions');
    const loadButton = button('load', 'Buka projek');
    const deleteButton = button('delete', 'Padam salinan', 'pro-projects-delete');
    localActions.append(loadButton, deleteButton);
    library.append(listLabel, select, count, localActions);
    section.appendChild(library);

    const files = element('div', 'pro-projects-files');
    const fileHeading = element('h3', '', 'Sandaran & data');
    const exportActions = element('div', 'pro-projects-actions');
    const jsonButton = button('export-json', 'Eksport JSON');
    const csvButton = button('export-csv', 'Eksport CSV');
    exportActions.append(jsonButton, csvButton);
    const fileLabel = element('label', '', 'Import projek JSON');
    const fileInput = element('input', 'pro-projects-import');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.id = prefix + 'import';
    fileLabel.htmlFor = fileInput.id;
    const fileHelp = element('p', 'pro-projects-help', 'Fail projek e-instru-project/v1, maksimum 4 MB. CSV mengeksport seluruh susunan; import CSV tidak disediakan.');
    fileHelp.id = prefix + 'file-help';
    fileInput.setAttribute('aria-describedby', fileHelp.id);
    files.append(fileHeading, exportActions, fileLabel, fileInput, fileHelp);
    section.appendChild(files);
    const message = element('p', 'pro-projects-message');
    message.id = prefix + 'message';
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    message.setAttribute('aria-atomic', 'true');
    section.appendChild(message);
    section.appendChild(element('p', 'pro-projects-privacy', 'Fail dan projek kekal pada peranti anda. Tiada akaun, pelayan atau audio mikrofon mentah disimpan.'));
    container.appendChild(section);

    function element(tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }

    function button(action, text, className) {
      const node = element('button', className || '', text);
      node.type = 'button';
      node.setAttribute('data-pro-project-action', action);
      return node;
    }

    function store() { return app.getStore(); }

    function translated(text) {
      return typeof root.StudioI18n?.t === 'function' ? root.StudioI18n.t(text) : text;
    }

    function say(text, error) {
      if (disposed) return;
      message.textContent = text;
      message.className = 'pro-projects-message' + (error ? ' is-error' : '');
      if (typeof app.announce === 'function') app.announce(text);
    }

    function storeError(fallback) {
      const currentStore = store();
      const status = typeof currentStore.getStatus === 'function' ? currentStore.getStatus() : null;
      say(status && status.level === 'error' ? status.message : fallback, true);
    }

    function dirty(project) {
      const saved = store().load(project.id);
      if (saved) return !sameProject(project, saved);
      return !sameProject(project, C.createProject({ id: project.id }));
    }

    function askReplace(next, label, extraMessage) {
      if (disposed) return;
      const current = app.getProject();
      const unsaved = dirty(current);
      function replace() {
        if (disposed) return;
        try {
          if (app.replaceProject(next, label) === false) { say('Projek tidak dapat dibuka. Semak data projek.', true); return; }
          if (store().load(next.id)) store().setActiveId(next.id);
          selectedId = next.id;
          say(label + '.');
          render();
        } catch (error) { say('Projek tidak dapat dibuka: ' + error.message, true); }
      }
      if (unsaved || extraMessage) {
        if (typeof app.confirm !== 'function') { say('Pengesahan diperlukan sebelum mengganti projek semasa.', true); return; }
        app.confirm({ title: 'Ganti projek semasa?',
          message: (unsaved ? 'Suntingan semasa belum disimpan. Eksport JSON atau simpan dahulu jika anda mahu mengekalkannya. ' : '') + (extraMessage || 'Projek yang dipilih akan dibuka.'),
          confirmLabel: 'Ganti projek', onConfirm: replace });
      } else replace();
    }

    function commitName() {
      if (disposed || busy) return false;
      const title = nameInput.value.trim();
      if (!title || title.length > 100 || /[\u0000-\u001f\u007f]/.test(title)) {
        nameInput.setAttribute('aria-invalid', 'true');
        say('Nama projek mestilah 1–100 aksara tanpa aksara kawalan.', true);
        return false;
      }
      nameInput.removeAttribute('aria-invalid');
      if (title !== app.getProject().title) {
        if (app.mutate(function (project) { project.title = title; return project; }, 'Nama projek diubah') === false) {
          say('Nama projek tidak dapat dikemas kini.', true);
          return false;
        }
      }
      nameInput.value = title;
      return true;
    }

    function guard(action) {
      return function () {
        if (disposed || busy) return;
        try { action(); } catch (error) { say(error.message || 'Tindakan tidak dapat diselesaikan.', true); }
      };
    }

    nameInput.addEventListener('change', commitName);
    select.addEventListener('change', function () { if (!disposed) { selectedId = select.value; render(); } });
    saveButton.addEventListener('click', guard(function () {
      if (!commitName()) return;
      const saved = store().save(app.getProject());
      if (!saved) { storeError('Projek belum disimpan. Eksport JSON untuk sandaran.'); return; }
      selectedId = saved.id;
      say('Projek disimpan di pelayar ini. Eksport JSON untuk sandaran.');
      render();
    }));
    newButton.addEventListener('click', guard(function () {
      if (store().list().length >= MAX_PROJECTS) { say('Had 20 projek dicapai. Eksport JSON dan padam projek lama dahulu.', true); return; }
      askReplace(C.createProject(), 'Projek baharu dibuka');
    }));
    duplicateButton.addEventListener('click', guard(function () {
      if (!commitName()) return;
      const copy = projectCopy(app.getProject());
      copy.id = C.createProject().id;
      copy.title = copy.title.slice(0, 90) + ' (salinan)';
      const saved = store().save(copy);
      if (!saved) { storeError('Salinan projek belum disimpan.'); return; }
      if (app.replaceProject(saved, 'Projek digandakan') === false) { say('Salinan disimpan tetapi belum dibuka.', true); return; }
      selectedId = saved.id;
      say('Salinan projek disimpan dan dibuka.');
      render();
    }));
    loadButton.addEventListener('click', guard(function () {
      const project = store().load(selectedId);
      if (!project) { say('Pilih projek tersimpan untuk dibuka.', true); return; }
      askReplace(project, 'Projek dibuka');
    }));
    deleteButton.addEventListener('click', guard(function () {
      const project = store().load(selectedId);
      if (!project) { say('Pilih salinan projek untuk dipadam.', true); return; }
      if (typeof app.confirm !== 'function') { say('Pengesahan diperlukan sebelum memadam projek.', true); return; }
      const active = project.id === app.getProject().id;
      app.confirm({ title: 'Padam salinan projek?',
        message: 'Salinan “' + project.title + '” dalam pelayar akan dipadam. Eksport JSON dahulu jika diperlukan.' +
          (active ? ' Projek semasa akan diganti dengan projek kosong.' : ''),
        confirmLabel: 'Padam salinan', onConfirm: function () {
          if (disposed) return;
          // Recheck the active identity in case the project changed while the dialog was open.
          const replaceCurrent = project.id === app.getProject().id;
          if (!store().remove(project.id)) { storeError('Salinan projek tidak dapat dipadam.'); return; }
          if (replaceCurrent) app.replaceProject(C.createProject(), 'Projek kosong dibuka');
          selectedId = '';
          say('Salinan projek dipadam daripada pelayar ini.');
          render();
        } });
    }));

    function download(format) {
      if (!commitName()) return;
      const project = app.getProject();
      const text = format === 'json' ? C.exportProject(project) : C.csv(project);
      const BlobType = root.Blob;
      const URLType = root.URL;
      if (!BlobType || !URLType || typeof URLType.createObjectURL !== 'function') throw new Error('Muat turun fail tidak tersedia dalam pelayar ini.');
      const url = URLType.createObjectURL(new BlobType([text], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' }));
      const link = doc.createElement('a');
      const filename = project.title.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-').trim().replace(/\s+/g, '-').slice(0, 80).replace(/[. -]+$/g, '') || 'projek-studio';
      link.href = url;
      link.download = filename + '.' + format;
      link.hidden = true;
      doc.body.appendChild(link);
      try { link.click(); }
      finally {
        link.remove();
        root.setTimeout(function () { URLType.revokeObjectURL(url); }, 2000);
      }
      say(format === 'json' ? 'JSON dimuat turun. Simpan fail ini sebagai sandaran.' : 'CSV seluruh susunan dimuat turun.');
    }
    jsonButton.addEventListener('click', guard(function () { download('json'); }));
    csvButton.addEventListener('click', guard(function () { download('csv'); }));

    fileInput.addEventListener('change', async function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file || disposed || busy) return;
      const sequence = ++importSequence;
      busy = true;
      render();
      try {
        if (!/\.json$/i.test(file.name || '') || (file.type && !/^(application\/json|text\/json|text\/plain)$/i.test(file.type))) {
          throw new Error('Pilih fail .json projek Studio Pro, bukan fail audio atau CSV.');
        }
        if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_FILE_BYTES) {
          throw new Error('Fail JSON mestilah berisi dan tidak melebihi 4 MB.');
        }
        const text = await file.text();
        if (disposed || sequence !== importSequence) return;
        if (typeof text !== 'string' || byteLength(text) > MAX_FILE_BYTES) throw new Error('Fail JSON melebihi had 4 MB.');
        const project = C.projectFromJSON(text);
        const existing = store().load(project.id);
        askReplace(project, 'Projek JSON diimport', existing && !sameProject(existing, project) ?
          'Identiti fail ini sepadan dengan projek tersimpan. Simpanan projek itu akan diganti oleh susunan yang diimport.' : '');
      } catch (error) {
        if (!disposed && sequence === importSequence) say('Import gagal: ' + (error.message || 'Fail tidak dapat dibaca.'), true);
      } finally {
        if (!disposed && sequence === importSequence) {
          busy = false;
          fileInput.value = '';
          render();
        }
      }
    });

    function render() {
      if (disposed) return;
      try {
        const project = app.getProject();
        const entries = store().list();
        if (doc.activeElement !== nameInput) nameInput.value = project.title;
        if (!entries.some(function (entry) { return entry.id === selectedId; })) {
          selectedId = entries.some(function (entry) { return entry.id === project.id; }) ? project.id : '';
        }
        if (doc.activeElement !== select) {
          const options = [element('option', '', entries.length ? 'Pilih projek tersimpan' : 'Belum ada projek tersimpan')];
          options[0].value = '';
          entries.forEach(function (entry) {
            const option = element('option');
            // A title may itself be a dictionary phrase. Translate only UI metadata,
            // then keep the joined native option outside passive DOM translation.
            option.setAttribute('data-i18n-ignore', '');
            option.textContent = entry.title + ' · ' + translated(entry.trackCount + ' trek · ' + entry.bpm + ' BPM');
            option.value = entry.id;
            options.push(option);
          });
          select.replaceChildren.apply(select, options);
          select.value = selectedId;
        }
        count.textContent = entries.length + ' / 20 projek. Simpanan pelayar tidak menggantikan sandaran JSON.';
        const saved = store().load(project.id);
        dirtyState.textContent = saved && sameProject(project, saved) ? 'Projek semasa telah disimpan.' : 'Projek semasa belum disimpan. Autosimpan mengikut status studio.';
        for (const control of [nameInput, saveButton, newButton, duplicateButton, jsonButton, csvButton, fileInput]) control.disabled = busy;
        select.disabled = busy || !entries.length;
        loadButton.disabled = busy || !selectedId;
        deleteButton.disabled = busy || !selectedId;
        section.setAttribute('aria-busy', String(busy));
        const status = typeof store().getStatus === 'function' ? store().getStatus() : null;
        if (status && status.level === 'error' && ['conflict', 'corrupt', 'unavailable', 'quota', 'limit'].includes(status.code)) {
          message.textContent = status.message;
          message.className = 'pro-projects-message is-error';
        }
      } catch (error) { say('Panel projek tidak dapat dikemas kini: ' + error.message, true); }
    }

    doc.addEventListener('prostudio:change', render);
    const unsubscribeLanguage = typeof root.StudioI18n?.onChange === 'function' ? root.StudioI18n.onChange(render) : null;
    render();
    return Object.freeze({ render: render, dispose: function () {
      if (disposed) return;
      disposed = true;
      importSequence += 1;
      doc.removeEventListener('prostudio:change', render);
      if (typeof unsubscribeLanguage === 'function') unsubscribeLanguage();
      section.remove();
    } });
  }

  root.ProStudioProjects = Object.freeze({ createStore: createStore,
    STORAGE_KEY: STORAGE_KEY, STORAGE_SCHEMA: STORAGE_SCHEMA,
    MAX_PROJECTS: MAX_PROJECTS, MAX_FILE_BYTES: MAX_FILE_BYTES });
  root.ProStudioProjectPanel = Object.freeze({ mount: mount });
})(typeof window !== 'undefined' ? window : globalThis);
