# Static audit interpretation

`audit_project.py . --mode strict --output docs/handoffs/ui/static-audit.json` completed with exit 1: 36 `affordance.actionless-button` findings. There are no unresolved ownership findings after the native select and Canonical UI Map were documented.

The checker only recognizes literal HTML `onclick`, Vue event attributes and submit buttons. The standalone application binds existing and new controls with `$().addEventListener` inside inline scripts, and uses loops for close-dialog/export/game controls. The scanner does not resolve those bindings, so its actionless-button findings are static false positives. The app was not changed to insert inert click attributes or duplicate handlers to silence the scanner.

Runtime evidence: all 74 Node regressions run the actual inline source and 15 Chromium workflow groups exercise chooser, manual inputs, record/play/edit, exports, tempo, switching, legacy storage, game navigation, touch, offline and audio release. This is not a claim that a static audit passed or that every accessibility/real-device configuration was tested.

The initial audit also found undocumented native select ownership and textarea resize policy. Ownership is now explicit in premium-ui.json and UX-CONTRACT.md; export text uses resize:none with its existing substantial height/scroll area. DESIGN.md lint returned 0 errors and 0 warnings.
