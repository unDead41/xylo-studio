---
version: alpha
colors:
  primary: "#126B66"
  ink: "#172F41"
  background: "#EDF3F7"
  surface: "#FFFFFF"
  muted: "#526879"
  border: "#D7E2E9"
  focus: "#156CC4"
  soft: "#E6F2F0"
typography:
  display:
    fontFamily: "'Trebuchet MS', 'Avenir Next', sans-serif"
  body:
    fontFamily: "'Segoe UI', Arial, sans-serif"
  utility:
    fontFamily: "Consolas, ui-monospace, monospace"
rounded:
  control: "0.75rem"
  panel: "1.25rem"
omitted:
  - section: spacing
    reason: Existing component geometry remains owned by inline CSS; no new global spacing scale.
  - section: components
    reason: Component state recipes are inline CSS, documented below rather than duplicated as token values.
---
# Design context

## Overview

e-Instru Studio is a BM digital instrument and rhythm game for mouse, keyboard and touch. The reference is the existing raised, rainbow xylophone: a tangible classroom instrument at the center of a calm studio. Preserve the light layout, clear tempo controls, synchronized event table/timeline and separate Studio/Game navigation. The new first screen selects an instrument; it is a functional entry to the same studio.

The runtime stays in one downloadable index.html with no external fonts/assets/libraries. Inline core, game rules, Studio UI and game UI remain separately identifiable for tests. Keep raw input evidence distinct from edited score. Audio and microphone access follow a user gesture; optional microphone processing remains local and xylophone-only.

Source of requirements: Ijamm's digital Studio/game requests, the 4 November recorder/rebrand request and the approved branch workflow. Architecture decisions match docs/SOR.md. index.html is shared across worker roles; the reviewed ui implementation is promoted to main as v1.04.0 under Ijamm's explicit instruction.

## Colors

The existing `:root` in index.html is the canonical runtime token owner (Model B); the values above mirror it. Primary teal directs actions and active states; navy provides readable structure. Colorful xylophone bars remain untouched. Warm ivory and green recorder rings describe the instrument's material, not new global interface tokens.

## Typography

Use the existing display face for instrument names and note letters, body face for instructions, and monospace for MIDI/timing/keyboard labels. All fonts are local fallbacks. Do not introduce a remote font or change global typography for a single instrument.

## Layout

Chooser: two equal instrument cards on desktop, stacked on phones. Studio: retain the existing main instrument/inspector grid, with the playable instrument before the song catalog; the inspector flows below on narrow screens. Document scrolling owns the page. Jejak melodi and Data ketukan keep their own horizontal/internal scroll bounds.

## Elevation & Depth

The signature is the physical instrument: xylophone retains its raised bars, rail and soft shadows; recorder uses an ivory cylindrical SVG body, windway/labium, separated joints, flared bell, rear thumb callout and front holes. The pads have a raised edge and compress on press. Avoid a photographic backdrop or a flat unrelated button grid. Use no continuous decorative animation. Reduced motion removes translation/transition; pressed outlines/text remain available.

## Shapes

Retain existing rounded controls and panels. Instrument choices use 24px corners; recorder pad corners are 10px/7px on phone, sized within the existing stage. Double holes 6 and 7 remain paired in every state. Open, closed and vented states also have distinct symbols and labels.

## Components

| Document role | Runtime token / recipe | Consumers |
| --- | --- | --- |
| Action / selected state | --primary / --soft | Existing transport buttons, mode switch, pressed pads |
| Text / supporting text | --ink / --muted | Chooser, instrument heading, guides, inspector |
| Page / panel / border | --background / --surface / --border | Both instrument workspaces |
| Focus | --focus and existing :focus-visible | Existing controls and new native buttons |
| Type | --display / --sans / --mono | Shared shell, instrument pads, score/timing |
| Controls / panels | --radius / --panel plus established recipes | Transport, dialogs, panel shells |
| Instrument state | .bar / .recorder-pad / .hole-state | Percussive and sustained input variants |

## Do's and Don'ts

Keep the recorder visually recognizable and playable, with an accurate separate thumb hole and data-driven fingering. Put sounding MIDI/octave information beside simplified C–C′ labels. Never silently change score pitch to make it fit. Keep game rules and game audio xylophone-based. Reuse the controller/scheduler/export and existing dialogs/status owners for future instruments.

Reconcile drift: original docs described the xylophone-only entry; the approved multi-instrument entry extends that identity. Palette, fonts and xylophone physical design match the existing runtime; no global token was changed.
