'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { studio } = require('./helpers/studio.cjs');

const KEY = 'xylo-studio-v2';
const PALETTE = ['#FFFFFF', '#E6E6E6', '#CDCDCD', '#FFFFFF', '#E6E6E6', '#CDCDCD', '#FFFFFF', '#E6E6E6'];
const element = (app, id) => app.ids.get(id);
const click = (app, id) => element(app, id).fire('click');
const events = app => element(app, 'timeline').children.filter(node => node.className.split(' ').includes('event'));
const storageSnapshot = app => [...app.saved.entries()];
const voiceSnapshot = app => app.oscillators.map(voice => [voice, voice.started, voice.stopped, voice.stopCalled]);
function displayOwner(app, vision = 'contrast') {
  app.window.StudioDisplay = { get: () => ({ theme: 'dark', vision }), palette: () => PALETTE.slice() };
}
const gameState = app => Object.fromEntries(['gameScore', 'gameCombo', 'gameHealthValue', 'gameTime',
  'gameJudgment', 'gamePhase', 'gamePauseBtn', 'gameStartLabel', 'gameBest'].map(id => [id, element(app, id).textContent]));

// These exercise the shipped render listeners and real controllers against the
// existing DOM/audio boundary. They do not measure browser paint or sound.
test('theme repaint updates existing timeline fills and bars without changing selection, score or audio', async () => {
  const app = studio({ variant: 'short' });
  const first = events(app)[0]; await first.fire('click'); await app.settle();
  assert.equal(first.getAttribute('aria-current'), 'true');
  const bars = element(app, 'instrument').querySelectorAll('.bar');
  const fills = bars.map(() => new Map());
  bars.forEach((bar, index) => { bar.style.setProperty = (name, value) => fills[index].set(name, value); });
  const beforeEvents = events(app), rows = element(app, 'eventRows').children.slice();
  const beforeStorage = storageSnapshot(app), beforeVoices = voiceSnapshot(app);
  const take = JSON.parse(app.saved.get(KEY)).take;
  displayOwner(app); await app.windowEvent('studiodisplaychange');
  assert.deepEqual(events(app), beforeEvents); assert.deepEqual(element(app, 'eventRows').children, rows);
  assert.deepEqual(element(app, 'instrument').querySelectorAll('.bar'), bars);
  assert.equal(first.getAttribute('aria-current'), 'true');
  assert.equal(rows[0].getAttribute('aria-current'), 'true');
  assert.deepEqual(storageSnapshot(app), beforeStorage); assert.deepEqual(voiceSnapshot(app), beforeVoices);
  const notes = app.C.notes(take.octave);
  take.events.forEach((event, index) => {
    const note = notes.findIndex(item => item.midi === event.midi);
    if (note >= 0 && !event.estimated) assert.equal(beforeEvents[index].getAttribute('fill'), PALETTE[note]);
  });
  bars.forEach((bar, index) => {
    assert.equal(fills[index].get('--bar'), PALETTE[index]);
    assert.equal(fills[index].get('--bar-edge'), '#405464');
  });
});

test('a display change during a held recorder capture preserves pad identity and full release evidence', async () => {
  const app = studio({ chooser: true, variant: null });
  await click(app, 'chooseRecorder'); await click(app, 'recordBtn');
  await app.dispatch('keydown', { key: 'a' }); await app.settle();
  const pads = element(app, 'recorderPads').children.slice(), held = pads[0];
  assert.equal(held.getAttribute('aria-pressed'), 'true'); assert.equal(app.oscillators.length, 3);
  const before = app.saved.get(KEY), voices = voiceSnapshot(app), timers = app.activeIntervals();
  app.setNow(1250); displayOwner(app, 'deuteranopia'); await app.windowEvent('studiodisplaychange');
  assert.deepEqual(element(app, 'recorderPads').children, pads);
  assert.equal(held.getAttribute('aria-pressed'), 'true');
  assert.equal(app.saved.get(KEY), before); assert.deepEqual(voiceSnapshot(app), voices);
  assert.equal(app.activeIntervals(), timers); assert.equal(element(app, 'recordLabel').textContent, 'Henti');
  app.setNow(1750); await app.dispatch('keyup', { key: 'a' }); await click(app, 'stopBtn');
  const take = JSON.parse(app.saved.get(KEY)).take;
  assert.equal(take.events.length, 1); assert.equal(take.events[0].midi, 72);
  assert.equal(take.raw_capture.length, 1); assert.equal(take.raw_capture[0].raw_ms, 0);
  assert.equal(take.raw_capture[0].raw_duration_ms, 750); assert.equal(take.raw_capture[0].release_ms, 750);
  assert.equal(held.getAttribute('aria-pressed'), 'false');
  assert.ok(app.oscillators.every(voice => voice.stopCalled));
});

