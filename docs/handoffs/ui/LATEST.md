# Overall UI/UX handoff — ui candidate

Date: 4 November 2026. Status: tested candidate for branch `ui`; accepted VERSION remains v1.04.0.

## Source and delivery boundary

- Repository: https://github.com/unDead41/xylo-studio
- Isolated coordinator worktree: `/workspace/scratch/c362abdc9e9e/e-instru-ui`.
- Eight-instrument main base: `c0ba48bb9c35244354779cc227ecb7c999bff5dd`.
- Previous remote ui head: `115e54d87b10804ae6f94ff0efe895099d035e20`, an ancestor of the main base.
- Tested index.html SHA-256: `46d1afe230d520223456231f86d2a1b9d8d04a04f96d8fbca5ba810bab3c5ebd`.
- Publish the tested tree as a commit descending from the main base and fast-forward `ui` with an expected-head check. No force push. The branch commit is resolved from `origin/ui` after delivery; local worker commits below are provenance, not individually published commits.
- This task writes `ui` only. Main/Pages and other worker branches are not delivery targets. The earlier direct-main exceptions applied to their historical tasks.
- AGENTS.md, docs/SOR.md, docs/BRANCH_POLICY.md, README.md, DESIGN.md, UX-CONTRACT.md, VERSION, actual source/tests and relevant recorder/percussion/layout handoffs were reviewed before implementation.

## Six-worker provenance

| Area | Local worker commit | Result |
| --- | --- | --- |
| Chooser | e4669a70d19426ccc83afb4e307bf1a160f276f7 | Compact physical cards, 2/2/4 family groups and native family navigation |
| Pitched studios | 871d657c9eddfccee3bec615b20889ec869e4595 | Recording/keyboard guidance, source-aware playback and empty states |
| Percussion studios | 1f654f364240ef4aa0ee9e26b69239e1adbb59f5 | Shared session badge, trace-source guidance and temporary practice isolation |
| Accessibility | f030cb683d29b184d2b949d446f6df48024878f5 | Native dialog context, field validation and editor focus recovery |
| Game | 7a53035a63af6967eb2b63ea2883d123c6cce3b6 | Setup/phase guidance, arena Start/Resume/Replay and local results |
| QA/regression | f59d670, 4ecd6a2 | Updated layout/chooser contracts, pitched flow and renamed-take accessible-name regressions |

Workers used separate detached worktrees and bounded source regions. The coordinator cherry-picked all patches, added shared reading/control geometry, fixed the renamed-take accessible name, added per-view document titles and local export-password reveal/reset, and resolved dialog width and mobile Game details. QA reviewed the combined runtime without further blocking findings.

## Result and protected behavior

Eight instrument cards retain their original IDs, order and artwork. Melodi & nada (2), Rentak & tradisi (2), and Perkusi sekolah & pancaragam (4) use real fragment navigation with visible focus. Shared headings, typography, wrapped action rows, sticky app navigation and desktop inspector improve the common workbench. Phone inspectors flow below their studio.

Pitched controls identify Main lagu/Main rakaman and update their accessible names after renaming. All six percussion studios expose waiting, recording, pending, example, replay and metronome states. New free play begins a temporary trace; saved actions/raw timing stay intact and replay restores their trace. Dialogs retain native modality/Escape with intentional focus, validation and focus recovery. The local export-password visibility toggle returns to masked on close/reopen.

Game shows the selected challenge and phase, short setup help and an optional rules disclosure. Start/resume/replay work in the arena overlay; results offer replay and change challenge. Scoring, lives, timing thresholds, song arrangements and audio rules are unchanged.

Seven modules are byte-identical to the main base: xylo-core, xylo-game-core, percussion-core, percussion-audio, tamborin-ui, kompang-ui and school-band-ui. The four changed UI adapters are xylo-ui, xylo-game-ui, percussion-ui and instrument-navigation. All eleven inline scripts compile. Ten songs and variants, eight saved workspaces, recording schemas, raw capture evidence, synthesis and physical instrument artwork are preserved. There is no new runtime dependency.

## Actual verification

- `node --test tests/*.test.cjs`: **207 passed, 0 failed, 0 skipped**. Baseline: 180. [Full output](verification/node-tests.txt).
- All eleven inline scripts compile; 568 unique static markup IDs; no broken label/ARIA/fragment references. Seven protected modules match their base hashes. [Source checks](verification/source-checks.json).
- `git diff --check` and `node --check tests/browser-layout.cjs` pass. Browser harnesses were not executed through an alternative browser-control system.
- Official DESIGN.md lint: 0 errors, 0 warnings, 3 informational notices. [Output](verification/design-lint.txt).
- Strict static audit exits **1**, not a pass: 100 actionless-button and 6 textarea resize findings, zero unresolved owners. Baseline: 97 + 6. The scanner cannot infer existing addEventListener/class bindings or the shared textarea resize rule; three new bound buttons were exercised in the browser. [Interpretation](verification/STATIC_REVIEW.md), [candidate](verification/static-audit.json), [baseline](verification/static-baseline.json).

Manual supported CUA Chromium checks used a managed preview and the tested source hash. All eight routes were checked in nominal 390px and 320px iframes (380/310px client widths due to scrollbars), with matching scroll widths and inspectors below the main area. Native family navigation focused its heading below the sticky header. Native editor validation/focus recovery, local export-password reveal/reset/trap, valid JSON export and return focus were exercised. Percussion keyboard recording, saved-take/practice isolation, replay and replacement-dialog cancellation were verified. At 320px, Game Start/Pause/Resume, preparation beats, automatic life-end, result controls, change-challenge focus and rules disclosure were exercised without horizontal overflow. Desktop export-dialog width was confirmed at 640px. [Exact browser observations and limits](verification/browser-verification.json).

## Limits and continuation

Narrow browser checks used iframes, not physical phones or device/touch emulation. No speaker listening, physical acoustic quality, microphone permission/capture, Safari/Firefox, screen-reader session or full 200% zoom matrix is claimed. One pointer locator operation timed out before activation; equivalent native keyboard recording/replay checks succeeded. The shared preview was briefly replaced by another project, then reclaimed and the title/source reverified. No screenshot artifact is attached to this candidate.

Verify the remote ui tree against the local prepared tree and keep main at the source base. The existing Pages URL remains the accepted main build until a separate integration instruction. Historical layout verification remains in `docs/handoffs/ui-layout`; the previous UI handoff is available in Git history at `e84a0ca767858582d3faf240c62376b6e2574419`. The accepted four school/band instruments remain documented in `docs/handoffs/instrument-pancaragam/LATEST.md`.
