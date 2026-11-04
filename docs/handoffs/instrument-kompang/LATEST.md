# Studio Kompang handoff

Date: 4 November 2026 (Malaysia). Implemented and verified on the exact runtime below. The latest user instruction authorizes delivery to the digital module's `main` in `unDead41/xylo-studio`; this repository has no `main-digitalized` branch.

## Source and head identity

| Ref | SHA |
| --- | --- |
| Completed/pushed Tamborin base | `7cf77b7e275b94717748cb80aed73f6680daa59e` |
| Current digital main integrated before implementation | `38eb0dc1136d2ce6756380633d4a09fe7a247113` |
| Inherited ui/recorder | `115e54d87b10804ae6f94ff0efe895099d035e20` |
| Own local combined baseline | `c7622dbed13d6506d08248c492f287e458413396` |
| Tested local implementation HEAD | `c08cca177e4967e0e004178978bceb0c3baa74ed` |
| GitHub integration implementation HEAD | `7fc30db184baced92053276694f796298e2caec7` |
| Byte-identical local/GitHub tested tree | `90aad66c6c49c62cf60fd9fcc694f77ea53073f1` |
| Tested index.html SHA-256 | `b124e0c5da35ec65b0284440811c915befe7d1361df63c0e29ca8ef3cff32236` |

Own linked worktree: `/workspace/scratch/a75daddb024a/instrument-kompang`. Initial working tree was clean. The actual Tamborin handoff/source were read; no reconstruction from memory. Main was merged into this worktree before implementation so its empty-workspace recovery and recorder audition fixes remain intact.

GitHub integration implementation has the main and Tamborin SHAs above as parents. The following documentation-only delivery wrapper adds this handoff/completion record without changing product/test/screenshot bytes. Resolve its exact delivery HEAD using `git rev-parse origin/main` or `origin/instrument-kompang` after fetch; its parent is the integration implementation HEAD above. GitHub blob hashes and the resulting entire tree were checked against the tested local tree before ref updates. Ref updates use an expected old main SHA and no force.

Accepted VERSION, visible version and metadata remain **v1.04.0**. No tag/release, backend, account, external runtime dependency or Pages configuration/manual deployment is added. ui, instrument-tamborin, share and tutorial refs are not written by this task. Historical audits and inherited handoffs retain their original scope.

## Result

- Four working chooser cards in a desktop 2×2 grid: Xylophone, Rekoder Soprano, Tamborin, Kompang. Every card retains instrument art/category and Buka studio; Tamborin/Kompang retain Cadangan baharu badges. All open/back routes and the Game roundtrip work.
- Large inline Kompang SVG: layered wooden shell, skin grain, stitched rim and disjoint center ellipse/edge annulus. No metal jingles. Both real membrane regions are pointer/touch targets and separate keyboard-focusable button roles. Local overlays distinguish center/edge, including reduced-motion feedback.
- Ketuk tengah/F and Ketuk tepi/J use the same shared input path as SVG regions. Focused region/action controls accept Enter/Space. Held/repeated keys, text fields, composition/modifiers and native transport Space behavior cannot produce duplicate/cross-instrument capture.
- `kompang-ui` is a thin configuration of the existing `PercussionStudio.createStudio`. The shared owner provides patterns, BPM40–200, metronome, Main contoh, Rakam/Henti/Reset, trace/audition, action/time editing, persistence and JSON/CSV. It is constructed once, activated on entry and deactivated on exit.
- Kompang is unpitched: `PercussionCore.INSTRUMENTS.kompang.actions` is `center`/`edge`; no fabricated MIDI, pitch chart or fingering UI. Its synthesis adapter uses lower membrane modes/longer decay for center and higher modes/high-pass noise/short decay for edge. Metronome remains a separate event. All sounds are explicitly described as digital synthesis.
- Kompang/Tamborin have separate takes, traces, storage keys and strict import identities. First manual input is raw_ms0; later fractional performance.now() intervals remain raw evidence independently of edited action/onset and tempo. Example, metronome, replay and trace audition never enter capture. Reset stops and restores capture BPM without deleting take/edits.
- Navigating away, stopping, blur, hidden tab, pagehide or audio suspension cancels voices/queued scheduling and stale AudioContext activation. Returning preserves every instrument's own recording. Pitched core/catalog and Game core were compared byte-for-byte to accepted main; all10 songs, variants, legacy recording migration and exports remain covered.

## Changed files