test('display repaint cannot invalidate a recorder input awaiting audio permission', async () => {
  const app = studio({ chooser: true, variant: null, audioState: 'suspended', deferResume: true });
  await click(app, 'chooseRecorder'); const recording = click(app, 'recordBtn'); await app.settle();
  await app.dispatch('keydown', { key: 'a' });
  const held = element(app, 'recorderPads').children[0], before = app.saved.get(KEY);
  assert.equal(app.oscillators.length, 0); assert.equal(held.getAttribute('aria-pressed'), 'true');
  displayOwner(app, 'tritanopia'); await app.windowEvent('studiodisplaychange');
  assert.equal(element(app, 'recorderPads').children[0], held); assert.equal(app.saved.get(KEY), before);
  app.resumeAudio(); await recording; await app.settle();
  assert.equal(app.oscillators.length, 3); assert.equal(held.getAttribute('aria-pressed'), 'true');
  app.setNow(1500); await app.dispatch('keyup', { key: 'a' }); await click(app, 'stopBtn');
  const take = JSON.parse(app.saved.get(KEY)).take;
  assert.equal(take.raw_capture.length, 1); assert.equal(take.raw_capture[0].raw_duration_ms, 500);
});

test('Game repaint leaves overdue judgments, held keys, score, storage and audio untouched', async () => {
  const app = studio({ game: true, variant: null });
  await click(app, 'gameModeBtn'); await click(app, 'gameStartBtn'); app.advance(3025);
  await app.dispatch('keydown', { key: 'd' }); assert.equal(element(app, 'gameScore').textContent, '100');
  const pads = element(app, 'gamePads').children.slice(), colors = pads.map(() => new Map());
  pads.forEach((pad, index) => { pad.style.setProperty = (name, value) => colors[index].set(name, value); });
  assert.match(pads[2].className, /is-pressed/);
  const state = gameState(app), beforeStorage = storageSnapshot(app), voices = voiceSnapshot(app);
  const timers = app.activeIntervals();
  // Moving only the audio clock makes a step() call observable: another tile
  // is now overdue, but a display repaint must not judge it or update the HUD.
  app.contexts[0].currentTime += 1.1;
  displayOwner(app); await app.windowEvent('studiodisplaychange');
  assert.deepEqual(gameState(app), state); assert.deepEqual(storageSnapshot(app), beforeStorage);
  assert.deepEqual(voiceSnapshot(app), voices); assert.equal(app.activeIntervals(), timers);
  assert.deepEqual(element(app, 'gamePads').children, pads); assert.match(pads[2].className, /is-pressed/);
  colors.forEach((style, index) => assert.equal(style.get('--game-pad-fill'), PALETTE[index]));
  // A held key stays deduplicated after repaint; clearing held input here would
  // turn this repeat into a wrong hit and alter life/judgment.
  await app.dispatch('keydown', { key: 'd', repeat: false });
  assert.deepEqual(gameState(app), state); assert.deepEqual(voiceSnapshot(app), voices);
  await app.dispatch('keyup', { key: 'd' }); app.advance(25);
  assert.notEqual(element(app, 'gameHealthValue').textContent, state.gameHealthValue);
});

test('Game pointer ownership survives a display change without awarding a second hit', async () => {
  const app = studio({ game: true, variant: null });
  await click(app, 'gameModeBtn'); await click(app, 'gameStartBtn'); app.advance(3025);
  const pad = element(app, 'gamePads').children[2]; await pad.fire('pointerdown', { pointerId: 41 });
  const state = gameState(app), voices = voiceSnapshot(app);
  displayOwner(app, 'protanopia'); await app.windowEvent('studiodisplaychange');
  await pad.fire('pointerdown', { pointerId: 41 });
  assert.deepEqual(gameState(app), state); assert.deepEqual(voiceSnapshot(app), voices);
  assert.match(pad.className, /is-pressed/); await app.dispatch('pointerup', { pointerId: 41 });
  assert.doesNotMatch(pad.className, /is-pressed/);
});

test('opening display settings deliberately pauses Game and only explicit resume restarts its clock', async () => {
  const app = studio({ game: true, variant: null });
  await click(app, 'gameModeBtn'); await click(app, 'gameStartBtn'); app.advance(3025);
  await app.dispatch('keydown', { key: 'd' }); await app.dispatch('keyup', { key: 'd' });
  const score = element(app, 'gameScore').textContent, time = element(app, 'gameTime').textContent;
  const beforeStorage = storageSnapshot(app);
  await app.windowEvent('studiodisplayopen');
  assert.equal(element(app, 'gamePauseBtn').textContent, 'Sambung'); assert.equal(app.activeIntervals(), 0);
  assert.equal(element(app, 'gameView').dataset.phase, 'paused');
  assert.match(element(app, 'gameStatus').textContent, /tetapan paparan/);
  app.advance(60000); displayOwner(app); await app.windowEvent('studiodisplaychange');
  assert.equal(element(app, 'gameTime').textContent, time); assert.equal(element(app, 'gameScore').textContent, score);
  assert.equal(element(app, 'gameHealthValue').textContent, '100 / 100');
  assert.deepEqual(storageSnapshot(app), beforeStorage); assert.equal(app.activeIntervals(), 0);
  await click(app, 'gamePauseBtn'); app.advance(2200);
  await app.dispatch('keydown', { key: 's' }); await app.dispatch('keyup', { key: 's' });
  assert.equal(element(app, 'gameScore').textContent, '200');
  assert.equal(element(app, 'gameHealthValue').textContent, '100 / 100');
});
