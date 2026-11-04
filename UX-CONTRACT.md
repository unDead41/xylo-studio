# UX contract

BM digital Studio and four-lane rhythm game. JSON/CSV are the two export formats. No account/backend is required. Local password gate is a UI convenience, never described as server security.

Studio: first captured input is time zero; raw input log survives tempo changes, quantization and edits. Unknown microphone notes stay unknown. Timeline audition selects the matching table event; it never injects a note into recording. Tempo 40–200 BPM is editable during playback and locked during recording. Reset stops transport and restores capture tempo while preserving notes/edits. Long arrangements retain explicit extended pitches/rests.

Game: four lanes, Easy/Medium/Hard at 75/100/135% base BPM, visible tempo/duration, countdown, score/combo/life, pause/resume and local best. Visibility/focus/audio suspension pauses the game; resume gets preparation beats. No points from held/repeated key events. Only successful tiles sound. Leaving Game cancels its session while preserving Studio takes.

Microphone is opt-in, local analysis, with tracks stopped on cancellation/disposal. Raw audio is neither uploaded nor persisted. JSON keeps evidence flags and raw timestamps. All songs retain honest arrangement/video provenance. Tests must exercise actual inline source and derive export controls from the real HTML.

Instrument chooser: every page load begins at “Pilih instrumen anda”. Choosing opens that instrument's saved workspace; “Tukar instrumen” stops audio/capture safely and returns to the chooser. Both takes, lastCustom and in-session edit histories survive switching. The original storage conflict boundary is shared by both instruments.

Recorder: C–C′ are pad labels, sounding C5–C6. Held pads/keys have visible and aria-pressed state; pointer/key release and lifecycle cancellation cannot leave a voice sounding. Basic Baroque fingering follows Yamaha's standard rows; rear T and front 1–7 are separate. Closed/open/vented states use symbols, shape and text as well as color. Extended in-range catalog notes have additional pads. Out-of-range score notes block recorder playback and get an explanatory timeline-audition message; neither score nor raw evidence is changed. See docs/RECORDER.md for the authoritative manufacturer mapping.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | Native select | index.html existing selects | OS popup geometry accepted | tests/browser-recorder.cjs |
| Form | Existing edit/export forms | novalidate and inline errors in index.html | Recorder gate field | tests/ui.test.cjs; tests/recorder.test.cjs |
| Scrollbar | Global inline CSS | :root and global scrollbar rules | Event table 330px; timeline horizontal | Phone overflow browser check |
| Toast | announce / transportStatus | xylo-ui inline controller | Toast and persistent status strip | tests/ui.test.cjs |
| Dialog | Existing native dialog owner | openDialog / close-dialog | Confirm, edit, microphone, export | Existing regression and browser workflows |
| Instrument input | beginInput/endInput/releaseInputs | INSTRUMENTS / instrumentNotes | Percussive xylophone; sustained recorder | tests/recorder.test.cjs |
| Score/capture | XyloCore and existing scheduler | fromTaps/reflow/importTake / raw_capture | Optional recorder gate metadata | tests/core.test.cjs; tests/recorder.test.cjs |
| Recorder guide | BAROQUE data and inline SVG | Manufacturer mapping in docs/RECORDER.md | Standard rows; missing rows labelled | tests/recorder.test.cjs; desktop screenshot |
| Microphone | Existing xylophone detector | startMic / XyloCore.detectPitch | Opt-in local xylophone only | Existing unit coverage; recorder disabled in browser |


Static HTML audits cannot infer the existing `$().addEventListener` bindings. Runtime tests exercise the actual inline source rather than adding fake inline click attributes to satisfy a scanner.

Tamborin: native buttons and SVG surface support pointer/touch; Space taps and G shakes only while its view is active. Editable fields, composition/modifier keys, repeated/held keys and native transport-button Space activation do not manufacture extra actions. Examples and metronome never enter capture. Trace starts empty until actual manual input; the recording inspector starts empty until Rakam receives an input. Rakam asks before replacing an existing take.

Percussion capture keeps immutable original action/timestamps separately from editable action/onset data. First raw timestamp is exactly zero. Tempo 40–200 BPM is locked during recording; changing playback tempo stops transport, retimes edited score and leaves raw evidence intact. Reset stops, disables metronome and restores capture BPM while preserving events/edits; when normal retiming would exceed 180s, preserve valid edited onsets and explain that fallback. Stop/nav/blur/visibility/pagehide/audio suspension cancels pending activation, scheduled voices and timers. An activation that resolves after cancellation cannot sound.

Percussion JSON/CSV exports carry instrument identity and unpitched actions, never MIDI substitutes. Pitched JSON/CSV and legacy recordings keep their existing contracts. An instrument is offered as playable only when its view/controller and audio are implemented; Kompang stays disabled.
