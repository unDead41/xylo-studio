const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('studio-pro/audio.js', 'utf8');
const percussionSource = fs.readFileSync('index.html', 'utf8').match(/<script id="percussion-audio">([\s\S]*?)<\/script>/)[1];
const clone = value => JSON.parse(JSON.stringify(value));
const note = (tick = 0, overrides = {}) => ({ id: 'e-' + tick, tick, durationTick: 6, midi: 72, action: null, velocity: .8, ...overrides });
const track = (id = 'a', overrides = {}) => ({ id, name: id, instrumentId: 'xylophone', volume: .8, pan: 0,
  muted: false, solo: false, reverb: 0, delay: 0, events: [note()], ...overrides });
const project = (overrides = {}) => ({ schema: 'e-instru-project/v1', bpm: 120, lengthBars: 4,
  loop: { enabled: false, startTick: 0, endTick: 384 }, master: { volume: .8 }, tracks: [track()], ...overrides });

function harness({ deferred = false, optional = true, percussion = 'spy', noAudio = false } = {}) {
  let wall = 0, nextTimer = 1;
  const contexts = [], timers = new Map(), positions = [], states = [], meters = [], calls = [];
  function parameter(initial = 0) {
    return { value: initial, events: [], setValueAtTime(value, at) { this.value = value; this.events.push(['set', value, at]); },
      exponentialRampToValueAtTime(value, at) { this.value = value; this.events.push(['exponential', value, at]); },
      setTargetAtTime(value, at, constant) { this.value = value; this.events.push(['target', value, at, constant]); },
      cancelScheduledValues(at) { this.events.push(['cancel', at]); } };
  }
  class AudioContext {
    constructor() {
      this.offset = wall / 1000; this.state = 'suspended'; this.sampleRate = 4000; this.destination = { kind: 'destination' };
      this.nodes = []; this.sources = []; this.resumeCalls = 0; this.closeCalls = 0; this.waiters = [];
      if (!optional) for (const method of ['createDynamicsCompressor', 'createAnalyser', 'createConvolver', 'createDelay', 'createStereoPanner']) this[method] = undefined;
      contexts.push(this);
    }
    get currentTime() { return wall / 1000 - this.offset; }
    node(kind) {
      const context = this;
      const node = { kind, connections: [], disconnects: 0, gain: parameter(1), frequency: parameter(), pan: parameter(),
        delayTime: parameter(), threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter(),
        connect(destination) { this.connections.push(destination); return destination; },
        disconnect() { this.connections = []; this.disconnects++; },
        start(at) { this.startAt = at; }, stop(at) { (this.stops ||= []).push(at); },
        getFloatTimeDomainData(samples) { samples.fill(.1); },
        getByteTimeDomainData(samples) { samples.fill(141); }, context };
      this.nodes.push(node); return node;
    }
    createGain() { return this.node('gain'); }
    createOscillator() { const node = this.node('oscillator'); this.sources.push(node); return node; }
    createBufferSource() { const node = this.node('bufferSource'); this.sources.push(node); return node; }
    createBiquadFilter() { return this.node('filter'); }
    createStereoPanner() { return this.node('panner'); }
    createConvolver() { return this.node('convolver'); }
    createDelay() { return this.node('delay'); }
    createDynamicsCompressor() { return this.node('compressor'); }
    createAnalyser() { return this.node('analyser'); }
    createBuffer(channels, length, rate) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { channels, length, rate, getChannelData: index => data[index] }; }
    resume() {
      this.resumeCalls++;
      if (!deferred) { this.state = 'running'; return Promise.resolve(); }
      return new Promise(resolve => this.waiters.push(() => { this.state = 'running'; resolve(); }));
    }
    resolveResume() { for (const waiter of this.waiters.splice(0)) waiter(); }
    close() { this.closeCalls++; this.state = 'closed'; return Promise.resolve(); }
  }
  const window = { setTimeout(fn, delay) { const id = nextTimer++; timers.set(id, { fn, at: wall + delay }); return id; },
    clearTimeout(id) { timers.delete(id); } };
  if (!noAudio) window.AudioContext = AudioContext;
  const sandbox = { window }; vm.createContext(sandbox);
  if (percussion === 'actual') vm.runInContext(percussionSource, sandbox);
  else if (percussion === 'spy') {
    window.PercussionAudio = Object.fromEntries(['tamborin', 'kompang', 'snare', 'bass_drum', 'cymbals', 'triangle'].map(instrument =>
      [instrument, (audio, action, at, accent) => {
        const call = { instrument, action, at, accent, destination: audio.destination, cancelled: 0 }; calls.push(call);
        return { endAt: at + .3, cancel() { call.cancelled++; } };
      }]));
  }
  vm.runInContext(source, sandbox);
  const engine = window.ProStudioAudio.createEngine({ onPosition: tick => positions.push(tick),
    onState: (state, message) => states.push({ state, message }), onMeter: level => meters.push(level) });
  function advance(ms, runTimers = true) {
    const target = wall + ms;
    if (runTimers) {
      let guard = 0;
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        assert.ok(++guard < 10000, 'timer loop must remain bounded'); wall = next[1].at; timers.delete(next[0]); next[1].fn();
      }
    }
    wall = target;
  }
  function runOverdue() {
    for (const [id, timer] of [...timers]) if (timer.at <= wall) { timers.delete(id); timer.fn(); }
  }
  return { engine, window, contexts, timers, positions, states, meters, calls, advance, runOverdue };
}

