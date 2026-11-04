# Display themes and vision palettes

Date: 4 November 2026. Delivery branch: `ui-themes`. Accepted VERSION remains `v1.04.0`.

## Source boundary

- Repository: https://github.com/unDead41/xylo-studio
- Initial base: remote `ui`, `27df2fadadf66cee3f2be26aeafff765e33e515e`.
- Integrated current bilingual ui input: `71e7b09a9b10e26cbc39138c298fb1ad8ad8ca8c`; both its source and separate language storage are retained.
- Isolated worktree: `/workspace/scratch/101ad735a109/xylo-studio-themes`.
- Tested `index.html` SHA-256: `d21f71e94fde4e19e54486dfd5e7a94c7eb98c3dd6f3e886c771a5e45c17483f`.
- Main/Pages remains `c0ba48bb9c35244354779cc227ecb7c999bff5dd`; this task does not promote main, ui, share or tutorial.

Read AGENTS.md, SOR, branch policy, README, DESIGN, UX contract, VERSION, actual code and UI/layout handoffs before changes. The initial remote UI had only its accepted light palette. A concurrent Studio Pro checkout already contained in-flight `studio-pro/display.js`, `display.css` and `display.html`; those files were copied as the common display seed, preserving `StudioDisplay`, its IDs and `e-instru-display-v1`. The concurrent checkout was not edited, switched, committed or pushed by this task. Auth worker checkouts were audited read-only; this appearance branch is based on ui and does not claim integration of pending account work.

## Result

One shared **Paparan** control exposes Cerah, Gelap and Ikut peranti, with independent original/protanopia/deuteranopia/tritanopia/high-contrast palettes. The native modal previews notes/states, reports actual save availability, closes with Escape/Tutup/Selesai and restores focus. Valid settings restore before first body paint; system changes and other tabs update appearance without music writes. Invalid or unavailable storage falls back safely.

Dark styling covers chooser, shared studio surfaces, transport, controls, recorder/percussion pads, traces, tables, dialogs and the existing dark Game arena. Primary/danger fills have their own foreground colors. Vision modes pair palette changes with eight bar textures, clear note/key labels, solid/dashed percussion actions, current/pressed/recording outlines, Game lane-key text, judgment words and numeric life. Existing material SVG artwork retains its identity. OS forced colors and reduced motion retain visible boundaries.

Pitched repaint updates existing bar style variables and timeline rect fills. Grid/label/playhead colors use semantic CSS variables. Game caches its palette on display changes and directly redraws its existing canvas, without judging notes or adding per-frame computed-style reads. The distinct `studiodisplayopen` event deliberately pauses a running Game before its modal blocks lane input; closing never resumes automatically. Ordinary display-change events do not touch phase, held ownership, capture, audio scheduling, selection, cursor, scroll or music storage.

Editable sources are the three `studio-pro/display.*` files; `node scripts/embed-display.cjs` embeds them into the self-contained HTML. `--check` catches source drift. The app still requires no runtime network/module dependency.

## Six contributors

| Worker | Contribution |
| --- | --- |
| theme_audit | Existing-source/storage audit; independent renderer and held-input review |
| light_theme | Preserved accepted light palette and added shared semantic state/timeline/Game recipes |
| dark_theme | Dark surfaces, action foregrounds, hover/pressed/disabled behavior and control boundaries |
| colorblind_theme | Vision semantic roles, textures, labels and independent shape/state cues |
| theme_controls | Robust preference storage, system/media lifecycle and native modal accessibility |
| theme_validation | Actual-inline controller tests, state-preserving render regressions and full-suite evidence |

Workers owned separate source regions/files. Coordinator consolidated CSS into one canonical display.css, embedded sources, added in-place renderer hooks, checked the combined source through supported CUA and prepared this branch. Individual worker claims are not substituted for the combined verification below.

## Actual checks

- `node --test tests/*.test.cjs`: **262 passed, 0 failed, 0 skipped**. UI base had 207; 40 controller/render cases cover preference validation, blocked storage, metadata timing, source sync, modal focus/Escape, cross-tab/system behavior, held/pending recorder input, timeline identity/selection, Game overdue judgment isolation, held pointer/key deduplication and deliberate modal pause. [Full output](verification/node-tests.txt).
- `node scripts/embed-display.cjs --check`, JavaScript syntax compilation and `git diff --check` pass. All 13 inline scripts compile. 585 unique static markup IDs; no duplicate IDs or unresolved static label/ARIA references. [Script/hash evidence](verification/source-checks.json).
- Nine existing script owners are byte-identical to the bilingual ui input, including music/game cores, percussion model/audio/controller/adapters and navigation. Relative to the current bilingual ui input, only xylo-ui and xylo-game-ui add visual hooks, studio-i18n adds appearance phrases, and studio-display is new. Recording schemas, arrangements, pitches, scoring thresholds and synthesis are unchanged.
- Supported CUA cloud Chrome checks: desktop light/standard and dark/protanopia; actual eight note textures and matching melody-trace fills; 10 theme/vision combinations fitting a nominal 320px settings iframe; all eight routes without document overflow at nominal 320/390px in dark high contrast; deliberate native Game settings pause/close; readable tritanopia Game pad/key colors; native Escape; saved light/tritanopia settings restored after reload. [Exact observations and limits](verification/browser-checks.json).

Phone frames had client widths 310/380px because of scrollbars; these were not physical touch-device or screen-reader sessions. No microphone, acoustic/speaker, Safari/Firefox or hosted Pages deployment verification is claimed. Some workers ran intermediate standalone render experiments before coordination; the combined browser evidence above uses the supported CUA surface and is the authority for this handoff.

## Bilingual input compatibility

The remote ui branch advanced to the BM/BI candidate during delivery. The final theme branch integrates that commit as a second parent. Shared HTML/header/style conflicts were composed without replacing either owner; custom metadata guards remain. Twenty-eight appearance phrases extend the existing translator, and a new actual-inline regression checks display labels, all save statuses and Game-settings pause text BM to English to BM while preserving native select values, option/control identity and listeners. The combined total is 262 passing tests (including all 15 localization tests). Accepted version and publishing target stay unchanged.

Supported CUA checks also verified all ten appearance combinations in the English modal at nominal 320px, all eight English studio headings/widths at nominal 320/390px, and the translated deliberate Game pause message. Combined header heights were about 160/108px; the narrow anchor-focus offset is 180px so headings clear the wrapped controls. English low-life text has its own CSS content override.

## Concurrent Studio Pro integration

Keep one StudioDisplay owner, one header action and one displayDialog. Prefer these evolved canonical display sources/API/key when reconciling with the concurrent Studio Pro feature; preserve all of that feature's independent core/audio/arranger/mixer/projects/shell modules and navigation.

If the Pro builder already embeds display using its own markers, remove the three `studio-display:*` generated blocks from the integration candidate before regenerating the full Pro bundle, and retain the one Paparan header action. Do not run both builders into the same HTML or retain duplicate display script/dialog/style blocks. The renderer hooks here must be composed with Pro's unrelated bridge/navigation changes, then run the combined tests and Pro source-sync check. Theme files alone do not integrate Pro recording features or optional auth. Test the final combined source before any main promotion.