| Area | Files |
| --- | --- |
| Runtime: identity/audio, SVG/config, shared input/navigation and saved-identity guard | `index.html` |
| New core/audio, actual UI integration, markup and corrupt-storage regression tests | `tests/kompang-audio-core.test.cjs`, `tests/kompang-integration.test.cjs`, `tests/kompang-markup.test.cjs`, `tests/percussion-storage.test.cjs` |
| Fixture loads real Kompang adapter | `tests/helpers/studio.cjs` |
| Actual-browser verification and four-instrument-safe Tamborin harness | `tests/browser-kompang.cjs`, `tests/browser-tamborin.cjs` |
| Active docs/contracts/authorized branch exception | `AGENTS.md`, `README.md`, `DESIGN.md`, `UX-CONTRACT.md`, `docs/SOR.md`, `docs/BRANCH_POLICY.md`, `docs/BRANCHES.json` |
| Integration provenance; no version increment | `CHANGELOG.md`, `release.json`, `docs/superpowers/plans/2026-11-04-instrument-kompang.md` |
| Verification evidence | This directory: source hashes, Node output, browser reports, static checks and screenshots |

Relative to main, the completed Tamborin files are also integrated unchanged from their pushed source, including its original host tests/handoff. This is required ancestry/content, not a replacement implementation.

## Verification

- Initial Tamborin baseline:121/121. Combined accepted main + Tamborin baseline:126/126.
- New identity/audio, markup and14 actual-source integration tests were first observed failing, then passing after implementation. Final review reproduced a foreign saved-instrument identity crash; two additional storage regressions failed first, then passed with the shared hydration identity guard. Foreign stored evidence is retained unchanged.
- Final `node --test tests/*.test.cjs`: **154 passed,0 failed**. Full result: [node-tests.txt](node-tests.txt). Exact runtime/test hashes: [source-hashes.json](source-hashes.json).
- Chromium133.0.6943.0: **38 workflow groups passed**,0 page errors: Kompang13, recorder17, Tamborin8. All ran on the final runtime hash. See [browser-verification.json](browser-verification.json), [Kompang report](screenshots/browser-results.json), [recorder report](regression/recorder/browser-results.json), [Tamborin report](regression/tamborin/browser-results.json).
- Actual Chromium checks include mouse hit testing on both disjoint SVG regions, keyboard repeat/focus behavior, touch emulation, tempo/edit/reset/raw evidence, every Kompang pattern/metronome, trace/replay, downloaded JSON/CSV, four routes, Game return, storage reload/recovery and cancellation of sound/scheduling after navigation. Recorder verification also opens the standalone file offline without runtime assets.
- Real OfflineAudioContext renders show different center/edge spectral activity and decay: center retained post200ms energy; edge had none in that window. This establishes distinct generated signals, not acoustic fidelity.
- Desktop1440px, phone390px and narrow320px rendered without horizontal overflow. Reduced-motion checked. No duplicate IDs, unresolved label/ARIA references, nested buttons or external scripts; [static-checks.json](static-checks.json). `git diff --check` passed.
- The initial optional Tamborin harness needed its shared summary selector scoped to Tamborin and an audio wait tied to actual signal onset, because the edited first action occurs after its previous fixed sampling instant. Both harness corrections were verified in its successful actual run.

## Screenshots of actual code

| View | Desktop | Small screen |
| --- | --- | --- |
| Four-instrument chooser | [1440px](screenshots/chooser-desktop.png) | [390px](screenshots/chooser-phone.png) |
| Studio Kompang, empty | [1440px](screenshots/kompang-desktop.png) | [390px viewport](screenshots/kompang-phone.png), [full page](screenshots/kompang-phone-full.png) |
| Additional checks | [Recorded take](screenshots/kompang-desktop-recorded.png) | [320px](screenshots/kompang-320.png) |

These are browser-rendered screenshots of the tested source, not generated mockups. The connected browser could not reach the isolated localhost preview; the repository test harnesses ran successfully in local headless Chromium instead.

## Limits and integration continuation

No human speaker/headphone listening, physical touch-device timing, acoustic latency/fidelity, Safari/Firefox or screen-reader assessment is claimed. Host DOM/audio fixtures are software state/timing checks; Chromium signal/offline rendering adds real Web Audio verification but does not replace classroom speaker listening.

Fetch main and instrument-kompang, then verify the implementation SHA above is an ancestor of the delivered head. Run `node --test tests/*.test.cjs`; with test-only Playwright/Chromium available, run the three `tests/browser-*.cjs` harnesses named in release.json. `BROWSER_EXECUTABLE` selects the installed test Chromium and `BROWSER_OUTPUT` can redirect generated evidence. Production still opens as one standalone HTML. Share/tutorial snapshots remain manual, separate work.
