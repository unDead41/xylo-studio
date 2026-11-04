# Studio Kompang implementation plan

**Goal:** Add a playable unpitched Kompang to the existing four-instrument chooser, retain every previous workspace, and integrate into the digital repository's `main` as requested.

**Architecture:** Reuse the real Tamborin PercussionCore, PercussionStudio factory, scheduler, raw capture and export owners. Add only Kompang identity/actions, synthesis, two SVG input regions and thin configuration. Generalize the shared surface binding and navigation across both percussion views.

**Sources:** User's detailed Kompang specification; `docs/handoffs/instrument-tamborin/LATEST.md`; current `origin/main` recorder fixes.

**Constraints:** One self-contained HTML; no external runtime, backend, MIDI substitutes or fabricated results. Preserve all 10 songs, recorder, Xylophone, Tamborin, Game and JSON/CSV. Keep accepted VERSION v1.04.0. The latest user instruction authorizes integration/push to `main`; this repository has no `main-digitalized` branch. No explicit Pages setting/deployment changes.

- [x] Verify remote/worktrees and real Tamborin base `7cf77b7e275b94717748cb80aed73f6680daa59e`; baseline 121/121.
- [x] Merge accepted main `38eb0dc1136d2ce6756380633d4a09fe7a247113` into own branch, preserve v1.04.0 and recorder fixes; combined baseline 126/126.
- [x] Add failing tests for identity, sound distinction, SVG regions, capture evidence and cross-instrument lifecycle.
- [x] Add Kompang identity/audio and thin visual/configuration adapters; extend shared input surfaces and navigation.
- [x] Run all host tests and actual browser regression harness; capture four-card selector and Kompang desktop/phone.
- [x] Review complete combined source, fix material findings, record source hashes/base/head/tests/screenshots/audio limits in handoff.
- [x] Commit worker result and prepare the byte-verified GitHub integration tree; recheck main and use an expected-head, non-force ref update for delivery.

Review focus: hidden pitched F/J input; focused Space activating the wrong region; delayed AudioContext resume after switching; independent take imports/storage; new main changes during implementation. Raw performance timestamps must survive score edits/tempo/Reset; example/metronome must never enter manual recording.

Progress: delegated disjoint audio/core, visual/config and regression tasks to three agents; parent owns shared input/navigation, combined verification and publication.

Final review: one Important foreign-storage identity finding fixed after two observed failures; 154/154 host regressions and 38 Chromium workflow groups passed on final runtime hash b124e0c5da35ec65b0284440811c915befe7d1361df63c0e29ca8ef3cff32236. Source/audio/UI review has no remaining material blocker. No deferred minor findings. GitHub implementation object: 7fc30db184baced92053276694f796298e2caec7; documentation-only delivery wrapper follows.
