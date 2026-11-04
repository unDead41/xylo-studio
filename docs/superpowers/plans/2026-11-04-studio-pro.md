# Studio Pro Implementation Plan

> For agentic workers: execute the six bounded module tasks concurrently; the coordinator integrates and verifies the combined source.

**Goal:** Add a usable multi-track studio without crowding the existing instrument workbenches.

**Architecture:** Pure project model and independent Web Audio transport, four focused UI modules, and a thin legacy-take/navigation adapter. Author modules separately and embed them deterministically in the self-contained HTML.

**Tech Stack:** Existing HTML/CSS/JavaScript, Web Audio, localStorage, Node test runner.

**Spec:** ../specs/2026-11-04-studio-pro.md

## Global constraints

Eight instruments and ten songs remain intact. PPQ24, 4/4, 40–200 BPM, 4–32 bars, eight tracks and 512 events per track. BM UI. JSON/CSV exports only. ui push only; VERSION v1.04.0 retained.

## Review focus

- Imports at duration/range limits reject invalid data without mutating original capture evidence.
- Stop/navigation cancels voices and pending AudioContext activation.
- Project save failure/conflict preserves recoverable current work.
- Continuous controls retain focus and undo remains useful.
- Narrow viewports keep only the timeline/grid internally scrollable.

## Tasks

- [x] Model worker: implement studio-pro/core.js and tests/pro-core.test.cjs; pure transformations, strict import, history.
- [x] Audio worker: implement studio-pro/audio.js and tests/pro-audio.test.cjs; synchronized schedule, loop, mixer, effects and cancellation.
- [x] Arranger worker: implement arranger.js/.css and focused tests; track overview, one-bar editor and precise event controls.
- [x] Mixer worker: implement mixer.js/.css and focused tests; live levels/pan/mute/solo/effects/master with stable controls.
- [x] Project worker: implement projects.js/.css and tests/pro-projects.test.cjs; bounded local store, conflicts, project files and management.
- [x] Shell worker: implement shell.js/.css/.html and focused tests; transport, tabs, history, lifecycle, autosave and shared app API.
- [x] Coordinator: implement deterministic embed helper, legacy read-only take bridge, chooser/header entry and safe navigation.
- [x] Coordinator: run node --test tests/*.test.cjs and embed consistency, browser-check creation/edit/playback/loop/mixer/project persistence/navigation at desktop and phone widths, then static design audit.
- [x] Coordinator: update README, DESIGN, UX contract, SOR, release metadata and UI handoff with actual hashes/evidence; commit and push ui only after checking the remote head.