test('play creates an independent context, synchronizes tracks, and schedules only a short window', async () => {
  const h = harness(), p = project({ tracks: [track('a', { events: [note(0), note(24)] }), track('b')] });
  const before = JSON.stringify(p);
  assert.equal(await h.engine.play(p), true);
  assert.equal(h.contexts.length, 1);
  const audio = h.contexts[0]; assert.equal(audio.resumeCalls, 1); assert.equal(h.engine.getState(), 'playing');
  assert.equal(audio.sources.length, 6, 'two notes, three partials each');
  assert.ok(audio.sources.every(source => source.startAt === .025));
  h.advance(350); assert.equal(audio.sources.length, 6, 'beat one is outside the initial lookahead');
  h.advance(100); assert.equal(audio.sources.length, 9); assert.ok(audio.sources.slice(6).every(source => Math.abs(source.startAt - .525) < 1e-8));
  assert.equal(JSON.stringify(p), before, 'audio never changes the supplied project');
  h.engine.dispose();
});

test('pause keeps AudioContext cursor; resume reconstructs the remaining recorder gate', async () => {
  const h = harness(), p = project({ tracks: [track('r', { instrumentId: 'recorder', events: [note(0, { durationTick: 96 })] })] });
  await h.engine.play(p); h.advance(500);
  const cursor = h.engine.getPosition(); assert.ok(Math.abs(cursor - 22.8) < 1e-8);
  const old = [...h.contexts[0].sources];
  assert.equal(h.engine.pause(), cursor); h.advance(200);
  assert.equal(h.engine.getPosition(), cursor); assert.equal(h.engine.getState(), 'paused'); assert.equal(h.timers.size, 0);
  assert.ok(old.every(source => source.stops.includes(undefined)));
  await h.engine.play(p); const resumed = h.contexts[0].sources.slice(old.length);
  assert.equal(resumed.length, 3); assert.ok(Math.abs(resumed[0].stops[0] - resumed[0].startAt - ((96 - cursor) / 48 + .06)) < 1e-8);
  h.engine.dispose();
});

test('stop invalidates pending play before AudioContext resume resolves', async () => {
  const h = harness({ deferred: true }), pending = h.engine.play(project());
  assert.equal(h.engine.getState(), 'pending'); assert.equal(h.contexts[0].resumeCalls, 1, 'resume is called synchronously in the gesture');
  h.engine.stop(); h.contexts[0].resolveResume(); assert.equal(await pending, false); h.advance(1000);
  assert.equal(h.contexts[0].sources.length, 0); assert.equal(h.timers.size, 0); assert.equal(h.engine.getState(), 'idle'); assert.equal(h.engine.getPosition(), 0);
  h.engine.dispose();
});

