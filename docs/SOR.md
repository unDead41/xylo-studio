# SOR — e-Instru Studio

## Display preference extension — ui-themes, 4 November 2026

One optional, offline `StudioDisplay` owner controls system/light/dark appearance and independent standard/protanopia/deuteranopia/tritanopia/high-contrast vision palettes. Its only storage key is `e-instru-display-v1`. The early inline bootstrap restores appearance before CSS/body paint and refreshes browser theme metadata after parsing. Storage failure leaves preferences usable for the session; invalid values fall back to validated defaults. Native color-scheme and forced-colors behavior remain supported.

The appearance dialog is a single shared header action, available on chooser, eight instruments and Game. Existing note letters/keys, source wording, recorder hole symbols, action labels and judgment words remain. Vision palettes add bar textures, solid/dashed actions, press outlines and explicit Game lane-key labels. SVG timeline and cached canvas colors follow preferences; physical instrument materials retain their existing identity.

The preference-change event repaints existing bar styles/timeline fills and draws the existing Game canvas directly. It never rebuilds held pads, resets cursor/scroll, writes music data, changes pitches/timing or invokes Game judgments. Opening the settings dialog separately requests the existing Game pause behavior, preventing missed input behind a modal; resume retains preparation beats. Source files share names/API/storage with the concurrent Studio Pro work. Only one display owner/dialog may exist after integration; see the `ui-themes` handoff for merge guidance.

Version 1.0, approved branch workflow 2 November 2026. Owner: Ijamm.

Self-contained BM/BI digital instrument, recorder and four-lane rhythm game in index.html. No build, external assets, backend or companion runtime is required. Digital exports: JSON full data and CSV timing.

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

## Overall UI/UX candidate — ui, 4 November 2026

The eight-instrument chooser uses native family fragment links and retains existing instrument IDs and route owners. Shared workbench styling owns reading scale, sticky app navigation, transport wrapping, inspector and table geometry. Existing native select, dialog and feedback owners remain canonical.

UI changes affect the pitched, percussion, Game and instrument-navigation adapters. Core catalog/pitch/game rules, percussion model/audio and instrument configurations remain the existing owners. Percussion practice traces now begin a separate temporary timeline; saved takes/raw evidence are untouched and replay restores the saved trace. Dialog validation/focus recovery and source-aware accessible playback names improve interaction correctness without changing recording schemas or timing.

This task's deliverable is branch ui with accepted VERSION v1.04.0 and an Unreleased candidate record. See `docs/handoffs/ui/LATEST.md` for six-worker provenance, actual test counts, source hashes, browser coverage and limits.

## BM/BI presentation — 4 November 2026

The inline `studio-i18n` owner precedes the instrument controllers. Its exact phrase pairs and anchored parameter templates cover the chooser, eight studios, Game, dialogs, help, validation and accessible attributes. A bounded cache and changed-subtree observer avoid whole-document work on each clock update. Language refresh changes text nodes and display attributes only; it calls no transport/navigation/render action. The separate `e-instru-language` preference defaults to `ms` and accepts `ms`/`en`, with storage-denial and cross-tab fallback handling.

Opaque parameters retain user titles and filenames. Input/textarea values, machine identifiers and exports stay literal; the existing UI owners mark custom imported arrangement/section display text with `data-i18n-ignore`. Known catalog prose is translated for display only. Existing core catalog, validation, timing, game and audio contracts remain unchanged. New default titles are localized only at their creation. See `docs/handoffs/ui-bilingual/LATEST.md` for source identity and verification limits.
