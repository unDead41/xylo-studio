# ui handoff — e-Instru Studio / Rekoder Soprano

Date: 4 November 2026 (Malaysia). Status: implemented and software-verified; ui candidate only.

## Source identity

- Repository: https://github.com/unDead41/xylo-studio
- Work branch: ui; isolated worktree: /workspace/scratch/977575ac93c3/e-instru-ui.
- Base SHA / original origin/ui and origin/main: 46338fe646408c758232eec9ba7b5f876ff1f9e4.
- Implementation HEAD SHA: 41d0d211b40311a3cbdb69406eef299e7befca2c.
- Implementation tree SHA: 23301897e8998ee1cb615f50d2fa1101af35eab6.
- Tested index.html SHA-256: ce822a38ff6cad0254497e4107068e018b28ca70ac6c09d2fa308574cb451d84.
- This handoff and the completed plan are carried by the following documentation-only delivery commit. Resolve the delivery wrapper with git rev-parse origin/ui; its parent is the implementation SHA above. Product code/test/screenshot bytes are identical to the implementation commit.
- Working tree was clean at base. Fresh remote branch inspection and fetch showed architecture/audit/gameplay/main/music/tutorial/ui still at the base SHA before delivery; share remained dddd0765b8b11fa83967d3d4428ffb61297a4141. No other branch's index.html changes were waiting to integrate.
- VERSION remains v1.03.2 because branch policy increments only accepted releases. Changelog and release.json label this candidate Unreleased; no new tag was created.

## Implemented behavior

- Active branding is e-Instru Studio, preserving repository name, URL and compatibility API/schema/storage identifiers.
- Every load starts at Pilih instrumen anda. Both choices open a real instrument. Tukar instrumen safely stops transport and preserves independent takes, lastCustom and in-session undo history; reload retains takes/edits.
- Recorder uses a sculpted inline SVG with separate rear T and front 1–7 holes, paired holes 6/7, labelled open/closed/vented states, and raised playable pads. Desktop has eight pads in a row; phone has two rows of four. The shared Studio grid now constrains its main column so long timelines cannot widen the phone page.
- Basic labels C–C′ sound C5–C6, MIDI 72–84. Baroque data is transcribed from Yamaha's primary chart; physical soprano range is converted from AULOS's manufacturer register. See ../../RECORDER.md for source links and complete mapping.
- Recorder timbre uses fundamental plus second/third harmonics, held sustain and release envelope. All pointer/key/focus/visibility/view/audio-stop boundaries cancel held/pending voices. The existing scheduler handles recorder gate duration and live tempo retiming.
- The 10 songs, long/short versions, metronome, recording, editing, timeline and exports share the original owners. Original_midi/provenance remain intact; loading recorder catalog arrangements explicitly shows +12-semitone transposition. In-range extension pitches get extra pads. Long Are You Sleeping? retains below-range G4 and blocks recorder playback with an explanation; audition also explains the unsupported note.
- Recorder captures instrument_id, gate_tick, raw_duration_ms and release_ms additively. Raw onset/release evidence is not rewritten by editing, quantization or tempo. Legacy takes without instrument metadata read as xylophone. JSON/CSV carry the new fields.
- Xylophone synthesis and game rules/audio remain unchanged. The optional local microphone detector is explicitly xylophone-only and disabled for recorder.

## Changed files

| Area | Files |
| --- | --- |
| Runtime | index.html |
| Version/candidate status | CHANGELOG.md, release.json (VERSION unchanged) |
| Active branding/context | AGENTS.md, README.md, SETUP.md, DESIGN.md, UX-CONTRACT.md, docs/SOR.md, docs/BRANCH_POLICY.md, docs/BRANCHES.json |
| Instrument evidence | docs/RECORDER.md |
| Regression/browser checks | tests/recorder.test.cjs, tests/browser-recorder.cjs, tests/helpers/studio.cjs |
| Ownership/config/plan | premium-ui.json, docs/superpowers/plans/2026-11-04-recorder.md |
| Verification evidence | docs/handoffs/ui/node-tests.txt, static-audit.json, STATIC_REVIEW.md, screenshots/browser-results.json |
| Actual-code screenshots | screenshots/chooser-desktop.png, chooser-phone.png, recorder-desktop.png, recorder-phone.png, recorder-phone-full.png, xylophone-desktop.png |
| Delivery handoff | docs/handoffs/ui/LATEST.md |

## Actual validation

- Baseline: node --test tests/*.test.cjs — 64/64 passed before changes.
- New recorder tests first failed for missing registry, metadata, duration evidence, range handling and chooser; then passed. The overlapping-held-gate score-end regression also failed before its fix.
- Final: node --test tests/*.test.cjs — **74 passed, 0 failed**, including unchanged xylophone/catalog/game tests. Full host output: node-tests.txt.
- Real browser: node tests/browser-recorder.cjs with Playwright and Chromium 133.0.6943.0 — **15 workflow groups passed**, 0 page errors. Runs its own temporary localhost HTTP server and an offline file:// check. Browser prerequisites are test-only; production remains one HTML file.
- Browser coverage: chooser/branding/gesture-only startup; actual Web Audio RMS while holding >1.2s and silence after release; keyboard recording; pitch/gate editing; live tempo/metronome; JSON/CSV and downloaded CSV; switching/reload; Bb5 extension and G4 refusal; both catalog lengths; synchronized F fingering; pointer cancellation; window blur; game return; legacy v1 raw timing; touch hold/release in a 390px phone context; reduced motion; offline standalone file.
- Screenshots: desktop 1440×1000; phone viewport 390×844 plus full-page captures. They are rendered from the tested source, not image mockups.
- DESIGN.md lint: npx --yes -p @google/design.md designmd lint DESIGN.md — **0 errors, 0 warnings**.
- git diff --check — passed.
- Static premium audit: completed with **exit 1**, 36 actionless-button flags, 0 unresolved ownership findings. The scanner does not infer the existing inline addEventListener bindings; reviewed false positives and their runtime evidence are documented in STATIC_REVIEW.md. Do not describe this static audit as passing.

## Limits and continuation

Web Audio signal generation and release were measured in headless Chromium. Speaker listening quality, acoustic tuning, physical recorder behavior, real phone audio latency, Safari/Firefox and assistive-technology testing are not established by these checks. Touch checks use Chromium mobile emulation/CDP, not a physical phone. No microphone capture was used during tests; recorder microphone detection is not implemented. Current guide data covers the eight pads and catalog extensions, with other missing fingering rows explicitly labelled.

Audit can review the ui diff against the recorded base, rerun Node/browser checks and listen on actual desktop/phone speakers before accepting a release. Integrate/publish only when Ijamm requests it. No main merge/push, share/tutorial update or Pages publication is part of this delivery.