test('a newer pending play wins and disposed audition cannot create a late note', async () => {
  const h = harness({ deferred: true }), a = h.engine.play(project()), b = h.engine.play(project(), 24);
  h.contexts[0].resolveResume(); assert.equal(await a, false); assert.equal(await b, true);
  assert.equal(h.engine.getPosition(), 24); h.engine.dispose();
  const q = harness({ deferred: true }), audition = q.engine.audition(track(), note());
  q.engine.dispose(); q.contexts[0].resolveResume(); assert.equal(await audition, false); assert.equal(q.contexts[0].sources.length, 0);
  assert.equal(q.contexts[0].closeCalls, 1); assert.equal(q.engine.getState(), 'disposed');
});

test('muting a track while its audition awaits resume prevents a late note', async () => {
  const h = harness({ deferred: true }), p = project(); h.engine.update(p);
  const audition = h.engine.audition(p.tracks[0], p.tracks[0].events[0]);
  const muted = clone(p); muted.tracks[0].muted = true; h.engine.update(muted);
  h.contexts[0].resolveResume(); assert.equal(await audition, false);
  assert.equal(h.contexts[0].sources.length, 0); assert.equal(h.timers.size, 0); h.engine.dispose();
});

test('seek replaces the queued future window without leaving old voices', async () => {
  const h = harness(), p = project({ tracks: [track('a', { events: [note(0), note(3), note(96)] })] });
  await h.engine.play(p); const old = [...h.contexts[0].sources];
  assert.equal(old.length, 6); h.engine.seek(96);
  assert.equal(h.engine.getPosition(), 96); assert.ok(old.every(source => source.stops.includes(undefined)));
  const later = h.contexts[0].sources.slice(old.length); assert.equal(later.length, 3);
  h.engine.stop(); assert.ok(later.every(source => source.stops.includes(undefined))); assert.equal(h.timers.size, 0);
});

test('loop uses its start/end region, repeats in time, and excludes end-boundary notes', async () => {
  const h = harness(), p = project({ loop: { enabled: true, startTick: 24, endTick: 48 },
    tracks: [track('drum', { instrumentId: 'kompang', events: [note(0, { midi: null, action: 'center' }), note(24, { midi: null, action: 'edge' }), note(48, { midi: null, action: 'center' })] })] });
  await h.engine.play(p, 24); h.advance(1200);
  assert.deepEqual(h.calls.map(call => call.action), ['edge', 'edge', 'edge']);
  assert.deepEqual(h.calls.map(call => Math.round(call.at * 1000)), [25, 525, 1025]);
  assert.ok(h.engine.getPosition() >= 24 && h.engine.getPosition() < 48);
  h.engine.stop(); assert.ok(h.calls.every(call => call.cancelled === 1));
});

test('a loop can play its initial pre-roll once and reset an out-of-region seek to loop start', async () => {
  const h = harness(), p = project({ loop: { enabled: true, startTick: 12, endTick: 24 }, tracks: [track('d', { instrumentId: 'snare', events: [0, 12, 24].map(tick => note(tick, { midi: null, action: 'hit' })) })] });
  await h.engine.play(p, 0); h.advance(850);
  assert.deepEqual(h.calls.map(call => Math.round(call.at * 1000)), [25, 275, 525, 775]);
  h.engine.seek(100); assert.equal(h.engine.getPosition(), 12); h.engine.dispose();
});

test('mute and solo cancel queued voices and effect tails, unmute rebuilds only future notes', async () => {
  const h = harness(), p = project({ tracks: [track('a', { instrumentId: 'snare', reverb: .5, delay: .5, events: [note(0, { midi: null, action: 'hit' }), note(3, { midi: null, action: 'rim' })] }), track('b', { instrumentId: 'triangle', events: [note(0, { midi: null, action: 'open' })] })] });
  await h.engine.play(p); assert.equal(h.calls.length, 3);
  const oldNodes = [...h.contexts[0].nodes], changed = clone(p); changed.tracks[1].solo = true; h.engine.update(changed);
  assert.ok(h.calls.filter(call => call.instrument === 'snare').every(call => call.cancelled === 1));
  assert.ok(oldNodes.filter(node => node.kind === 'delay' || node.kind === 'convolver').some(node => node.disconnects > 0));
  assert.equal(h.calls.filter(call => !call.cancelled && call.instrument === 'snare').length, 0);
  changed.tracks[1].solo = false; h.advance(10); h.engine.update(changed);
  assert.equal(h.calls.filter(call => !call.cancelled && call.instrument === 'snare').length, 2, 'both not-yet-started hits return to the future window');
  h.engine.stop(); assert.ok(h.calls.every(call => call.cancelled === 1));
});

