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
  surfaceSubtle: "#F7FAFC"
  dangerSoft: "#FFF1F2"
  scrollbarHover: "#728B9C"
typography:
  display:
    fontFamily: "'Trebuchet MS', 'Avenir Next', sans-serif"
  body:
    fontFamily: "'Segoe UI', Arial, sans-serif"
    fontSize: "15px"
    lineHeight: "1.6"
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

Use the existing display face for instrument names and note letters, body face for instructions, and monospace for MIDI/timing/keyboard labels. All fonts are local fallbacks. The shared workbench body is 15px (14px on phones); controls are 14px/13px, supporting instructions 12–13px, and compact utility labels 10–11px. Studio headings share a 36px desktop scale and 29px phone scale, reducing to 27px below 360px. Do not introduce a remote font or change global typography for a single instrument.

## Layout

Chooser: eight compact instrument cards in two columns on desktop, stacked on phones. Native family links lead to Melodi & nada (2), Rentak & tradisi (2), or Perkusi sekolah & pancaragam (4), preserving original instrument order and artwork. Each card pairs the object with its purpose, exact shortcut hint and Buka studio action. All eight studios use the same `.studio-heading`, `.workspace`, `.main-work`, `.instrument-panel` and `.inspector` geometry. The main area contains the playable instrument, Rakam/Main/Henti transport, persistent status, tempo/metronome/Reset row, song catalog or percussion patterns, trace, then a visible Data ketukan table. JSON/CSV exports live in the inspector. The 314px inspector narrows to 282px at 1050px and stacks below the main area at 850px. Document scrolling owns the page; traces and event tables retain their own scroll bounds. A sticky application header keeps Studio/Permainan accessible; focus and native family targets receive a header-safe scroll offset. The inspector sticks only on desktop and flows normally on narrow screens.

## Elevation & Depth

The signature is the physical instrument: xylophone retains its raised bars, rail and soft shadows; recorder uses an ivory cylindrical SVG body, windway/labium, separated joints, flared bell, rear thumb callout and front holes. The pads have a raised edge and compress on press. Avoid a photographic backdrop or a flat unrelated button grid. Use no continuous decorative animation. Reduced motion removes translation/transition; pressed outlines/text remain available.

## Shapes

Retain existing rounded controls and panels. Instrument choices use 24px corners; recorder pad corners are 10px/7px on phone, sized within the existing stage. Double holes 6 and 7 remain paired in every state. Open, closed and vented states also have distinct symbols and labels.

## Components

| Document role | Runtime token / recipe | Consumers |
| --- | --- | --- |
| Action / selected state | --primary / --soft | Existing transport buttons, mode switch, pressed pads |
| Text / supporting text | --ink / --muted | Chooser, instrument heading, guides, inspector |
| Page / panel / border | --background / --surface / --border | All four instrument workspaces |
| Focus | --focus and existing :focus-visible | Existing controls and new native buttons |
| Type | --display / --sans / --mono | Shared shell, instrument pads, score/timing |
| Controls / panels | --radius / --panel plus established recipes | Transport, dialogs, panel shells |
| Instrument state | .bar / .recorder-pad / .hole-state / .studio-action-pad | Pitched and unpitched playing surfaces |

## Do's and Don'ts

Keep the recorder visually recognizable and playable, with an accurate separate thumb hole and data-driven fingering. Put sounding MIDI/octave information beside simplified C–C′ labels. Never silently change score pitch to make it fit. Keep game rules and game audio xylophone-based. Reuse the controller/scheduler/export and existing dialogs/status owners for future instruments.

Reconcile drift: original docs described the xylophone-only entry; the multi-instrument entry extends that identity. The overall UI pass retains the established palette, fonts and physical instruments while improving the shared reading scale, grouping and control geometry. Runtime `:root` in index.html remains the token owner; `ui-polish-style` adds shared state/scrollbar tokens and component recipes, and `ui-chooser-style` owns only compact family/card geometry. The frontmatter mirrors the runtime values. New recording states reuse danger/primary/warning semantic roles. The original overall UI pass introduced no external font or decorative background; the subsequent Studio Pro display preference extension below adds the maintained dark theme.

## Tamborin extension

The Tamborin view uses the canonical studio shell and inspector, including the same header size and Tukar instrumen control as Xylophone/Recorder. Its inline SVG shows a wooden shell, pale membrane and eight clearly paired metal jingles. Ketuk/Goncang pads use raised pale mint surfaces, soft shadows and pressed feedback. The physical object and pads sit in an inset playing area matching the recorder stage. A compact disclosure holds technique and digital-synthesis guidance; it does not displace the main controls. Percussion patterns replace the pitched song catalog, while capture and independent unpitched storage remain unchanged.

