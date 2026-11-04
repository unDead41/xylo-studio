# Static review — Studio Pro continuation

The generic strict scanner exits 1 with **142 errors, 0 unresolved owners**: 136 `affordance.actionless-button` findings and six `form.textarea-resize-missing` findings. The previously recorded source at base 906d8fa has 140 errors (134 and six).

The two added button findings are the literal `proTryStarter` source snippet and its embedded copy. `studio-pro/shell.js` binds its real click action through `$('proTryStarter').addEventListener(...)`; actual-module tests and the browser empty-workspace workflow confirm it opens and focuses the example selector. Other findings retain the existing native-listener and global `textarea{resize:none}` classification. Dynamic arranger/project controls are verified through their actual source tests and browser actions.

No dummy handlers or scanner-specific product behavior were introduced. This report is retained as a limitation; the strict audit is **not** reported as passing. Historical baseline report: `../pro-verification/static-audit.json`.
