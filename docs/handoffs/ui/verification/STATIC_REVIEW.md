# Static audit interpretation

The strict scanner exited 1, not a pass. It reports 106 literal-source findings, with zero unresolved canonical owners.

| Rule | Baseline | Candidate | Runtime interpretation |
| --- | --- | --- | --- |
| actionless-button | 97 | 100 | Scanner does not infer inline addEventListener bindings or class-based close handlers. |
| textarea-resize-missing | 6 | 6 | All product textareas inherit the canonical global textarea resize:none rule; the scanner requires a literal attribute/class. |

The three additional buttons are gameOverlayActionBtn, gameChangeBtn and exportPasswordToggle. Each has a real handler in its owning inline UI module; manual browser checks exercised all three. Existing transport, navigation, dialog, editor and export handlers remain covered by actual-source host regressions. No fake inline action attributes were introduced to silence the scanner.

The tool only accepts directories in sourceRoots. The old index.html entry fell back to the project root and included a temporary preview copy; final audit was rerun after removing preview files. premium-ui.json now declares the project root explicitly. Native select ownership and global scrollbar/form/feedback owners remain documented in UX-CONTRACT.md. Static inspection does not establish browser focus, sound quality or physical-device behavior.