test('unmuting a held recorder restores its remaining gate and queued onsets without disturbing other voices', async () => {
  const h = harness(), p = project({ tracks: [
    track('r', { instrumentId: 'recorder', events: [note(0, { durationTick: 96 }), note(50, { midi: 74 })] }),
    track('other', { instrumentId: 'recorder', events: [note(0, { midi: 76, durationTick: 96 }), note(50, { midi: 77 })] })
  ] });
  await h.engine.play(p); const audio = h.contexts[0], original = [...audio.sources], unaffected = original.slice(3);
  h.advance(500); const muted = clone(p); muted.tracks[0].muted = true; h.engine.update(muted);
  assert.ok(original.slice(0, 3).every(source => source.stops.includes(undefined)));
  assert.ok(unaffected.every(source => !source.stops.includes(undefined)));
  h.advance(500); assert.ok(Math.abs(h.engine.getPosition() - 46.8) < 1e-8);
  const before = audio.sources.length, queued = audio.sources.slice(original.length);
  assert.equal(queued.length, 3, 'the unaffected track already has its next onset queued');
  h.engine.update(p);
  const restored = audio.sources.slice(before), carry = restored.filter(source => Math.abs(source.startAt - 1.003) < 1e-8);
  assert.equal(restored.length, 6, 'three carry partials and three missing future partials'); assert.equal(carry.length, 3);
  assert.ok(carry.every(source => Math.abs(source.stops[0] - 2.085) < 1e-8), 'carry ends at the original note-off plus release');
  assert.ok([...unaffected, ...queued].every(source => source.stops.length === 1), 'existing sound and future sources are never stopped or restarted');
  const count = audio.sources.length; h.engine.update(p); h.engine.update(p); h.advance(150);
  assert.equal(audio.sources.length, count, 'repeated mixer updates and timer refills do not duplicate queued onsets');
  h.engine.stop(); assert.ok(audio.sources.every(source => source.stops.includes(undefined))); h.engine.dispose();
});

test('releasing solo restores only newly audible recorder gates and never re-strikes old percussion', async () => {
  const h = harness(), p = project({ tracks: [
    track('solo', { instrumentId: 'recorder', solo: true, events: [note(0, { durationTick: 96 })] }),
    track('return', { instrumentId: 'recorder', events: [note(0, { midi: 79, durationTick: 96 })] }),
    track('drum', { instrumentId: 'snare', events: [note(0, { midi: null, action: 'hit', durationTick: 96 })] })
  ] });
  await h.engine.play(p); const audio = h.contexts[0], original = [...audio.sources]; assert.equal(original.length, 3);
  h.advance(900); const released = clone(p); released.tracks[0].solo = false; h.engine.update(released);
  const carry = audio.sources.slice(original.length); assert.equal(carry.length, 3);
  assert.ok(carry.every(source => Math.abs(source.startAt - .903) < 1e-8 && Math.abs(source.stops[0] - 2.085) < 1e-8));
  assert.ok(original.every(source => source.stops.length === 1)); assert.equal(h.calls.length, 0, 'a past drum hit does not resume');
  h.engine.dispose();
});

test('a newly audible recorder carry is clipped at the loop end and the following loop onset occurs once', async () => {
  const h = harness(), p = project({ loop: { enabled: true, startTick: 24, endTick: 48 }, tracks: [
    track('r', { instrumentId: 'recorder', muted: true, events: [note(24, { durationTick: 96 })] })
  ] });
  await h.engine.play(p, 24); h.advance(200); assert.equal(h.contexts[0].sources.length, 0);
  const unmuted = clone(p); unmuted.tracks[0].muted = false; h.engine.update(unmuted);
  const carry = [...h.contexts[0].sources]; assert.equal(carry.length, 3);
  assert.ok(carry.every(source => Math.abs(source.startAt - .203) < 1e-8 && Math.abs(source.stops[0] - .585) < 1e-8));
  h.advance(400); const nextLoop = h.contexts[0].sources.slice(carry.length); assert.equal(nextLoop.length, 3);
  assert.ok(nextLoop.every(source => Math.abs(source.startAt - .525) < 1e-8));
  h.engine.dispose();
});

