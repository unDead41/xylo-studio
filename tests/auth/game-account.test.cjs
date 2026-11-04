const { test } = require('node:test');
const assert = require('node:assert/strict');
const { studio } = require('../helpers/studio.cjs');

const element = (app, id) => app.ids.get(id);
const click = (app, id) => element(app, id).fire('click');

// These are the actual bridges called by the account dialog's onOpen hook.
function openAccount(app) {
  app.window.XyloStudioBridge.pauseForAccount();
  app.window.XyloGameBridge.pauseForAccount();
}

async function hit(app, key) {
  await app.dispatch('keydown', { key, repeat: false });
  await app.dispatch('keyup', { key });
}

test('opening Account invalidates a game start awaiting audio activation', async () => {
  const app = studio({ game: true, variant: null, audioState: 'suspended', deferResume: true });
  await click(app, 'gameModeBtn');
  const pendingStart = click(app, 'gameStartBtn');
  await app.settle();
  assert.equal(element(app, 'gameStartBtn').disabled, true);

  openAccount(app);
  app.resumeAudio();
  await pendingStart;
  await app.settle();
  app.advance(60000);

  assert.equal(element(app, 'gameHealthValue').textContent, '100 / 100');
  assert.equal(element(app, 'gameScore').textContent, '0');
  assert.equal(element(app, 'gameResult').hidden, true);
  assert.equal(element(app, 'gameStartBtn').disabled, false);
  assert.equal(element(app, 'gameDifficulty').disabled, false);
  assert.equal(app.activeIntervals(), 0);
  assert.equal(app.oscillators.length, 0);

  // A later explicit start still works after dismissing Account.
  await click(app, 'gameStartBtn');
  app.advance(3025);
  await hit(app, 'D');
  assert.equal(element(app, 'gameScore').textContent, '100');
  assert.equal(element(app, 'gameHealthValue').textContent, '100 / 100');
});

test('opening Account invalidates a pending game resume and preserves the paused scored run', async () => {
  const app = studio({ game: true, variant: null, deferResume: true });
  await click(app, 'gameModeBtn');
  await click(app, 'gameStartBtn');
  app.advance(3025);
  await hit(app, 'D');
  assert.equal(element(app, 'gameScore').textContent, '100');
  await click(app, 'gamePauseBtn');
  const frozenTime = element(app, 'gameTime').textContent;
  const frozenScore = element(app, 'gameScore').textContent;

  app.contexts[0].state = 'suspended';
  const pendingResume = click(app, 'gamePauseBtn');
  await app.settle();
  assert.equal(element(app, 'gamePauseBtn').textContent, 'Sambung');

  openAccount(app);
  app.resumeAudio();
  await pendingResume;
  await app.settle();
  app.advance(60000);

  assert.equal(element(app, 'gamePauseBtn').textContent, 'Sambung');
  assert.equal(element(app, 'gameTime').textContent, frozenTime);
  assert.equal(element(app, 'gameScore').textContent, frozenScore);
  assert.equal(element(app, 'gameHealthValue').textContent, '100 / 100');
  assert.equal(element(app, 'gameResult').hidden, true);
  assert.equal(element(app, 'gameDifficulty').disabled, true);
  assert.equal(app.activeIntervals(), 0);

  // Dismissing Account does not restart the chart: an explicit resume reaches
  // the second note after its two-beat lead-in, keeping the first note's score.
  await click(app, 'gamePauseBtn');
  assert.equal(element(app, 'gamePauseBtn').textContent, 'Jeda');
  app.advance(2250);
  await hit(app, 'S');
  assert.equal(element(app, 'gameScore').textContent, '200');
  assert.equal(element(app, 'gameHealthValue').textContent, '100 / 100');
});
