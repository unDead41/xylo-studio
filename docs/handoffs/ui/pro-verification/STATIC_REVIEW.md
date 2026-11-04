# Static review

The generic strict audit was run against both base `27df2fa` and the candidate. Both exit 1, with zero unresolved owners. Base: 106 findings; candidate: 140.

Every finding is one of two known scanner limitations: `affordance.actionless-button` does not follow the project's `$().addEventListener(...)`/separate-module bindings; `form.textarea-resize-missing` does not associate the existing global `textarea{resize:none}` rule with six literal percussion import controls. The extra candidate action findings include source snippets as well as their embedded copies.

Actual runtime owners are recorded in UX-CONTRACT.md. Host tests execute maintained modules and original inline source; supported browser actions exercise Pro tabs/transport/editor/mixer/projects, legacy bridge/navigation and the display dialog. No fake inline click attributes or scanner-specific production behavior was added.

The strict report is retained as a limitation; it is not reported as passing.