test('mixer edits change faders, pan, sends and master without restarting sounding notes', async () => {
  const h = harness(), p = project({ tracks: [track('r', { instrumentId: 'recorder', events: [note(0, { durationTick: 96 })] })] });
  await h.engine.play(p); h.advance(60);
  const audio = h.contexts[0], sources = [...audio.sources], changed = clone(p);
  changed.master.volume = .35; Object.assign(changed.tracks[0], { volume: .4, pan: -.75, reverb: .7, delay: .5 });
  h.engine.update(changed);
  assert.equal(audio.sources.length, sources.length); assert.ok(sources.every(source => !source.stops.includes(undefined)));
  assert.equal(audio.nodes.find(node => node.kind === 'panner').pan.value, -.75);
  assert.ok(audio.nodes.some(node => node.kind === 'gain' && node.gain.value === .4));
  assert.ok(audio.nodes.some(node => node.kind === 'gain' && node.gain.value === .35));
  assert.ok(audio.nodes.some(node => node.kind === 'gain' && Math.abs(node.gain.value - .385) < 1e-8));
  assert.equal(audio.nodes.find(node => node.kind === 'compressor').ratio.value, 3);
  assert.ok(h.meters.some(level => level > 0 && level <= 1)); h.engine.dispose();
});

test('tempo/event edits keep the musical cursor and cancel all obsolete audio', async () => {
  const h = harness(), p = project({ tracks: [track('a', { events: [note(0), note(48)] })] });
  await h.engine.play(p); h.advance(400); const tick = h.engine.getPosition(), old = [...h.contexts[0].sources];
  const changed = clone(p); changed.bpm = 60; changed.tracks[0].events = [note(24, { midi: 76 })];
  assert.equal(h.engine.update(changed), true); assert.ok(Math.abs(h.engine.getPosition() - tick) < 1e-8);
  assert.ok(old.every(source => source.stops.includes(undefined))); h.advance(300);
  const newSources = h.contexts[0].sources.slice(old.length); assert.equal(newSources.length, 3);
  assert.ok(newSources[0].frequency.events.some(event => Math.abs(event[1] - 440 * 2 ** ((76 - 69) / 12)) < 1e-8)); h.engine.dispose();
});

test('a tempo edit during audio interruption leaves a resumable paused transport at the same tick', async () => {
  const h = harness(), p = project({ tracks: [track('r', { instrumentId: 'recorder', events: [note(0, { durationTick: 96 })] })] });
  await h.engine.play(p); h.advance(500); const tick = h.engine.getPosition(), audio = h.contexts[0], old = [...audio.sources];
  audio.state = 'suspended'; const slower = clone(p); slower.bpm = 60;
  assert.equal(h.engine.update(slower), true); assert.equal(h.engine.getState(), 'paused');
  assert.ok(Math.abs(h.engine.getPosition() - tick) < 1e-8); assert.equal(h.timers.size, 0);
  assert.ok(old.every(source => source.stops.includes(undefined)));
  assert.equal(await h.engine.play(slower), true); assert.ok(Math.abs(h.engine.getPosition() - tick) < 1e-8);
  assert.equal(audio.sources.length - old.length, 3, 'the held recorder note resumes at the updated tempo'); h.engine.dispose();
});

test('late timer wakeups skip old onsets instead of playing a backlog', async () => {
  const h = harness(), p = project({ tracks: [track('d', { instrumentId: 'bass_drum', events: [0, 6, 12, 18, 24, 30, 36, 42, 48].map(tick => note(tick, { midi: null, action: 'hit' })) })] });
  await h.engine.play(p); assert.equal(h.calls.length, 1);
  h.advance(900, false); h.runOverdue();
  assert.ok(h.calls.every(call => call.at === .025 || call.at >= .903));
  assert.ok(h.calls.length < 5); assert.ok(h.engine.getPosition() > 40); h.engine.dispose();
});

