# Studio Pro design

User request: add professional studio functions to the existing website, retain a clear UI/UX, and run six workers concurrently.

The existing e-Instru Studio instrument workbenches remain the quick way to play and record. A separate Studio Pro workspace combines those takes into an arrangement. Its three tabs are Susunan, Mixer and Projek; transport remains shared above the active tab. The current mint, white and blue-gray tokens, local typefaces, document scrolling and native controls remain canonical.

## Functional scope

- Up to eight independent pitched/percussion tracks, sharing 40–200 BPM and 4/4 timing.
- Beat-aligned track overview, one-bar step/piano editor, exact note/action timing, duration and velocity; quantize, transpose, duplicate and remove.
- Synchronized playback, pause/resume, stop, bounded loop, metronome and visible cursor.
- Track volume, stereo pan, mute/solo, reverb and delay, with master volume and a measured output meter when supported.
- Undo/redo; named local projects, autosave, restore, duplicate, delete, JSON import/export and CSV arrangement export.
- Send the current take from each of the eight instruments into Studio Pro. Legacy takes and original capture evidence remain unchanged.

## Shared data and module boundary

`e-instru-project/v1` uses 24 ticks per beat, 96 per bar, 4–32 bars, at most eight tracks and 512 events per track. Events carry MIDI for pitched instruments or named actions for unpitched instruments, never invented percussion MIDI. Imported source takes are retained separately from editable score events. Recorder limits remain MIDI 72–98. Limits produce actionable BM errors without truncating input.

Modules in `studio-pro/` expose ProStudioCore, ProStudioAudio, ProStudioArranger, ProStudioMixer, ProStudioProjects, ProStudioProjectPanel and ProStudioApp. A deterministic embed helper copies these sources into index.html; the shipped runtime stays a self-contained offline HTML file. No runtime dependency or account is added.

## Interaction and recovery

Empty projects explain how to add a track or bring in a take. The editor shows one bar at a time instead of expanding all pitches and bars. Mixer effects belong to the selected track. Tabs preserve the current selection; slider updates preserve focus. Form fields, native select popups, modal Escape/focus, keyboard shortcuts and status follow existing owners.

Stop, navigation and lifecycle cancellation silence scheduled voices and effects. Pending audio activation cannot sound after cancellation. Storage failures remain visible; conflicting or corrupt saved data is not silently overwritten. Destructive project actions use an accessible app dialog. Project JSON and CSV remain the supported digital formats.

## Delivery

Base: ui at 27df2fa. Commit and push only ui; preserve accepted VERSION v1.04.0. No change to main, Pages, share, tutorial, auth branches or the Arduino repository. Verification covers the legacy suite, new model/audio/storage/UI checks, embedded-source consistency and supported browser UI flows. Physical speaker/device listening is outside browser automation evidence.

## Follow-up display request

The user additionally requested colorblind-friendly display modes alongside dark theme. The global Paparan dialog separates system/light/dark theme from standard/protanopia/deuteranopia/tritanopia/high-contrast vision modes. Note names, action labels, numbered tracks, bar patterns and state outlines retain information without relying on hue. Mobile timing controls use a native disclosure to keep the main workspace clear.

## Concurrent language compatibility

Preserve ui commit71e7b09, its original BM/English language owner and all source evidence. Extend its bundled corpus for Pro/display, guard raw names and preserve data/transport when switching languages. Both parent histories are integrated without a force push.
