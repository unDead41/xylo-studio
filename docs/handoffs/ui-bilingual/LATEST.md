# BM/BI handoff

Date: 4 November 2026, Malaysia. Branch: `ui`. Accepted VERSION remains `v1.04.0`; this is an Unreleased UI candidate.

## Source and scope

- Repository: `unDead41/xylo-studio`, digital application.
- Fresh isolated worktree based on `origin/ui` at `27df2fadadf66cee3f2be26aeafff765e33e515e`, retaining its complete eight-instrument UI work. Accepted main was `c0ba48bb9c35244354779cc227ecb7c999bff5dd`.
- Tested `index.html` SHA-256: `51afd08175344aed184d1cc8ac123cf6c5fd69c04e535dd99770596a504751ab`.
- Six parallel workers covered language infrastructure, pitched instruments, percussion, Game, tools/errors and independent verification. The coordinator integrated the corpora and source guards. No worker changed shared runtime files independently.
- Publish only `ui`. Main/Pages, other worker branches and manual share/tutorial snapshots are outside this delivery.

## Result

A native BM/BI selector is visible in the header on the initial chooser and every view. BM is the default; `e-instru-language` stores `ms` or `en`. Invalid/missing preferences fall back to BM. Storage denial still allows switching in memory, and storage events synchronize the language without echoing writes or creating recording conflicts.

The standalone inline corpus contains 1,026 exact phrase pairs and 89 anchored templates covering the chooser, eight instruments, Game, guides, dialogs, statuses, validation and accessible metadata. The owner changes existing text nodes and presentation attributes. It never calls a controller render, route, transport or save function. Dynamic application writes are translated through a bounded changed-subtree observer; numeric clock updates take a fast path. English-derived document titles reverse correctly when switching back to BM.

Input/textarea values remain literal. Titles, filenames and other opaque template captures are preserved. Known built-in arrangement prose and section labels translate for display; imported custom metadata is marked `data-i18n-ignore`. New default recording titles use the selected language only when created. JSON/CSV schemas, column names, instrument/action IDs, pitches, timestamps, raw evidence and existing recordings are unchanged. Malformed percussion JSON now receives a stable bilingual error instead of browser-specific parse text.

The header can wrap at narrow widths and uses existing design tokens and native focus semantics. All translation data remains inside the downloadable HTML. No runtime dependency, translation service, asset or network request is added.

## Verification

- Baseline `ui`: **207/207** Node tests passed.
- Final `node --test tests/*.test.cjs`: **221 passed, 0 failed, 0 skipped**. [Actual output](node-tests.txt).
- Fourteen new language tests execute the shipped inline translator: corpus reachability and placeholder integrity, persistence/invalid/denied storage, cross-tab synchronization, nested text/SVG/ARIA/title changes, dynamic writes, reverse toggles, all eight document titles, multiword/numeric captures, literal user values/JSON and custom metadata guards, node/listener/focus preservation and bounded observer settling.
- All **12** inline scripts compile. The nine existing core/game/audio/configuration/navigation script bodies are byte-identical to the base; only the pitched/percussion presentation owners gain new-title localization and data/error guards. [Source checks](source-checks.json).
- HTML has **571** unique IDs; native label and ARIA references resolve. No external script source was added. `git diff --check` passed.
- The existing 10 songs, both variants and all eight instrument identities remain in the unchanged core/configuration owners.

## Browser limit

Managed preview returned the expected URL, but the supported browser displayed other concurrent project sources, first another appearance-settings build and then GeoMath after a stop/restart. Neither matched this tested source. Browser QA is therefore **not verified** for this delivery; no screenshot, live recording/playback, visual overflow, physical phone, microphone or speaker result is attributed to it. The previously committed UI browser records remain historical evidence for their own source hashes. [Current browser record](browser-verification.json).

## Continuation

Refresh `origin/ui` before integration and preserve concurrent edits to the shared HTML. Run supported browser checks when preview routing points to this exact source: toggle BM/BI across eight studios, while recording/playing, in Game countdown/running/paused/results and with dialogs open; check 320px/390px and desktop layouts. Future visible phrases need an exact pair or an anchored template; keep user captures opaque and guard imported display metadata. Do not translate exported payloads or machine identifiers.
