# Studio Tamborin Implementation Plan

**Goal:** Add a playable BM Tamborin studio to the current standalone e-Instru Studio, with preserved Xylophone, songs, game and legacy exports.
**Architecture:** Keep the downloadable runtime inside index.html. Add clearly bounded inline percussion model/scheduler, Tamborin audio/view/controller and a small instrument navigation adapter; reuse existing design tokens and AudioContext activation. Do not translate percussion actions into pitched notes.
**Spec:** Ijamm's 4 November 2026 request in this session. Base origin/ui: 46338fe646408c758232eec9ba7b5f876ff1f9e4. At the initial base no recorder/selector existed. Integrated actual recorder/chooser update origin/ui115e54d87b10804ae6f94ff0efe895099d035e20 before delivery; pitched code/rules retained.
**Constraints:** Own worktree and instrument-tamborin branch only; no release bump, Pages, backend, external assets or runtime dependencies. Preserve legacy storage keys/JSON/CSV, 10-song catalogue, both variants and gameplay.

## Review focus
- Pending/resumed audio after Stop or navigation must not start stale sounds.
- Space on a focused button must cause one intended tap, never a second synthetic click.
- Example/metronome events must never enter manual recordings.
- Raw capture timestamps and existing takes must survive tempo, edits, Reset and navigation.
- Hidden/background/suspended pages must stop all percussion timers and voices.

## Task 1: Reusable percussion contract
- [x] Write tests against real inline source and observe missing-feature failures.
- [x] Implement action-based takes, safe import/export and bounded lookahead scheduler.
- [x] Verify zero first timestamp, evidence preservation, invalid data, stale scheduler and stop cleanup.

## Task 2: Playable studio and navigation
- [x] Add meaningful controller tests using existing DOM/audio boundaries, then observe failures.
- [x] Add large inline SVG, physical wood/skin/jingle appearance and two distinguishable synthesis voices.
- [x] Add pattern/tempo/metronome/record/play/stop/reset, event trace, editable takes and JSON/CSV exports with separate percussion schema/key.
- [x] Add minimal selector/navigation and suspend/resume bridges; recheck current ui before finishing and retain concurrent work.
- [x] Keep recording tempo locked (existing contract). Tempo changes during playback stop it with an explicit status; never retime raw evidence. Reset uses capture tempo and preserves edits.

## Task 3: Verification and handoff
- [x] Run node --test tests/*.test.cjs including all legacy regressions.
- [ ] Browser checks/screenshots: not established in this session. Both connected and cloud browsers could not access the isolated localhost preview; cloud local-file navigation is disallowed. No substitute screenshots or listening claims. Host interaction/lifecycle coverage is separate.
- [x] Fresh review, fix material findings with regression tests, final full suite.
- [x] Record SHA/source hashes, tests, limitations and Kompang API in docs/handoffs/instrument-tamborin/LATEST.md.
- [x] Commit and push instrument-tamborin only; verify remote head and clean worktree.