test('a late timer restores a missed active recorder gate without duplicating scheduled notes or old drums', async () => {
  const h = harness(), p = project({ tracks: [
    track('r', { instrumentId: 'recorder', events: [note(0, { durationTick: 96 }), note(24, { midi: 79, durationTick: 96 })] }),
    track('expired', { instrumentId: 'recorder', events: [note(24, { midi: 76, durationTick: 6 })] }),
    track('d', { instrumentId: 'snare', events: [note(24, { midi: null, action: 'hit' })] })
  ] });
  await h.engine.play(p); const audio = h.contexts[0], original = [...audio.sources]; assert.equal(original.length, 3);
  h.advance(900, false); h.runOverdue();
  const carry = audio.sources.slice(original.length); assert.equal(carry.length, 3, 'the missed held note returns once');
  assert.ok(carry.every(source => Math.abs(source.startAt - .903) < 1e-8 && Math.abs(source.stops[0] - 2.585) < 1e-8));
  assert.ok(original.every(source => source.stops.length === 1), 'an already scheduled long gate remains intact');
  assert.equal(h.calls.length, 0, 'expired drum onsets are skipped');
  h.advance(200); assert.equal(audio.sources.length, 6, 'the next refills do not duplicate the recovered gate'); h.engine.dispose();
});

test('late loop recovery restores only the current cycle and clips its gate at the loop boundary', async () => {
  const h = harness(), p = project({ loop: { enabled: true, startTick: 24, endTick: 48 }, tracks: [
    track('r', { instrumentId: 'recorder', events: [note(24, { durationTick: 96 })] }),
    track('d', { instrumentId: 'snare', events: [note(24, { midi: null, action: 'hit' })] })
  ] });
  await h.engine.play(p, 24); const audio = h.contexts[0]; h.advance(1100, false); h.runOverdue();
  const carry = audio.sources.slice(3); assert.equal(carry.length, 3, 'older missed loop cycles are not replayed');
  assert.ok(carry.every(source => Math.abs(source.startAt - 1.103) < 1e-8 && Math.abs(source.stops[0] - 1.585) < 1e-8));
  assert.equal(h.calls.length, 1); h.advance(450); assert.equal(audio.sources.length, 9);
  assert.deepEqual(h.calls.map(call => Math.round(call.at * 1000)), [25, 1525]); h.engine.dispose();
});

test('unmuting during a delayed refill restores each held gate once', async () => {
  const h = harness(), p = project({ tracks: [track('r', { instrumentId: 'recorder', muted: true,
    events: [note(24, { durationTick: 96 })] })] });
  await h.engine.play(p); h.advance(900, false);
  const unmuted = clone(p); unmuted.tracks[0].muted = false; h.engine.update(unmuted); h.runOverdue();
  assert.equal(h.contexts[0].sources.length, 3, 'unmute carry and missed-onset recovery share one restored gate');
  h.advance(200); assert.equal(h.contexts[0].sources.length, 3); h.engine.dispose();
});

test('metronome is 4/4, remains independent of solo, and cancels when disabled', async () => {
  const h = harness(), p = project({ bpm: 200, tracks: [track('a', { muted: true, solo: true, events: [] })] });
  h.engine.setMetronome(true); await h.engine.play(p); h.advance(1280);
  const clicks = h.calls.filter(call => call.action === 'metronome');
  assert.deepEqual(clicks.map(call => call.accent), [true, false, false, false, true]);
  assert.deepEqual(clicks.map(call => Math.round(call.at * 1000)), [25, 325, 625, 925, 1225]);
  const before = h.calls.length; h.engine.setMetronome(true); assert.equal(h.calls.length, before, 'setting an enabled metronome is idempotent');
  h.engine.setMetronome(false); assert.ok(clicks.every(call => call.cancelled === 1));
  const count = h.calls.length; h.advance(500); assert.equal(h.calls.length, count); h.engine.dispose();
});

