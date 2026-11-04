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

The runtime stays in one downloadable index.html with local fonts, inline assets and no runtime CDN requests. The optional account feature bundles the pinned vendored `supabase-js` 2.118.0 SDK inline; only account operations require the Supabase network service. Guest Studio and Game remain available offline. Inline core, game rules, Studio UI and game UI remain separately identifiable for tests. Keep raw input evidence distinct from edited score. Audio and microphone access follow a user gesture; optional microphone processing remains local and xylophone-only.

Source of requirements: Ijamm's digital Studio/game requests, the 4 November recorder/rebrand request and the approved branch workflow. Architecture decisions match docs/SOR.md. index.html is shared across worker roles; the reviewed ui implementation is promoted to main as v1.04.0 under Ijamm's explicit instruction.

## Colors

The existing `:root` in index.html is the canonical runtime token owner (Model B); the values above mirror it. Primary teal directs actions and active states; navy provides readable structure. Colorful xylophone bars remain untouched. Warm ivory and green recorder rings describe the instrument's material, not new global interface tokens.

## Typography

Use the existing display face for instrument names and note letters, body face for instructions, and monospace for MIDI/timing/keyboard labels. All fonts are local fallbacks. Do not introduce a remote font or change global typography for a single instrument.

## Layout

Chooser: eight instrument cards in two columns on desktop, stacked on phones. The first four choices retain their positions; a Perkusi sekolah & pancaragam heading introduces the other four. All eight studios use the same `.studio-heading`, `.workspace`, `.main-work`, `.instrument-panel` and `.inspector` geometry. The main area contains the playable instrument, Rakam/Main/Henti transport, persistent status, tempo/metronome/Reset row, song catalog or percussion patterns, trace, then a visible Data ketukan table. JSON/CSV exports live in the inspector. The 314px inspector narrows to 282px at 1050px and stacks below the main area at 850px. Document scrolling owns the page; traces and event tables retain their own scroll bounds.

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

Reconcile drift: original docs described the xylophone-only entry; the approved multi-instrument entry extends that identity. Palette, fonts and xylophone physical design match the existing runtime; no global token was changed.

## Tamborin extension

The Tamborin view uses the canonical studio shell and inspector, including the same header size and Tukar instrumen control as Xylophone/Recorder. Its inline SVG shows a wooden shell, pale membrane and eight clearly paired metal jingles. Ketuk/Goncang pads use raised pale mint surfaces, soft shadows and pressed feedback. The physical object and pads sit in an inset playing area matching the recorder stage. A compact disclosure holds technique and digital-synthesis guidance; it does not displace the main controls. Percussion patterns replace the pitched song catalog, while capture and independent unpitched storage remain unchanged.

## Kompang extension

Reuse the same canonical shell as the other three studios, with the percussion pattern/trace variant used by Tamborin. A wooden inline SVG shell, pale textured membrane and stitched rim provide depth without metal jingles. The center ellipse and edge annulus are disjoint focusable hit shapes, with subtle tone/line labels and localized teal/lilac feedback. F/J action buttons remain large; reduced motion retains outlines and text while removing movement. All four chooser cards use the existing card geometry and Buka studio action, with Cadangan baharu badges on the two unpitched instruments. Geometry and flow are compared across all four views at 1440, 1050, 850, 540, 390 and 320px in `tests/browser-layout.cjs`.

## School percussion extension

Dram Sisi uses a teal cylindrical shell, steel rim, tension rods and two drumsticks. Dram Bes has a broad upright skin, deep shell, steel rods and a padded mallet. Simbal shows two grooved brass plates with leather handles. Segi Tiga shows a suspended open steel frame and beater. Chooser previews reuse these actual vector materials with separate paint IDs; there are no external assets.

The new studios use the existing Studio heading and main/inspector arrangement, plus the shared percussion transport, settings, trace and table. Two focusable SVG regions and F/J buttons distinguish the actions using text, outline and color. Button labels wrap on narrow screens; reduced motion disables the brief strike translation. Long metal decays are bounded and cancelled by Stop/navigation. No continuous decorative animation is added.

## Optional account extension

Account controls use the existing teal palette, local fonts, rounded native controls and focus treatment. Keep the instrument chooser directly usable by guests. Account forms cover sign up, sign in, email confirmation, password recovery and password change without replacing the studio workspace or its recording inspector. A pending network action has a clear status; errors remain readable beside the relevant form. Password fields use appropriate autocomplete and do not display credentials in status text.

Account dialogs must respect existing shortcut and audio lifecycle boundaries: typing cannot play notes, opening or closing a form cannot manufacture captured events, and account transitions cannot erase local takes or Game records. Account/profile state has its own owner; it does not reuse the local export-password gate. On narrow screens, the account controls and forms fit the document width and preserve native keyboard focus and dismissal.

Email templates in `supabase/templates` reuse the e-Instru name, teal action color and Malay wording in email-compatible HTML. All thirteen subjects and bodies have been saved in the hosted project; each body was read back after reloading and matched the source exactly. Custom SMTP was observed configured and enabled, and all seven security notifications are enabled. Inbox delivery and a complete account email round trip remain unverified; no emails were sent or real users created during this verification. The application must not present saved templates, SMTP setup or source validation as a delivered email.
