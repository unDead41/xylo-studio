# Design context

Xylo Studio is a BM digital instrument/recorder and rhythm game for mouse, keyboard and touch. Preserve the existing calm light layout, typography, clear tempo controls, synchronized event table/timeline and separate Studio/Game navigation.

The runtime stays in one downloadable index.html with no external fonts/assets/libraries. Inline core, game rules, Studio UI and game UI remain separately identifiable for tests. Keep raw input evidence distinct from edited score. Audio and microphone access follow a user gesture; optional microphone processing is local.

Source of requirements: Ijamm's digital Studio/game requests and the approved branch workflow. Architecture decisions must match docs/SOR.md; audit coordinates edits to the shared HTML file.