test('zero velocity is silent and audition obeys pitch, gate, volume and actual percussion actions', async () => {
  const h = harness(); h.engine.update(project({ tracks: [track('r', { instrumentId: 'recorder', events: [] })] }));
  assert.equal(await h.engine.audition(track('r', { instrumentId: 'recorder' }), note(0, { velocity: 0 })), false);
  assert.equal(h.contexts.length, 0);
  assert.equal(await h.engine.audition(track('r', { instrumentId: 'recorder' }), note(0, { midi: 84, durationTick: 48 })), true);
  const voice = h.contexts[0].sources[0]; assert.equal(voice.frequency.events[0][1], 440 * 2 ** ((84 - 69) / 12));
  assert.ok(Math.abs(voice.stops[0] - voice.startAt - 1.06) < 1e-8);
  assert.equal(await h.engine.audition(track('d', { instrumentId: 'kompang' }), note(0, { midi: null, action: 'center' })), true);
  assert.equal(h.calls.at(-1).action, 'center'); assert.notEqual(h.calls.at(-1).destination, h.contexts[0].destination, 'percussion must pass through the track graph');
  assert.equal(await h.engine.audition(track('d', { instrumentId: 'kompang' }), note(0, { midi: null, action: 'tap' })), false);
  h.engine.stop(); assert.equal(voice.stops.at(-1), undefined); assert.equal(h.meters.at(-1), 0); h.engine.dispose();
});

test('the real percussion owner can use bound native-context methods and is cancellable', async () => {
  const h = harness({ percussion: 'actual' }), instruments = { tamborin: 'shake', kompang: 'edge', snare: 'rim', bass_drum: 'soft', cymbals: 'crash', triangle: 'muted' };
  const tracks = Object.entries(instruments).map(([instrumentId, action]) => track(instrumentId, { instrumentId, events: [note(0, { midi: null, action })] }));
  await h.engine.play(project({ tracks })); const audio = h.contexts[0]; assert.ok(audio.sources.length > 10);
  assert.ok(audio.sources.every(source => source.startAt >= .025));
  h.engine.stop(); assert.ok(audio.sources.every(source => source.stops.includes(undefined)));
  assert.ok(audio.nodes.every(node => node.connections.length === 0 || ['compressor', 'analyser', 'gain'].includes(node.kind)));
  h.engine.dispose(); assert.ok(audio.nodes.every(node => node.connections.length === 0));
});

test('all actual starter projects schedule every track and finish with no remaining voices or timers', async () => {
  for (const kind of ['melody-percussion', 'school-rhythm', 'march']) {
    const h = harness({ percussion: 'actual' }), box = { window: h.window }, calls = [];
    vm.createContext(box); vm.runInContext(fs.readFileSync('studio-pro/core.js', 'utf8'), box);
    vm.runInContext(fs.readFileSync('studio-pro/projects.js', 'utf8'), box);
    const p = h.window.ProStudioProjects.createStarter(kind), before = JSON.stringify(p), actual = h.window.PercussionAudio;
    h.window.PercussionAudio = Object.fromEntries(Object.entries(actual).map(([instrument, voice]) => [instrument, (...args) => {
      calls.push({ instrument, action: args[1], at: args[2] }); return voice(...args);
    }]));
    assert.equal(await h.engine.play(p), true, kind);
    h.advance(25 + p.lengthBars * 4 * 60 / p.bpm * 1000 + 100);
    assert.equal(h.engine.getState(), 'idle'); assert.equal(h.engine.getPosition(), p.lengthBars * 96);
    for (const part of p.tracks) {
      if (part.instrumentId === 'xylophone' || part.instrumentId === 'recorder') {
        for (const event of part.events) {
          const at = .025 + event.tick * 60 / p.bpm / 24, hz = 440 * 2 ** ((event.midi - 69) / 12);
          assert.ok(h.contexts[0].sources.some(source => Math.abs(source.startAt - at) < 1e-8 && Math.abs(source.frequency.events[0]?.[1] - hz) < 1e-8), kind + ' plays every pitched onset');
        }
      } else {
        const played = calls.filter(call => call.instrument === part.instrumentId); assert.equal(played.length, part.events.length, kind + ' plays every percussion onset');
        for (const event of part.events) assert.ok(played.some(call => call.action === event.action && Math.abs(call.at - (.025 + event.tick * 60 / p.bpm / 24)) < 1e-8));
      }
    }
    assert.equal(JSON.stringify(p), before, 'playback preserves the original project');
    h.advance(3000); assert.equal(h.timers.size, 0); assert.ok(h.contexts[0].sources.every(source => source.connections.length === 0)); h.engine.dispose();
  }
});

