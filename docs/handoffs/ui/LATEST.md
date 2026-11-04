# UI handoff — shared four-instrument studio layout

Date: 4 November 2026 (Malaysia). Status: implemented and verified for main under Ijamm's direct-main instruction. Accepted VERSION remains v1.04.0.

## Source identity and branch review

- Repository: https://github.com/unDead41/xylo-studio
- Isolated worktree: /workspace/scratch/977575ac93c3/e-instru-layout, created clean and detached from freshly fetched origin/main.
- Base SHA: 3a2bc106c8885b81334e1dd34ce5810f05dfad8e.
- Implementation HEAD SHA: 65df0f295dabb8155c623d49eb1d24178376042d.
- Implementation tree SHA: 8d6b123e572d8fe43dcf831596b4dab8a22a05e2.
- Tested index.html SHA-256: 9fa02ee7cbd6b5a73b9ae6c5bb1129da184c211631ec5fd749d49f5f5b67e6c3.
- This handoff is a documentation-only delivery wrapper whose parent is the implementation HEAD above. Resolve its final SHA with git rev-parse origin/main. Runtime, tests, verification report and screenshots are identical to the implementation commit.
- Remote main and instrument-kompang were at the base; instrument-tamborin was 7cf77b7e275b94717748cb80aed73f6680daa59e; ui was 115e54d87b10804ae6f94ff0efe895099d035e20. Existing independent worktrees were left intact. The latest main source already included both percussion studios and the accepted recorder fixes; these changes were read before editing shared index.html.
- AGENTS.md, docs/SOR.md, docs/BRANCH_POLICY.md, README.md, DESIGN.md, UX-CONTRACT.md, VERSION, release.json, relevant handoffs and actual source/tests were reviewed. No other worker branch, share/tutorial snapshot or Pages setting is written by this task. Main updates use a fast-forward with the expected base SHA; no force push.

## Result

Tamborin and Kompang now use the same studio heading, Tukar instrumen control, workspace grid, instrument panel, transport, status strip, settings row and inspector components as Xylophone/Recorder. Their raised action pads sit with the actual playable SVG in a pale inset stage. The original SVGs, disjoint Kompang hit regions and shortcuts are retained.

Rakam, Main rakaman and Henti are together below the playing surface. Tempo, metronome and Reset follow them. Main contoh belongs to the pattern panel. Jejak rentak and a visible Data ketukan table follow the patterns, without an extra disclosure step for editing. The inspector contains take name, counts/duration/BPM, capture guidance, stacked JSON/CSV exports and optional import. Technique and digital-synthesis guidance remain accessible in a native disclosure below the pads. On phones, the inspector follows the main area.

The ten inline runtime scripts and both physical instrument SVGs are byte-identical to the base. There are no changes to capture, raw timestamps, schemas, storage keys, audio, scheduler, catalog or game rules. The update retires the separate percussion layout CSS owners instead of duplicating the studio controller.

## Changed files

- index.html — both percussion view structures and surface styles; canonical classes own shared layout.
- tests/browser-layout.cjs — real-browser comparison of four studios and six viewport widths, plus keyboard/touch/guide/reduced-motion checks.
- tests/browser-kompang.cjs and tests/browser-tamborin.cjs — edit the now-visible data table directly.
- tests/kompang-markup.test.cjs — expect the concise Kompang instrument heading.
- DESIGN.md, UX-CONTRACT.md, docs/SOR.md and README.md — shared layout and interaction contract.
- CHANGELOG.md and release.json — accepted version unchanged; current source/test evidence.
- docs/handoffs/ui-layout/browser-verification.json — all actual browser results, geometry, source hashes, earlier attempt notes and limits.
- docs/handoffs/ui-layout/screenshots/{tamborin,kompang}-{desktop,phone}-full.png — four real screenshots.
- docs/handoffs/ui/LATEST.md — this handoff.

## Actual verification

- node --test tests/*.test.cjs: 154 passed, 0 failed, 0 skipped on final source.
- node tests/browser-layout.cjs: 8 groups passed. All four studios compared at 1440, 1050, 850, 540, 390 and 320px. Matching header type, main/inspector width and grid breakpoints; aligned desktop panels; stacked phone inspector; no horizontal page overflow. Percussion transport order, visible data table, native focus, Enter feedback, touch disclosure and reduced motion verified.
- node tests/browser-kompang.cjs: 13 groups passed. Actual center/edge pointer and emulated touch hit regions, F/J, native Space/Enter, held-key dedup, recording/editing/tempo/Reset, immutable raw evidence, playback/patterns/metronome, signal differences, JSON/CSV downloads, reload, independent workspaces, all four routes and Game roundtrip.
- node tests/browser-recorder.cjs: 17 groups passed. Hold/release, keyboard capture, gate/raw evidence, editing, tempo/metronome, exports, preserved workspaces, range handling, catalog variants, Baroque guide, cancel/blur, Game, old takes, empty/malformed envelope recovery, sustained audition cancellation, phone input, reduced motion and offline HTML.
- node tests/browser-tamborin.cjs: 8 groups passed. Both textures, mouse/keyboard/touch input, capture, raw evidence, editing/tempo/Reset, replay/example/Stop, exports and navigation.
- Total: 46 browser groups passed, no uncaught page errors. Playwright test harnesses served the final HTML locally and used Chromium 133.0.6943.0. Functional suites ran serially. Test-only environment used BROWSER_EXECUTABLE=/workspace/scratch/977575ac93c3/browser-runtime/chromium, LD_LIBRARY_PATH and TMPDIR pointing to that runtime; BROWSER_OUTPUT pointed to independent layout-browser evidence folders.
- All uploaded blobs and the implementation tree were checked against local Git hashes. git diff --check passed.

An earlier concurrent browser attempt on the pre-final title/whitespace revision hit a Kompang screenshot timeout and a Recorder phone-release RMS assertion. The final serial runs passed all functional checks. The new layout harness corrected whitespace normalization and used keyboard navigation to establish :focus-visible modality; these were test assertions, not product changes.

[Detailed verification](../ui-layout/browser-verification.json)

| Studio | Desktop 1440px | Phone 390px |
| --- | --- | --- |
| Tamborin | [Screenshot](../ui-layout/screenshots/tamborin-desktop-full.png) | [Screenshot](../ui-layout/screenshots/tamborin-phone-full.png) |
| Kompang | [Screenshot](../ui-layout/screenshots/kompang-desktop-full.png) | [Screenshot](../ui-layout/screenshots/kompang-phone-full.png) |

## Verification limits and continuation

Audio verification measures headless Web Audio/OfflineAudioContext signals. It does not establish speaker listening quality, acoustic fidelity, physical phone latency, Safari/Firefox behavior or screen-reader usability. No new acoustic or microphone support is claimed.

After the delivery fast-forward, verify the final main ref and CI result, then compare the served index.html SHA-256 with the tested hash above when the existing deployment completes. No additional Pages setting or manual publishing command is needed. Future instrument views should reuse these canonical layout classes while supplying their own physical stage and controller adapter. Re-run the browser layout suite when changing shared geometry and the relevant functional suite when changing an instrument's controls.
