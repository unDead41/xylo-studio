# UX contract

BM digital Studio and four-lane rhythm game. JSON/CSV are the two export formats. Guest Studio and Game require no account or backend connection. Optional Supabase accounts require a network connection and HTTPS hosting. The local export-password gate remains a UI convenience, separate from Supabase account authorization.

Studio: first captured input is time zero; raw input log survives tempo changes, quantization and edits. Unknown microphone notes stay unknown. Timeline audition selects the matching table event; it never injects a note into recording. Tempo 40–200 BPM is editable during playback and locked during recording. Reset stops transport and restores capture tempo while preserving notes/edits. Long arrangements retain explicit extended pitches/rests.

Game: four lanes, Easy/Medium/Hard at 75/100/135% base BPM, visible tempo/duration, countdown, score/combo/life, pause/resume and local best. Visibility/focus/audio suspension pauses the game; resume gets preparation beats. No points from held/repeated key events. Only successful tiles sound. Leaving Game cancels its session while preserving Studio takes.

Microphone is opt-in, local analysis, with tracks stopped on cancellation/disposal. Raw audio is neither uploaded nor persisted. JSON keeps evidence flags and raw timestamps. All songs retain honest arrangement/video provenance. Tests must exercise actual inline source and derive export controls from the real HTML.

Instrument chooser: every page load begins at “Pilih instrumen anda”. Choosing opens that instrument's saved workspace; “Tukar instrumen” stops audio/capture safely and returns to the chooser. Both takes, lastCustom and in-session edit histories survive switching. Valid empty takes survive reload; an invalid active envelope must never overwrite a separately valid saved instrument workspace. The original storage conflict boundary is shared by both instruments.

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

Percussion JSON/CSV exports carry instrument identity and unpitched actions, never MIDI substitutes. Pitched JSON/CSV and legacy recordings keep their existing contracts. All chooser entries open playable instruments. Kompang supplies center/edge actions to the shared percussion owner; no MIDI/pitch or fingering UI is used. The SVG center ellipse and edge annulus are disjoint hit regions with separate focusable button roles, labels and local feedback. F/J work only in the active Kompang view; focused action controls accept Space/Enter. Each percussion controller is constructed once and activated/deactivated on navigation. Kompang and Tamborin keep independent storage keys, import identity checks, traces and takes.

Every studio uses the same heading/Tukar instrumen row and main-area/inspector layout. Tamborin and Kompang place Rakam, Main rakaman and Henti directly below the playing surface, followed by status and the shared tempo/metronome/Reset row. Main contoh belongs to the percussion pattern panel. Trace and an expanded Data ketukan table follow it; editing needs no disclosure step. The inspector contains the take name, counts/duration/BPM, capture guidance, JSON/CSV exports and optional import. Technique and synthesis notes remain available in a native disclosure under the pads. On narrow screens the inspector follows the complete main area, with no page-level horizontal overflow.

The chooser now offers eight playable instruments. Dram Sisi, Dram Bes, Simbal and Segi Tiga each provide two named SVG input regions and matching F/J buttons. Shortcuts only affect the active instrument. Every new percussion instrument owns a separate saved take and strict import identity; examples, metronome and audition stay outside manual capture. Existing takes and the pitched/game contracts remain valid. Metal-ring playback may continue for up to one second after the last onset; Stop, navigation, blur, hidden tab and pagehide cancel it immediately. Each studio's recording inspector moves below the main instrument at narrow widths and its action labels may wrap.

## Optional account and email contract

Guests can enter all eight studios and Game without signing in. Sign up, sign in, sign out, email confirmation, forgot password and change password are account actions. Failures or unavailable network access leave guest use and existing local recordings available. Authentication changes do not upload, clear, reassign or synchronize device-local takes, raw capture, Game settings or local bests. No raw audio leaves the browser.

Use native labelled form fields, password autocomplete, visible pending state and inline error/status text. Prevent duplicate submissions while a request is pending. Account dialogs block instrument shortcuts through the existing dialog boundary; typing and account actions cannot become recorded notes. Clear password fields after completed or dismissed actions. Never render session tokens, passwords or raw provider error payloads into the page.

Email requests use neutral wording so the interface does not confirm whether an arbitrary address owns an account. An accepted request is reported as a request, not proof of inbox delivery. Email verification and password recovery return to the allowed hosted root `https://undead41.github.io/xylo-studio/`. Handle expired, invalid or missing callback credentials with a readable message. Password recovery must reach a password-change form through a valid recovery session; a URL flag alone is not authorization. Do not leave callback credentials visible in the URL after processing or accept arbitrary return destinations.

Account data is limited to the authenticated user's profile in the RLS-protected `profiles` table. Credentials remain with Supabase Auth. The bundled SDK and browser configuration contain no `service_role` key, SMTP secret or management token. Account/profile state and errors remain independent of the local export-password gate.

All thirteen Malay email templates are maintained as source: confirmation, invitation, magic link, email change, password recovery, reauthentication, and notifications for password/email/phone changes, identity link/unlink and MFA enrollment/unenrollment. These templates do not imply that phone, social identity or MFA management UI exists. Custom SMTP has not been supplied for the new project; hosted template activation and public email delivery remain separate unfinished setup work. Tests of source templates or mocked requests must not be reported as a live email round trip.
