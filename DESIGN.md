---
version: alpha
name: Xylo Studio
description: A bright instrument workbench for Ijamm to turn taps into editable musical scores.
colors:
  primary: "#126B66"
  ink: "#172F41"
  background: "#EDF3F7"
  surface: "#FFFFFF"
  muted: "#526879"
  border: "#D7E2E9"
  danger: "#B23845"
  focus: "#156CC4"
typography:
  display:
    fontFamily: "Trebuchet MS, Avenir Next, sans-serif"
  sans:
    fontFamily: "Segoe UI, Arial, sans-serif"
  mono:
    fontFamily: "Consolas, ui-monospace, monospace"
rounded:
  DEFAULT: "0.75rem"
  panel: "1.25rem"
  pill: "999px"
spacing:
  page-max: "80rem"
  section-gap: "1.5rem"
components:
  button:
    height: "2.75rem"
  dialog:
    width: "44rem"
---
# Xylo Studio Design System

## Overview

Product tool for Ijamm, a Malaysian student/IoT coder; BM UI for desktop mouse/keyboard and usable touch. The task is a separate HTML instrument/recorder, with no Uno firmware dependency. Source: user request and Xylophone Music contract7570da0. Ten video-title presets stay labelled untranscribed; the four existing scores retain their exact notes and timing. No claim that browser synthesis or microphone estimates prove physical actuator performance.

Creative direction: a daytime music workbench with one memorable physical instrument: eight coloured bars staggered by pitch, two pegs, and a solid instrument rail. Everything else is calm utility. Avoid dark synth consoles, generic analytics cards, marketing heroes, or ornamental gradients. One screen with scoped editing and export dialogs. No Japanese locale/market scope.

Token owner: CSS custom properties in dist/index.html. This file records those normative values; all foundational components consume the variables. Bar colours are expressive pitch encodings and never the only note labels.

## Colors

Pale blue background and white panels; navy ink; teal primary. Red is recording/destruction, not ordinary navigation. Visible blue focus ring. Global scrollbar tokens apply to all overflow panels. Forced colours use system colours.

## Typography

Trebuchet display for compact expressive titles; Segoe UI body; Consolas only for pitch, timing and code. No network fonts, images or dependencies. Body14–16px; titles readable on mobile; numeric columns use tabular figures.

## Layout

Maximum80rem, 1.5rem gutters. Desktop instrument and take inspector in2 columns; below900px stack. Timeline expands horizontally with score ticks, and vertically with the union of score pitches and eight manual bars; rests/unknowns get separate lanes. Timeline/table own horizontal overflow; document owns vertical scrolling. Song selector wraps; one native version selector switches the same ten cards between Long and Short. Header contains only the brand; user removed the introductory copy, header actions, duration badge and help card. The inspector remains full width when stacked. No fixed viewport height. Dialog is viewport bounded and scrollable.

## Elevation & Depth

Subtle borders on utility panels. Only instrument bars and modal use significant shadows. Two pegs and shortened bars communicate an instrument, not decorative cards.

## Shapes

Panels1.25rem, controls0.75rem; pill only for evidence/status tags. Native form controls accepted for OS popup geometry.

## Components

V1.03.1 adds a compact Studio/Permainan switch to the header. Xylo Tiles retains the light workbench shell with a navy four-lane arena for legible moving targets. Mint, peach, yellow and lavender tiles carry explicit MIDI note labels. A labeled hit line and real A/S/D/F buttons anchor the arena. Sidebar settings, a compact score/combo/best HUD, native life/progress elements and a result panel use the existing typography, radius and color tokens. At850px the configuration stacks above the arena; at540px life gets its own row. The app remains a single offline-capable HTML with no network assets or copied imagery from the reference game. The uploaded game screenshot is design context only.

Semantic buttons, native selects, labelled input, native dialog for focus trapping/inert/Escape. One notification status system with aria-live; validation inline in export. Data actions use Undo for reversible removals; replacing a take uses a scoped confirmation dialog. Recording state visibly changes the transport and locks conflicting operations. Tempo is a native range with numeric BPM output; Reset sits after Metronome. Current score event uses a teal table background, a ▶ number marker, aria-current and an outline on the matching timeline note. A clear help dialog and browser-local save state are available. Export/import remain explicit user actions.

Motion:120ms bar press only; no ambient animation. Reduced motion removes transforms/transitions. All bar buttons have visible pitch, solfege, keyboard key, and accessible name.

## Do's and Don'ts

- Do retain exact raw timestamps separately from quantized musical data.
- Do label presets as proposals and microphone readings as estimates.
- Do keep all notes in the score when quantization collides; show errors instead of deleting notes.
- Don't claim inferred BPM/pitch is acoustically verified or export pin/angle guesses.
