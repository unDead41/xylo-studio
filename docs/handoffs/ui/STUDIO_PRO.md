# Studio Pro and accessible display handoff

Date: 4 November 2026. Candidate branch: **ui**. Base: `27df2fadadf66cee3f2be26aeafff765e33e515e`. Accepted version stays **v1.04.0**.

## Delivered behavior

- Separate Studio Pro workspace with Susunan, Mixer and Projek tabs. Shared Play/Pause/Stop, tempo, metronome and undo/redo remain visible; length, loop and cursor controls are in a native disclosure.
- Up to eight instrument tracks, 4–32 bars, one-bar 16-step piano/percussion editor, exact event timing/duration/velocity, quantization, transpose and track duplication/removal.
- Synchronized audio scheduling, loop, live volume/pan/mute/solo, Reverb/Delay, master compressor/level and measured output meter. Unmuting or leaving Solo restores currently held recorder notes without duplicating other voices.
- Bounded local projects with autosave/restore, save/load/duplicate/delete, corruption/quota/conflict handling, project JSON round trip and complete-arrangement CSV.
- Copy-only take bridge from all eight existing studios. Raw capture evidence and source workspaces remain intact; ten songs and Game rules are retained.
- Global Paparan dialog: system/light/dark and independent protanopia/deuteranopia/tritanopia/high-contrast modes. Alternative palettes, bar patterns, numbered tracks, labels and explicit pressed/state outlines avoid color-only meaning. Preferences persist across reload.

## Six concurrent workers

| Worker | Owned module | Focused checks |
| --- | --- | --- |
| pro_model | core.js | 18 model/import/history tests |
| pro_audio | audio.js | 22 scheduling/mixer/cancellation tests |
| pro_arranger | arranger.js/css | 12 editor/focus/keyboard tests |
| pro_mixer | mixer.js/css | 7 stable-control/mixer tests |
| pro_projects | projects.js/css | 26 storage/project tests |
| pro_shell | shell.js/css/html | 9 transport/state/lifecycle tests |

Coordinator implemented the display module, legacy navigation/take bridges, deterministic embedding, integration tests and combined verification. Reused project and mixer workers independently reviewed integration and audio; findings were fixed before submission. No seventh worker was spawned.

## Verification

- `node --test tests/*.test.cjs`: **332 passed, 0 failed**, including the retained14 bilingual regressions and Pro/data-preservation checks.
- `node scripts/embed-studio-pro.cjs --check`: passes. All 19 actual inline scripts compile and literal document IDs are unique.
- `git diff --check`: passes.
- Supported cloud Chromium interaction: track creation/editing, synchronized playback/pause, actual keyboard loop-boundary editing, mixer effects/Bisu/Solo, project save/duplicate/restore, legacy take import, Pro/Studio/Game navigation and persistent display preferences.
- Responsive fixture embeds the self-contained source in frames of 320, 390, 850 and 1440px. All three Pro panels have zero page overflow in BM and English (24 panel/language/width checks). Their actual CSS client widths are 310, 380, 840 and 1430px because of the frame scrollbar.
- All four alternative color-vision modes apply with dark theme on the narrow frame. Native dialogs/selects and text labels remain operable. Dark + deuteranopia persists through a final direct-page reload.

Exact source/module hashes and commands: [source-checks.json](pro-verification/source-checks.json). Browser observations and limits: [browser-verification.json](pro-verification/browser-verification.json).

## Static scanner interpretation

The required generic strict scanner exits 1: baseline has 106 findings (100 actionless-button and six textarea-resize findings); candidate has 140 (134 and six). These two rules do not model the project's native addEventListener bindings or global textarea resize owner. The new literal shell/display snippets also bind actions from separate source modules before embedding. Actual-module and inline integration tests plus browser actions verify those controls; no dummy onclick handlers were added. This is **not** a claim that the strict static audit passes. Reports are retained beside the browser evidence.

## Verification limits

No physical speaker listening, acoustic latency, microphone or color-vision participant study was performed. Import/export bytes and storage failure/conflict cases have actual-module host coverage; browser downloads and genuine simultaneous multi-process storage races were not exercised. These are software-fixture/browser UI observations, not device measurements or accessibility certification.

## Integration and publication

`studio-pro/` is the maintained module source. Run `node scripts/embed-studio-pro.cjs` after changing it; CI rejects stale embedded code. The delivered index.html stays self-contained and offline with no external module/backend dependency.

Commit/push this candidate to **ui only**. Main, Pages, share, tutorial, auth branches and the Arduino repository are outside this task. The accepted main base remains `c0ba48bb9c35244354779cc227ecb7c999bff5dd`.

## Concurrent ui compatibility

Remote ui advanced to `71e7b09a9b10e26cbc39138c298fb1ad8ad8ca8c` while Pro was being implemented. The local Pro result was preserved as `3327473`, then merged with that commit. Both parent histories, the existing BM/English language owner, its native selector, its14 regressions and its recorded evidence remain present. Pro/display add399 exact phrases and48 templates, yielding1394 unique exact phrases and137 templates in the combined corpus.

The embed helper records which corpus entries it owns, so removing or changing extension entries does not leave obsolete templates behind or overwrite the original bilingual corpus. Raw custom titles and track names have explicit translation guards; dynamic templates preserve captured names and evidence. Header controls use a three-column narrow layout and a separate mode-navigation row.
