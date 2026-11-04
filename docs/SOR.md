# SOR — e-Instru Studio

Version 1.0, approved branch workflow 2 November 2026. Owner: Ijamm.

Self-contained BM digital instrument, recorder and four-lane rhythm game in index.html. Guest Studio and Game need no build, external assets or backend connection. Optional Supabase accounts use a network service and a pinned vendored SDK bundled inline in the same HTML; there is no runtime CDN dependency. Digital exports: JSON full data and CSV timing.

Ten arrangements have short (10–15s) and long versions; exact pitches/onsets/rests are retained. Video-title provenance is labelled, with unverified note/timestamp transcription clearly stated. Eight manual keys A S D F G H J K; game lanes A S D F. Score limits: 512 events and 180s. MIDI 0 means rest.

Studio keeps raw input timestamps separate from edited/quantized score. Tempo slider retimes score, never raw capture. Playback and melody/table selection stay aligned. Reset preserves notes and edits. Microphone estimation is optional/local; unknown notes remain unknown.

Game supports 10 songs, both variants, tempo factors 75/100/135%, score/combo/life, Excellent/Good/Miss, pause/resume and local best records. Use the actual source/tests for exact constants. Browser AudioContext is the timing origin; no claim of physical acoustic latency calibration.

Branch roles and manual-update policy: docs/BRANCH_POLICY.md. Architecture follows this SOR. Audit reviews the actual combined HTML, runs all tests and publishes main on user instruction. Share/tutorial do not update automatically. Versions follow vX.XX.X independently for this project.

## Instrument extension — v1.04.0, 4 November 2026

The first view is an instrument chooser. The inline INSTRUMENTS registry owns pitch bounds, default octave and sustain capability; a recorder view adapter owns raised pads, inline SVG and verified Baroque data. Both instruments reuse the existing Studio controller, timeline, editor, catalog, transport, metronome, scheduler and JSON/CSV export. Per-instrument workspace snapshots preserve takes/edits on switching. Game rules and game audio remain unchanged. Recorder microphone detection is not implemented.

Additive instrument_id, gate_tick, raw_duration_ms and release_ms keep old data readable. Legacy takes default to xylophone; no raw evidence is rewritten. Physical recorder range and honest catalog handling are documented in docs/RECORDER.md. The implementation is accepted for main as v1.04.0. Valid empty instrument takes are restored; fallback defaults never overwrite a separately valid saved workspace.

## Unpitched percussion extension — Tamborin and Kompang

Tamborin uses the actual ui instrument chooser, with a view adapter that suspends the pitched Studio controller and safely returns to Xylophone, Rekoder Soprano or Game. Percussion actions are not added to XyloCore's pitch registry. Kompang extends the same owner with center/edge actions and its own visual/audio configuration.

Inline percussion-core owns unpitched action takes, immutable raw_capture, score editing/tempo and bounded lookahead/metronome scheduling. percussion-ui exposes a configurable Studio factory for transport, capture, trace and persistence; tamborin-ui and kompang-ui supply instrument identity, two action labels, example patterns and their own synthesis adapters. No external runtime module is fetched. See the Tamborin handoff for the initial reusable contract and the Kompang handoff for the combined implementation/verification.

All four views reuse the canonical studio heading, workspace grid, panel, transport, settings and inspector CSS owners. Percussion varies only its physical playing area, action pads and pattern/trace content. Playback sits with recording below the instrument; exports sit in the inspector; Data ketukan is always expanded. This layout reconciliation changes no controller, scheduler, audio, storage or capture code. See docs/handoffs/ui/LATEST.md and tests/browser-layout.cjs for the current layout evidence.

Percussion JSON schema e-instru-percussion-take/v1 and per-instrument e-instru-percussion-v1:<id> storage coexist with unchanged pitched schemas and storage. Raw input is performance.now() relative to the first manual input; at_ms is separately editable. Only manual events enter recording. Data limits are 512 actions / 180000 ms onset; a playback tail of at most 1000 ms may extend the scheduler past the final legal onset. All sounds remain digital synthesis.

## School percussion extension — 4 November 2026

The same unpitched core and Studio factory now support `snare` (hit/rim), `bass_drum` (hit/soft), `cymbals` (crash/soft) and `triangle` (open/muted). `school-band-ui` constructs these four thin configuration adapters once. Each supplies its own SVG, labels, patterns, synthesis function and storage identity. `instrument-navigation` incorporates the resulting route descriptors; the pitched registry and Game remain unchanged.

The shared factory accepts `voiceTailMs`, defaulting to the previous 650ms behavior. The school instruments use 1000ms so the final long cymbal/triangle strike can decay before normal completion. Stop and lifecycle cancellation remain immediate. Muted triangle is an independent short strike, not a global damping command. See `docs/handoffs/instrument-pancaragam/LATEST.md` for source identity and actual checks.

## Optional Supabase account extension — auth-supabase

The dedicated task branch starts at main `c0ba48bb9c35244354779cc227ecb7c999bff5dd`. It adds email/password registration, sign in/out, email confirmation, forgot password and password change while retaining guest/offline access to all eight instruments, ten songs and Game. Authentication state does not alter the existing recording schemas, local storage identities, raw evidence, export-password gate or Game rules. It does not introduce cloud recording synchronization. Accepted VERSION remains `v1.04.0`.

The new Supabase project is `ahvyieyojqciohdogsqc`, Singapore, organization Norhizam. Database scope is a user-owned `profiles` table protected by Row Level Security; passwords and sessions are managed by Supabase Auth. No new table stores takes, scores, Game results or audio. The browser uses only the project URL and public key. Never ship or log service-role keys, SMTP passwords, management tokens or callback credentials.

Runtime delivery remains one self-contained `index.html`. The vendored `supabase-js` SDK is pinned to `2.118.0` and bundled inline, retaining its provenance and license. Account operations require network access and HTTPS hosting. Verification/recovery callbacks use the allowed root `https://undead41.github.io/xylo-studio/`; file downloads remain usable as guest instruments but are not the account callback destination. Callback handling validates the session, explains invalid/expired links and removes credentials from the URL.

Thirteen Malay email templates and their field/subject manifest are source-controlled under `supabase/templates`: six authentication templates and seven security notifications. Custom SMTP was observed configured and enabled in the hosted project's Dashboard. All thirteen subjects and bodies were saved; each body was read back after reloading and matched the source exactly. All seven security notification toggles are enabled. Inbox delivery and a complete account email round trip remain unverified; no emails were sent or real users created during this verification. Saved hosted configuration, source validation and a generated configuration payload are separate from delivery evidence. Notification templates for phone, identity and MFA events do not expand the implemented UI beyond email/password accounts.

Test the actual inline account source, callback and session handling, profile isolation and offline guest behavior. Keep provider/network fixtures distinct from live hosted tests and inbox delivery evidence. The task may update `auth-supabase`; promotion to main requires a new explicit user request. Share/tutorial and the current Pages settings remain unchanged.
