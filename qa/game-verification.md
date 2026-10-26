# Xylo Tiles V1.03.1 — verification

Date:26 October2026 (Asia/Kuala_Lumpur). Canonical Site base:af625e4af124bafda4645aac070f5bfc49a158cb. GitHub Pages base:1c409afc83bc53bedac8118d476dc3d6fdde084b, branch xylo/music in unDead41/xylo-studio. No change to unDead41/xylophone.

## Automated evidence

node --test tests/*.test.cjs: **62 passed,0 failed**. Actual inline core/UI are executed with a minimal DOM/audio/clock double; no production testing hook or autoplay bot is shipped.

- Existing44 tests preserved: pitch, score/long catalog, export gate, recording/raw data, timeline/table selection, tempo rebasing and stop/restart.
- Eight game-core tests cover all60 combinations (10songs ×2versions ×3tempos), exact MIDI/onsets/rest/duration, health/scoring boundaries, duplicate judgments, terminal states, whole long runs and invalid input.
- Ten game-UI tests cover choices, countdown, keyboard repeat/holds, pointer deduplication, actual shared audio pitch, long-run completion, best-score reload, hidden-tab pause, long paused hold/resume, suspended audio, pending-start/reset/mode races and preservation of a custom Studio take.

Game UI tests exposed an existing ensureAudio promise-assignment race when the initial context was already running. A suspended context then reused a stale resolved promise and never resumed. Reproduced red; fixed by clearing the shared promise after awaiting its assigned pending promise. Regression passes with all Studio checks.

Original xylo-core script SHA-256 remains d4cf07494ac4c86b55a0a43636016cf46c970d47cd929625599ff97691f00f9b. No score arrays or C++ export code changed. Prior actual Uno header compatibility checks remain applicable to that unchanged core. No new Uno build/upload or acoustic experiment is claimed.

## Browser evidence

Actual Chrome pass on the public GitHub Pages deployment of the initial game candidate (f7bc9a23f376d1c789b95c89e8cfa3b4622a1ccf):

- Version badge V1.03.0, ten song options, both variants and three tempo levels present. Initial desktop layout and canvas were inspected visually.
- Happy Birthday / Long / Easy displayed54BPM,56.7s,50tiles; Hard selected97BPM. Mary / Short / Easy displayed60BPM,16.0s,13tiles.
- An unattended live round expired exactly seven notes and ended at0/100life with7Miss,0hits; settings unlocked and result panel appeared.
- Live pause during countdown showed100/100life; it remained paused during the subsequent responsive inspection and development work.
- At390×844 viewport, document width380px and arena width352px: no document horizontal overflow. Actual mobile layout inspected; this is viewport testing, not a physical touchscreen acceptance test.
- This inspection led to the V1.03.1 arena-local pause/resume button, so mobile users need not scroll to the settings panel. Initial start scrolls the arena into view on narrow screens. Native progress fallback text now follows the actual progress value.
- No live perfect-timing or acoustic accuracy claim. Perfect/Good boundaries, exact pitches and life gains are verified in the clock/audio-double tests. One Chrome extension connection error appeared in console; no game exception was observed.

Shared preview was already serving another task, so it was not restarted or stopped. Final V1.03.1 live check and screenshots are recorded with the Pages release evidence.

## Limits and follow-up

**SOFTWARE VERIFIED** by the host checks above. **HARDWARE/ACOUSTIC VERIFIED: NO. VIDEO TRANSCRIPTION VERIFIED: NO.** Browser judgments use AudioContext time at input, not measured sound onset. Display/audio/input latency varies by device. Test on Ijamm's phone/touchscreen and speakers for timing comfort; physical microphone pitch and servo calibration remain independent.

Game difficulty presets are relative to each arrangement's base BPM. Manual Studio tempo is unchanged. Short score durations at their base tempo remain10–15s; gameplay duration changes with difficulty. Native game pads and keyboard are implemented; mobile layout/touch and screen-reader acceptance must be reported according to actual testing, never inferred from host doubles.
