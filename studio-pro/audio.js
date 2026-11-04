(function (root) {
  'use strict';

  // A separate context keeps the arranger independent of the instrument/game owners.
  // AudioContext time is the clock; timers only fill a short scheduling window.
  const PPQ = 24, BAR = 96, LOOKAHEAD = .12, INTERVAL = 25, START_DELAY = .025;
  const MAX_VOICES = 256, MAX_BATCH = 256, EPSILON = 1e-7;
  const METRONOME = Symbol('prostudio-metronome');
  const ACTIONS = Object.freeze({ tamborin: ['tap', 'shake'], kompang: ['center', 'edge'],
    snare: ['hit', 'rim'], bass_drum: ['hit', 'soft'], cymbals: ['crash', 'soft'], triangle: ['open', 'muted'] });
  const number = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const isPercussion = instrument => Object.prototype.hasOwnProperty.call(ACTIONS, instrument);
  const clamp = (value, lo, hi, fallback = lo) => Math.max(lo, Math.min(hi, number(value, fallback)));
  const disconnect = node => { try { node.disconnect(); } catch (_) {} };

  function normalizeTrack(track, index, length) {
    const instrumentId = track.instrumentId;
    if (instrumentId !== 'xylophone' && instrumentId !== 'recorder' && !isPercussion(instrumentId)) return null;
    const normalized = {
      id: String(track.id == null ? 'track-' + index : track.id), instrumentId,
      volume: clamp(track.volume, 0, 1, .8), pan: clamp(track.pan, -1, 1, 0),
      muted: track.muted === true, solo: track.solo === true,
      reverb: clamp(track.reverb, 0, 1, 0), delay: clamp(track.delay, 0, 1, 0), events: []
    };
    for (const event of (Array.isArray(track.events) ? track.events : []).slice(0, 512)) {
      if (!event || !Number.isInteger(event.tick) || event.tick < 0 || event.tick >= length) continue;
      if (!Number.isInteger(event.durationTick) || event.durationTick < 1) continue;
      if (isPercussion(instrumentId) ? !ACTIONS[instrumentId].includes(event.action) :
        !Number.isInteger(event.midi) || event.midi < (instrumentId === 'recorder' ? 72 : 1) || event.midi > (instrumentId === 'recorder' ? 98 : 127)) continue;
      normalized.events.push({ id: String(event.id == null ? normalized.events.length : event.id), tick: event.tick,
        durationTick: Math.min(length - event.tick, event.durationTick), midi: event.midi,
        action: event.action, velocity: clamp(event.velocity, 0, 1, .8) });
    }
    return normalized;
  }

  function normalize(project) {
    if (!project || project.schema !== 'e-instru-project/v1') throw Error('Projek studio tidak sah.');
    const lengthBars = Math.round(clamp(project.lengthBars, 4, 32, 8)), length = lengthBars * BAR;
    const loopStart = Math.round(clamp(project.loop && project.loop.startTick, 0, length - 1, 0));
    const loopEnd = Math.round(clamp(project.loop && project.loop.endTick, loopStart + 1, length, length));
    const tracks = [], ids = new Set();
    for (const [index, track] of (Array.isArray(project.tracks) ? project.tracks : []).slice(0, 8).entries()) {
      const next = track && normalizeTrack(track, index, length);
      if (next && !ids.has(next.id)) { ids.add(next.id); tracks.push(next); }
    }
    const result = { bpm: clamp(project.bpm, 40, 200, 100), length,
      loop: { enabled: !!(project.loop && project.loop.enabled), startTick: loopStart, endTick: loopEnd },
      master: { volume: clamp(project.master && project.master.volume, 0, 1, .8) }, tracks };
    result.entries = tracks.flatMap(track => track.events.map(event => ({ track, event })))
      .sort((a, b) => a.event.tick - b.event.tick);
    result.signature = JSON.stringify([result.bpm, length, result.loop,
      tracks.map(track => [track.id, track.instrumentId, track.events])]);
    return result;
  }

  function createEngine(options = {}) {
    let context = null, master = null, project = null, state = 'idle', cursor = 0, epoch = 0, timer = null;
    let anchorTime = 0, anchorTick = 0, scheduledTo = 0, metroTo = 0, metronome = false;
    let meter = 0, tailsUntil = 0, densityWarned = false, impulse = null;
    const buses = new Map(), voices = new Set();
    const later = (root.setTimeout || setTimeout).bind(root);
    const clearLater = (root.clearTimeout || clearTimeout).bind(root);
    const notify = (key, ...args) => { try { if (typeof options[key] === 'function') options[key](...args); } catch (_) {} };
    const setState = (next, message = '') => { state = next; notify('onState', next, message); };
    const secondsPerTick = () => 60 / (project ? project.bpm : 100) / PPQ;
    const audible = track => !track.muted && (!project || !project.tracks.some(item => item.solo) || track.solo);

    function setParam(param, value, immediate = false) {
      if (!param) return;
      const now = context.currentTime;
      if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(now);
      if (!immediate && typeof param.setTargetAtTime === 'function') param.setTargetAtTime(value, now, .012);
      else if (typeof param.setValueAtTime === 'function') param.setValueAtTime(value, now);
      else param.value = value;
    }

    function ensureContext() {
      if (context) return context;
      const Constructor = root.AudioContext || root.webkitAudioContext;
      if (!Constructor) throw Error('Web Audio tidak tersedia dalam pelayar ini.');
      context = new Constructor();
      const input = context.createGain(), output = context.createGain(), nodes = [input, output];
      let previous = input, compressor = null, analyser = null, samples = null;
      if (typeof context.createDynamicsCompressor === 'function') {
        compressor = context.createDynamicsCompressor();
        for (const [key, value] of Object.entries({ threshold: -18, knee: 18, ratio: 3, attack: .005, release: .18 })) setParam(compressor[key], value, true);
        previous.connect(compressor); previous = compressor; nodes.push(compressor);
      }
      // Meter the audible master output, including the master fader.
      previous.connect(output); previous = output;
      if (typeof context.createAnalyser === 'function') {
        analyser = context.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = .8;
        samples = typeof analyser.getFloatTimeDomainData === 'function' ? new Float32Array(256) :
          typeof analyser.getByteTimeDomainData === 'function' ? new Uint8Array(256) : null;
        previous.connect(analyser); previous = analyser; nodes.push(analyser);
      }
      previous.connect(context.destination); output.gain.value = 0;
      master = { input, output, compressor, analyser, samples, nodes };
      return context;
    }

    function reverbBuffer() {
      if (impulse) return impulse;
      const length = Math.ceil(context.sampleRate * 1.15);
      impulse = context.createBuffer(2, length, context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.8) * .35;
      }
      return impulse;
    }

    function destroyBus(id) {
      const bus = buses.get(id);
      if (!bus) return;
      for (const node of bus.nodes) disconnect(node);
      buses.delete(id);
    }

    function busFor(track) {
      if (buses.has(track.id)) return buses.get(track.id);
      const input = context.createGain(), mix = context.createGain(), fader = context.createGain();
      const nodes = [input, mix, fader];
      input.connect(mix);
      let pan = null, reverb = null, delay = null, delayNode = null;
      if (typeof context.createConvolver === 'function') {
        reverb = context.createGain(); const convolver = context.createConvolver(); convolver.buffer = reverbBuffer();
        input.connect(reverb); reverb.connect(convolver); convolver.connect(mix); nodes.push(reverb, convolver);
      }
      if (typeof context.createDelay === 'function') {
        delay = context.createGain(); delayNode = context.createDelay(2); const feedback = context.createGain(); feedback.gain.value = .27;
        input.connect(delay); delay.connect(delayNode); delayNode.connect(mix); delayNode.connect(feedback); feedback.connect(delayNode);
        nodes.push(delay, delayNode, feedback);
      }
      if (typeof context.createStereoPanner === 'function') {
        pan = context.createStereoPanner(); mix.connect(pan); pan.connect(fader); nodes.push(pan);
      } else if (typeof context.createPanner === 'function') {
        pan = context.createPanner(); pan.panningModel = 'equalpower'; mix.connect(pan); pan.connect(fader); nodes.push(pan);
      } else mix.connect(fader);
      fader.connect(master.input);
      const bus = { input, fader, pan, reverb, delay, delayNode, nodes };
      buses.set(track.id, bus); applyTrack(track, bus);
      return bus;
    }

    function applyTrack(track, bus) {
      setParam(bus.fader.gain, audible(track) ? track.volume : 0, !audible(track));
      if (bus.pan && bus.pan.pan) setParam(bus.pan.pan, track.pan);
      else if (bus.pan && typeof bus.pan.setPosition === 'function') bus.pan.setPosition(track.pan, 0, 1 - Math.abs(track.pan));
      if (bus.reverb) setParam(bus.reverb.gain, track.reverb * .55);
      if (bus.delay) setParam(bus.delay.gain, track.delay * .4);
      if (bus.delayNode) setParam(bus.delayNode.delayTime, Math.min(1.25, 60 / (project ? project.bpm : 100) * .75));
    }

    function applyMixer() {
      if (!context || !master) return;
      setParam(master.output.gain, project ? project.master.volume : .8);
      for (const [id, bus] of buses) {
        const track = project && project.tracks.find(item => item.id === id);
        if (track) applyTrack(track, bus);
      }
    }

    function cancelVoices(predicate = () => true) {
      for (const voice of [...voices]) if (predicate(voice)) voice.cancel();
    }

    function silence() {
      if (master) setParam(master.output.gain, 0, true);
      cancelVoices();
      for (const id of [...buses.keys()]) destroyBus(id);
      tailsUntil = 0; meter = 0; notify('onMeter', 0);
    }

    function clearTimer() { if (timer !== null) clearLater(timer); timer = null; }

    function register(raw, trackId, start, extraNodes = []) {
      if (!raw) return;
      if (voices.size >= MAX_VOICES) { voices.values().next().value.cancel(); warnDensity(); }
      let cancelled = false;
      const voice = { trackId, start, endAt: number(raw.endAt, start + 1), cancel() {
        if (cancelled) return;
        cancelled = true;
        try { raw.cancel(); } catch (_) {}
        for (const node of extraNodes) disconnect(node);
        voices.delete(voice);
      } };
      voices.add(voice); tailsUntil = Math.max(tailsUntil, voice.endAt + 2.5);
    }

    function warnDensity() {
      if (!densityWarned) { densityWarned = true; notify('onState', state, 'Had bunyi serentak dicapai; kurangkan not yang bertindih.'); }
    }

    function envelope(param, points) {
      param.setValueAtTime(.0001, points[0][1]);
      for (const [value, at] of points) param.exponentialRampToValueAtTime(Math.max(.0001, value), at);
    }

    function pitched(track, event, start, duration, destination) {
      const nodes = [], sources = [], frequency = 440 * Math.pow(2, (event.midi - 69) / 12);
      const recorder = track.instrumentId === 'recorder', release = recorder ? .055 : .025;
      const end = start + duration, decay = Math.min(duration, .8), attack = Math.min(recorder ? .025 : .004, duration * .25);
      const partials = recorder ? [[1, .18], [2, .026], [3, .009]] : [[1, .3], [3, .1], [5.8, .04]];
      for (const [ratio, level] of partials) {
        const source = context.createOscillator(), gain = context.createGain();
        source.type = 'sine'; source.frequency.setValueAtTime(frequency * ratio, start);
        if (recorder) envelope(gain.gain, [[.0001, start], [level, start + attack], [level, end], [.0001, end + release]]);
        else envelope(gain.gain, [[.0001, start], [level, start + attack], [.0001, start + decay], [.0001, end + release]]);
        source.connect(gain); gain.connect(destination); source.start(start); source.stop(end + release + .005);
        sources.push(source); nodes.push(source, gain);
      }
      return managedVoice(sources, nodes, end + release + .01);
    }

    function managedVoice(sources, nodes, endAt) {
      let cancelled = false, remaining = sources.length;
      const cleanup = () => { for (const node of nodes) disconnect(node); };
      for (const source of sources) source.onended = () => { if (!--remaining) cleanup(); };
      return { endAt, cancel() { if (cancelled) return; cancelled = true; for (const source of sources) try { source.stop(); } catch (_) {} cleanup(); } };
    }

    // The existing percussion adapter connects to context.destination. Bind its
    // native methods to the real context and replace only the output destination.
    function percussionContext(destination) {
      const facade = { get currentTime() { return context.currentTime; }, get sampleRate() { return context.sampleRate; }, destination };
      for (const key of ['createGain', 'createOscillator', 'createBuffer', 'createBufferSource', 'createBiquadFilter']) {
        if (typeof context[key] === 'function') facade[key] = context[key].bind(context);
      }
      return facade;
    }

    function fallbackPercussion(instrument, action, start, destination, accent) {
      const profiles = {
        tamborin: action === 'shake' ? [3300, .42, .09, 'highpass'] : [185, .2, .22, 'highpass'],
        kompang: action === 'edge' ? [435, .12, .2, 'highpass'] : [142, .36, .3, 'bandpass'],
        snare: action === 'rim' ? [630, .09, .12, 'highpass'] : [178, .25, .25, 'highpass'],
        bass_drum: action === 'soft' ? [75, .3, .14, 'lowpass'] : [82, .47, .34, 'lowpass'],
        cymbals: action === 'soft' ? [2509, .3, .07, 'highpass'] : [1733, .9, .2, 'highpass'],
        triangle: action === 'muted' ? [2157, .15, .08, 'highpass'] : [2157, .91, .12, 'highpass']
      };
      const [hz, duration, level, type] = action === 'metronome' ? [accent ? 1450 : 1050, .045, .07, 'highpass'] : profiles[instrument];
      const source = context.createOscillator(), gain = context.createGain(), nodes = [source, gain], sources = [source];
      source.frequency.setValueAtTime(hz, start); envelope(gain.gain, [[.0001, start], [level, start + .002], [.0001, start + duration]]);
      source.connect(gain); gain.connect(destination); source.start(start); source.stop(start + duration + .02);
      if (action !== 'metronome' && instrument !== 'triangle') {
        const noise = context.createBufferSource(), filter = context.createBiquadFilter(), noiseGain = context.createGain();
        const length = Math.ceil(context.sampleRate * duration), buffer = context.createBuffer(1, length, context.sampleRate), data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer; filter.type = type; filter.frequency.value = type === 'lowpass' ? 550 : 2000;
        envelope(noiseGain.gain, [[.0001, start], [level * .7, start + .002], [.0001, start + duration]]);
        noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(destination); noise.start(start); noise.stop(start + duration + .02);
        nodes.push(noise, filter, noiseGain); sources.push(noise);
      }
      return managedVoice(sources, nodes, start + duration + .04);
    }

    function scheduleNote(track, event, start, remainingTick) {
      if (!audible(track) || event.velocity <= 0) return;
      const bus = busFor(track), velocity = context.createGain(); velocity.gain.value = event.velocity; velocity.connect(bus.input);
      try {
        let raw;
        if (isPercussion(track.instrumentId)) {
          const adapter = root.PercussionAudio && root.PercussionAudio[track.instrumentId];
          raw = typeof adapter === 'function' ? adapter(percussionContext(velocity), event.action, start, false) :
            fallbackPercussion(track.instrumentId, event.action, start, velocity, false);
        } else raw = pitched(track, event, start, Math.max(.005, remainingTick * secondsPerTick()), velocity);
        register(raw, track.id, start, [velocity]);
      } catch (error) { disconnect(velocity); throw error; }
    }

    function scheduleClick(tick, at) {
      const track = { id: METRONOME, volume: .65, pan: 0, reverb: 0, delay: 0, muted: false, solo: true };
      const bus = busFor(track), accent = Math.abs(tick % BAR) < EPSILON;
      const adapter = root.PercussionAudio && root.PercussionAudio.tamborin;
      register(typeof adapter === 'function' ? adapter(percussionContext(bus.input), 'metronome', at, accent) :
        fallbackPercussion('tamborin', 'metronome', at, bus.input, accent), track.id, at);
    }

    function mapTick(raw) {
      if (project.loop.enabled && raw >= project.loop.endTick) {
        const span = project.loop.endTick - project.loop.startTick;
        return project.loop.startTick + ((raw - project.loop.endTick) % span + span) % span;
      }
      return Math.min(project.length, raw);
    }

    function position() {
      return state === 'playing' && context && project ? mapTick(anchorTick + Math.max(0, context.currentTime - anchorTime) / secondsPerTick()) : cursor;
    }

    function normalizePosition(tick) {
      const clamped = clamp(tick, 0, project ? project.length : 3072, 0);
      return project && project.loop.enabled && clamped >= project.loop.endTick ? project.loop.startTick : clamped;
    }

    function forSegments(from, to, callback) {
      const loop = project.loop, span = loop.endTick - loop.startTick;
      let steps = 0;
      while (from < to - EPSILON && steps++ < 32) {
        let mapped = from, boundary = project.length;
        if (loop.enabled) {
          if (from >= loop.endTick - EPSILON) {
            const cycle = Math.floor((from - loop.endTick + EPSILON) / span);
            const cycleStart = loop.endTick + cycle * span;
            mapped = loop.startTick + Math.max(0, from - cycleStart); boundary = cycleStart + span;
          } else boundary = loop.endTick;
        }
        const end = Math.min(to, boundary);
        if (callback(from, mapped, mapped + end - from) === false) break;
        if (!loop.enabled && end >= project.length) break;
        from = end;
      }
    }

    function firstEntry(tick) {
      let lo = 0, hi = project.entries.length;
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (project.entries[mid].event.tick < tick - EPSILON) lo = mid + 1; else hi = mid; }
      return lo;
    }

    function scheduleWindow(fromTick, toTick, includeTrack = () => true) {
      const unit = secondsPerTick();
      let count = 0;
      forSegments(fromTick, toTick, (absolute, from, end) => {
        for (let index = firstEntry(from); index < project.entries.length; index++) {
          const { track, event } = project.entries[index];
          if (event.tick >= end - EPSILON) break;
          if (!includeTrack(track)) continue;
          if (++count > MAX_BATCH) { warnDensity(); return false; }
          const tickDuration = project.loop.enabled ? Math.min(event.durationTick, project.loop.endTick - event.tick) : event.durationTick;
          scheduleNote(track, event, anchorTime + (absolute - anchorTick + event.tick - from) * unit, tickDuration);
        }
      });
    }

    function fillWindow() {
      const unit = secondsPerTick(), now = context.currentTime;
      const earliest = anchorTick + Math.max(0, now + .003 - anchorTime) / unit;
      const horizon = anchorTick + Math.max(0, now + LOOKAHEAD - anchorTime) / unit;
      scheduleWindow(Math.max(scheduledTo, earliest), horizon);
      scheduledTo = horizon;
      if (metronome) forSegments(Math.max(metroTo, earliest), horizon, (absolute, from, end) => {
        for (let tick = Math.ceil((from - EPSILON) / PPQ) * PPQ; tick < end - EPSILON; tick += PPQ) scheduleClick(tick, anchorTime + (absolute - anchorTick + tick - from) * unit);
      });
      metroTo = horizon;
    }

    function readMeter() {
      let target = 0;
      if (master && master.analyser && master.samples) {
        const samples = master.samples, float = samples instanceof Float32Array;
        if (float) master.analyser.getFloatTimeDomainData(samples); else master.analyser.getByteTimeDomainData(samples);
        let total = 0;
        for (let i = 0; i < samples.length; i++) { const value = float ? samples[i] : (samples[i] - 128) / 128; total += value * value; }
        target = Math.min(1, Math.sqrt(total / samples.length) * 3);
      }
      meter = meter * .65 + target * .35;
      notify('onMeter', clamp(meter, 0, 1));
    }

    function ensureTimer() { if (timer === null && state !== 'disposed') timer = later(pump, INTERVAL); }

    function pump() {
      timer = null;
      if (!context || state === 'disposed') return;
      try {
        for (const voice of [...voices]) if (voice.endAt + .035 < context.currentTime) voice.cancel();
        if (state === 'playing') {
          if (context.state && context.state !== 'running') { pause(); return; }
          const tick = position(); cursor = tick; notify('onPosition', tick);
          if (state !== 'playing') return;
          if (!project.loop.enabled && tick >= project.length - EPSILON) { cursor = project.length; setState('idle', 'Playback selesai.'); }
          else fillWindow();
        }
        readMeter();
        if (state === 'playing' || voices.size || context.currentTime < tailsUntil) ensureTimer();
        else { for (const id of [...buses.keys()]) destroyBus(id); meter = 0; notify('onMeter', 0); }
      } catch (error) {
        ++epoch; clearTimer(); silence(); setState('idle', error && error.message || 'Audio tidak dapat dimainkan.');
      }
    }

    function scheduleCarries(tick, at, includeTrack = () => true) {
      let carry = 0;
      for (const { track, event } of project.entries) {
        if (carry >= MAX_BATCH) { warnDensity(); break; }
        if (includeTrack(track) && audible(track) && !isPercussion(track.instrumentId) && event.tick < tick - EPSILON && event.tick + event.durationTick > tick &&
          (!project.loop.enabled || tick < project.loop.startTick || event.tick >= project.loop.startTick)) {
          const end = project.loop.enabled ? Math.min(event.tick + event.durationTick, project.loop.endTick) : event.tick + event.durationTick;
          scheduleNote(track, event, at, end - tick); carry++;
        }
      }
    }

    function startAt(tick) {
      cursor = normalizePosition(tick); anchorTick = cursor; anchorTime = context.currentTime + START_DELAY;
      scheduledTo = anchorTick; metroTo = anchorTick; densityWarned = false;
      applyMixer();
      // Resume a held pitched note at its remaining gate; do not re-strike old drums.
      scheduleCarries(cursor, anchorTime);
      setState('playing'); notify('onPosition', cursor);
      if (state === 'playing') pump();
    }

    async function play(input, startTick) {
      if (state === 'disposed') return false;
      let next;
      try { next = normalize(input); } catch (error) { notify('onState', state, error.message); return false; }
      const requested = startTick === undefined ? (cursor >= next.length ? 0 : position()) : startTick;
      const operation = ++epoch; clearTimer(); silence(); project = next; cursor = normalizePosition(requested);
      setState('pending'); notify('onPosition', cursor);
      try {
        if (operation !== epoch || state === 'disposed') return false;
        const audio = ensureContext();
        // resume() is invoked before the first await, inside the user's gesture.
        if (audio.state !== 'running' && typeof audio.resume === 'function') await audio.resume();
        if (operation !== epoch || state === 'disposed') return false;
        if (audio.state && audio.state !== 'running') throw Error('Benarkan audio kemudian tekan Main semula.');
        startAt(cursor); return state === 'playing';
      } catch (error) {
        if (operation === epoch && state !== 'disposed') { clearTimer(); silence(); setState('idle', error && error.message || 'Audio tidak tersedia.'); }
        return false;
      }
    }

    function pause() {
      if (state === 'disposed') return cursor;
      cursor = position(); ++epoch; clearTimer(); silence(); setState('paused'); notify('onPosition', cursor); return cursor;
    }

    function stop() {
      if (state === 'disposed') return 0;
      ++epoch; clearTimer(); silence(); cursor = 0; setState('idle'); notify('onPosition', 0); return 0;
    }

    function seek(tick) {
      if (state === 'disposed') return cursor;
      const playing = state === 'playing'; ++epoch; clearTimer(); silence(); cursor = normalizePosition(tick);
      if (playing && project && context && context.state === 'running') startAt(cursor);
      else { setState('paused'); notify('onPosition', cursor); }
      return cursor;
    }

    function update(input) {
      if (state === 'disposed') return false;
      let next;
      try { next = normalize(input); } catch (error) { notify('onState', state, error.message); return false; }
      const previous = project, tick = position(), playing = state === 'playing', pending = state === 'pending';
      const changed = !previous || previous.signature !== next.signature;
      const previousSolo = previous && previous.tracks.some(track => track.solo), nextSolo = next.tracks.some(track => track.solo);
      const newlyAudible = new Set(next.tracks.filter(track => {
        const oldTrack = previous && previous.tracks.find(item => item.id === track.id);
        const wasAudible = oldTrack && !oldTrack.muted && (!previousSolo || oldTrack.solo);
        return !wasAudible && !track.muted && (!nextSolo || track.solo);
      }).map(track => track.id));
      project = next; cursor = normalizePosition(tick);
      if (changed) {
        ++epoch; clearTimer(); silence();
        if (playing && context && context.state === 'running') startAt(cursor);
        else if (pending) { setState('paused', 'Projek berubah; tekan Main untuk menyambung.'); notify('onPosition', cursor); }
      } else {
        for (const track of next.tracks) if (!audible(track)) { cancelVoices(voice => voice.trackId === track.id); destroyBus(track.id); }
        applyMixer();
        if (playing && newlyAudible.size) {
          const at = Math.max(anchorTime, context.currentTime + .003);
          const absolute = anchorTick + (at - anchorTime) / secondsPerTick();
          // Restore only newly audible recorder gates and their missing queued
          // onsets. Other tracks and the metronome retain their existing voices.
          scheduleCarries(mapTick(absolute), at, track => newlyAudible.has(track.id) && track.instrumentId === 'recorder');
          scheduleWindow(absolute, scheduledTo, track => newlyAudible.has(track.id));
          fillWindow();
        }
      }
      return true;
    }

    async function audition(inputTrack, inputEvent) {
      if (state === 'disposed' || !inputTrack || !inputEvent) return false;
      const track = normalizeTrack({ ...inputTrack, events: [{ ...inputEvent, tick: 0 }] }, 0, project ? project.length : 3072);
      if (!track || !track.events.length) return false;
      const actual = project && project.tracks.find(item => item.id === track.id) || track;
      if (!audible(actual) || track.events[0].velocity <= 0) return false;
      const operation = epoch;
      try {
        const audio = ensureContext();
        if (audio.state !== 'running' && typeof audio.resume === 'function') await audio.resume();
        if (operation !== epoch || state === 'disposed' || (audio.state && audio.state !== 'running')) return false;
        const liveTrack = project && project.tracks.find(item => item.id === track.id) || track;
        if (!audible(liveTrack)) return false;
        applyMixer(); scheduleNote(liveTrack, track.events[0], audio.currentTime + .008, track.events[0].durationTick); ensureTimer(); return true;
      } catch (error) { if (operation === epoch && state !== 'disposed') notify('onState', state, error && error.message || 'Audio tidak tersedia.'); return false; }
    }

    function setMetronome(enabled) {
      if (state === 'disposed') return false;
      if (metronome === !!enabled) return metronome;
      metronome = !!enabled;
      if (!metronome) { cancelVoices(voice => voice.trackId === METRONOME); destroyBus(METRONOME); }
      else if (state === 'playing') { metroTo = anchorTick + Math.max(0, context.currentTime + .003 - anchorTime) / secondsPerTick(); fillWindow(); }
      return metronome;
    }

    function dispose() {
      if (state === 'disposed') return;
      ++epoch; clearTimer(); silence();
      if (master) for (const node of master.nodes) disconnect(node);
      if (context && typeof context.close === 'function') try { const closed = context.close(); if (closed && typeof closed.catch === 'function') closed.catch(() => {}); } catch (_) {}
      impulse = null; setState('disposed');
    }

    return Object.freeze({ play, pause, stop, seek, update, audition, getState: () => state,
      getPosition: position, setMetronome, dispose });
  }

  root.ProStudioAudio = Object.freeze({ createEngine });
})(typeof window === 'undefined' ? globalThis : window);
