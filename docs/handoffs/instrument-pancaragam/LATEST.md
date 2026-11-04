# School percussion / pancaragam handoff

Date: 4 November 2026, Malaysia. The follow-up request adds several school instruments, including band percussion. Four were implemented: Dram Sisi, Dram Bes, Simbal and Segi Tiga.

## Source

- Repository: `unDead41/xylo-studio` (digital browser application).
- Isolated worktree: `/workspace/scratch/c362abdc9e9e/e-instru-pancaragam`, branch `instrument-pancaragam`.
- Initial base main: `3a2bc106c8885b81334e1dd34ce5810f05dfad8e`.
- Concurrent shared-layout main integrated before final validation: `e84a0ca767858582d3faf240c62376b6e2574419`. Both accepted Tamborin/Kompang view markups are byte-identical to that main. All four new views were adapted to its canonical shell.
- Tested index.html SHA-256: `14b40fd23038ae64008755fee015e64740cb0c8945f551e4d5541503963cda7b`.
- Accepted version remains `v1.04.0`; visible/meta version and release metadata agree. No external runtime dependencies, samples or backend were introduced.
- This commit carries the runtime, tests and verification records together. Resolve its delivery SHA from `main` or `instrument-pancaragam`; the source hash identifies the tested runtime independently of commit metadata.

## Behavior

The chooser now has eight real instrument routes, retaining the original four cards and introducing a second two-column group for school percussion. Each new instrument has its own recognizable inline SVG materials, two focusable/pointer input regions, F/J action buttons and four 4/4 example patterns. Titles and recording inspectors use the existing Studio design and the shared percussion layout.

| Identity | Instrument | Actions |
| --- | --- | --- |
| `snare` | Dram Sisi | `hit`, `rim` |
| `bass_drum` | Dram Bes | `hit`, `soft` |
| `cymbals` | Simbal | `crash`, `soft` |
| `triangle` | Segi Tiga | `open`, `muted` |

The new `school-band-ui` adapters instantiate the existing `PercussionStudio.createStudio` once per instrument. They share recording, timing/editing, trace/audition, tempo, metronome, Reset, persistence and JSON/CSV export. Their actions are unpitched; they never enter the pitched registry. Each saved take uses its own `e-instru-percussion-v1:<identity>` key and importing another instrument's file is rejected.

Synthesis profiles differ in resonant modes, noise bands, gain and decay. Snare contrasts skin/noisy wire texture with a short rim; bass contrasts strong/soft low membrane modes; cymbals and triangle provide longer/shorter metallic decays. The muted triangle is a separate short strike. It does not damp previous open strikes. These are generated timbres rather than acoustic samples.

The shared factory's new `voiceTailMs` setting defaults to its previous 650ms. School percussion uses 1000ms so normal completion does not truncate the final metallic ring. Explicit Stop, navigation and lifecycle cancellation remain immediate. Raw manual input evidence stays separate from score edits and tempo changes.

## Verification

- Baseline: **154/154** Node tests passed before changes.
- The new school-band tests were first run on the baseline and **26 failed**, establishing absent registry/routes/audio behavior.
- Final: `node --test tests/*.test.cjs` — **180 passed, 0 failed**. Full output: [node-tests.txt](node-tests.txt).
- The new coverage exercises actual inline code for each instrument: capture/raw timing, editing/tempo, import/export, SVG and keyboard actions, examples without manufactured capture, independent storage/reload, Game return and cancellation of active or pending audio on navigation/blur/visibility/pagehide.
- Audio graph tests check distinct action envelopes, scheduled start times, invalid-action refusal and complete/idempotent node disconnection. They do not measure physical speakers.
- Real browser UI: all four new routes opened and captured two distinct actions. Pointer hit testing succeeded on snare skin, both cymbals and both triangle regions; action buttons captured strong/soft bass. Repeated UI routes restored two events in each take after reload. Triangle → Game → Studio returned correctly. A cymbal example added no manual events in the pre-layout check. After integrating the concurrent layout update, all four new studios were re-recorded through their final controls and their panel/inspector columns matched Xylophone exactly (886px / 314px at the 1363px viewport). Their Data ketukan tables were visible without disclosure.
- On the final combined runtime, Triangle tempo was changed from 80 to 200 BPM: second edited onset became 51.2ms while original input remained 128.0ms. Reset restored 80 BPM and retained both events. The actual browser may display fractional timestamps with binary floating-point detail.
- All four new studios were rendered inside real 390px and 320px browser iframes. Client/scroll widths were respectively 380/380 and 310/310 after the browser scrollbar; no horizontal page overflow was observed. Long action labels wrap. These are narrow browser documents, not phone-device emulation.
- `git diff --check` passed. IDs are unique and native label/ARIA references resolve. No external script URLs were added.
- Pitched core/UI, Game core/UI and the existing Tamborin/Kompang adapters were compared byte-for-byte to the base and are unchanged. Their block hashes are in [source-checks.json](source-checks.json).
- Browser observations and limits: [browser-verification.json](browser-verification.json). Browser extension metadata errors came from `chrome-extension://` URLs; they are not application errors.

## Changed files and integration

Runtime: `index.html`. Regression: `tests/school-band.test.cjs`, the actual-source script loader in `tests/helpers/studio.cjs`, and the bounded Kompang markup test/updated chooser text. The Kompang browser harness expects eight cards while retaining its original four-card geometry assertions. The new shared-layout browser harness includes all eight routes; both harnesses were syntax-checked, not rerun. Active README/design/UX/SOR/branch documentation, changelog and release.json describe the eight-instrument result. This directory contains the verification evidence. Existing historical handoffs retain their original scopes.

The concurrent ui/layout diff was fetched, merged and retained, and the new instrument panels were adapted to it. The final Node suite and browser control/geometry/narrow-layout checks were rerun on that combined source. Refresh main again before ref publication; if product code changes further, rerun the affected checks. Update main with an expected head and no force. Do not write other worker branches, share or tutorial. Pages remains configured from digital main/root.

The managed preview and narrow-screen wrapper are temporary QA files and are not part of the committed application. Production remains a single standalone `index.html`.

No physical phone timing, assistive-technology audit, acoustic fidelity, human speaker listening, microphone capture or Safari/Firefox verification is claimed. The original browser regression harnesses were not rerun through a separate browser-control system; the manual browser checks above used the supported cloud browser.