test('optional Web Audio features and a missing shared percussion adapter have working fallbacks', async () => {
  const h = harness({ optional: false, percussion: 'absent' });
  await h.engine.play(project({ tracks: [track('t', { instrumentId: 'tamborin', events: [note(0, { midi: null, action: 'tap' })] })] }));
  assert.equal(h.contexts[0].sources.length, 2); assert.equal(h.engine.getState(), 'playing'); h.engine.stop();
  assert.ok(h.contexts[0].sources.every(source => source.stops.includes(undefined))); h.engine.dispose();
});

test('pathological one-tick loops and polyphony stay bounded and stop has no remaining timer', async () => {
  const h = harness(), events = Array.from({ length: 512 }, (_, id) => note(0, { id: 'dense-' + id, midi: null, action: 'hit' }));
  await h.engine.play(project({ bpm: 200, loop: { enabled: true, startTick: 0, endTick: 1 }, tracks: [track('s', { instrumentId: 'snare', events })] }));
  assert.ok(h.calls.length <= 256); h.advance(25); assert.ok(h.calls.length <= 512);
  assert.ok(h.calls.filter(call => !call.cancelled).length <= 256); assert.ok(h.states.some(state => /Had bunyi/.test(state.message)));
  h.engine.stop(); assert.equal(h.timers.size, 0); assert.ok(h.calls.every(call => call.cancelled === 1)); h.advance(1000); assert.ok(h.calls.length <= 512);
});

test('dense muted, solo-excluded, and zero-velocity notes cannot starve an audible track', async () => {
  for (const mode of ['muted', 'solo', 'zero']) {
    const h = harness(), events = Array.from({ length: 512 }, (_, id) => note(0, { id: 'silent-' + id, midi: null, action: 'hit', velocity: mode === 'zero' ? 0 : .8 }));
    const p = project({ tracks: [track('dense', { instrumentId: 'snare', muted: mode === 'muted', events }),
      track('audible', { instrumentId: 'triangle', solo: mode === 'solo', events: [note(0, { midi: null, action: 'open' })] })] });
    await h.engine.play(p); assert.equal(h.calls.length, 1, mode + ' notes leave room for the audible track');
    assert.equal(h.calls[0].instrument, 'triangle'); assert.ok(!h.states.some(state => /Had bunyi/.test(state.message))); h.engine.dispose();
  }
  const h = harness(), events = Array.from({ length: 512 }, (_, id) => note(0, { id: 'silent-carry-' + id, durationTick: 96, velocity: 0 }));
  await h.engine.play(project({ tracks: [track('zero', { instrumentId: 'recorder', events }),
    track('audible', { instrumentId: 'recorder', events: [note(0, { midi: 79, durationTick: 96 })] })] }), 24);
  assert.equal(h.contexts[0].sources.length, 3, 'silent sustained gates also leave room for the audible carry'); h.engine.dispose();
});

test('missing audio, malformed project, interrupted context and throwing consumers fail safely', async () => {
  const h = harness({ noAudio: true }); assert.equal(await h.engine.play(project()), false); assert.equal(h.engine.getState(), 'idle');
  assert.equal(await h.engine.play({ schema: 'wrong' }), false); assert.equal(h.timers.size, 0);
  assert.equal(await h.engine.audition(track('bad', { instrumentId: 'toString' }), note()), false);
  const q = harness(); await q.engine.play(project()); q.contexts[0].state = 'suspended'; q.advance(25); assert.equal(q.engine.getState(), 'paused'); assert.equal(q.timers.size, 0);
  const dangerous = q.window.ProStudioAudio.createEngine({ onPosition() { throw Error('consumer'); }, onState() { throw Error('consumer'); }, onMeter() { throw Error('consumer'); } });
  assert.equal(await dangerous.play(project()), true); dangerous.dispose(); q.engine.dispose();
});

test('normal project completion reaches its end and dispose is idempotent', async () => {
  const h = harness(); await h.engine.play(project({ bpm: 200, tracks: [] }), 383); h.advance(100);
  assert.equal(h.engine.getState(), 'idle'); assert.equal(h.engine.getPosition(), 384);
  h.engine.dispose(); h.engine.dispose(); assert.equal(h.contexts[0].closeCalls, 1);
  assert.equal(await h.engine.play(project()), false); assert.equal(h.timers.size, 0);
});