## Kompang extension

Reuse the same canonical shell as the other three studios, with the percussion pattern/trace variant used by Tamborin. A wooden inline SVG shell, pale textured membrane and stitched rim provide depth without metal jingles. The center ellipse and edge annulus are disjoint focusable hit shapes, with subtle tone/line labels and localized teal/lilac feedback. F/J action buttons remain large; reduced motion retains outlines and text while removing movement. All four chooser cards use the existing card geometry and Buka studio action, with Cadangan baharu badges on the two unpitched instruments. Geometry and flow are compared across all four views at 1440, 1050, 850, 540, 390 and 320px in `tests/browser-layout.cjs`.

## School percussion extension

Dram Sisi uses a teal cylindrical shell, steel rim, tension rods and two drumsticks. Dram Bes has a broad upright skin, deep shell, steel rods and a padded mallet. Simbal shows two grooved brass plates with leather handles. Segi Tiga shows a suspended open steel frame and beater. Chooser previews reuse these actual vector materials with separate paint IDs; there are no external assets.

The new studios use the existing Studio heading and main/inspector arrangement, plus the shared percussion transport, settings, trace and table. Two focusable SVG regions and F/J buttons distinguish the actions using text, outline and color. Button labels wrap on narrow screens; reduced motion disables the brief strike translation. Long metal decays are bounded and cancelled by Stop/navigation. No continuous decorative animation is added.

## Shared workbench and Game UI

The physical instrument remains the signature. Larger text, calmer panel shadows and clear Rakam/Main/Henti labels support it. Keyboard guidance uses native disclosure; it does not compete with the playing area. Percussion uses one shared session badge and trace-source explanation, so live practice is distinguishable from a saved take.

Game presents its selected challenge and phase before the arena. Setup guidance stays short; detailed timing/scoring rules live in a native disclosure. Start/resume/replay controls are available in the arena overlay, and results show score, local best and a route back to challenge selection. State colors, focus rings and control targets come from the shared workbench. Decorative motion respects reduced motion; rhythmic tile movement retains its gameplay purpose.

| Maintained rule | Previous drift | Resolution |
| --- | --- | --- |
| One instrument entry | Eight long cards required extensive scrolling | Compact family groups and native jump navigation |
| Readable shared controls | Many instructions were 9–11px | Shared 12–13px supporting copy and larger controls |
| Equivalent action names | Pitched play used a generic score label | Main lagu/Main rakaman names follow the current take |
| Shared modal owner | Edited rows could lose focus after rebuilding | Native modal semantics plus explicit editor focus recovery |
| Stable record context | Practice and saved percussion trace could mix | Shared trace-source state and separate temporary practice trace |

## Studio Pro and display preferences

Studio Pro is a separate workspace with three tabs: Susunan, Mixer and Projek. Shared transport and project timing stay above the active panel; a one-bar step editor bounds the piano/percussion grid. Track overviews and note grids own their horizontal scrolling, while the page and project forms keep natural document height. The chooser offers one compact Pro entry, and each legacy inspector has one send-to-Pro action.

Keep the blue-gray/mint/white identity. Existing index.html tokens remain the canonical light palette. `studio-pro/display.css` owns dark semantic overrides and color-vision variants; `--on-primary` changes with the theme to maintain readable filled controls. Fonts, spacing and physical SVG materials stay shared. The display module runs before the body to restore system/light/dark and independent color-vision preferences.

Protanopia/deuteranopia use blue/orange/purple separation; tritanopia uses teal/rose separation; high contrast uses explicit light/dark boundaries. Alternative xylophone bars have independent stripe/dot patterns. All notes keep names/keyboard labels, tracks have numbered names, and mute/solo/recording/error states have text and outlines. Avoid color-only meaning. The application does not claim clinical personalization or physical-device accessibility certification.

Native selects remain intentional, and native dialogs retain modal focus/Escape/return behavior. Mixer ranges preserve their DOM nodes while values change. Pro styles use `--surface`, `--surface-subtle`, `--background`, `--ink`, `--muted`, `--primary`, `--on-primary` and `--border`; no separate copied theme system is introduced.

BM/BI uses a compact native select beside the mode navigation, outside its hidden chooser state. The header may wrap on narrow widths; controls retain a 44px target and use the existing colour/focus tokens. One inline translation owner passively updates known text and accessible attributes, preserving live controls and form contents. The corpus is bundled with the standalone HTML; no translation service, font, dependency or network request is added.
