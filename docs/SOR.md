# SOR — e-Instru Studio

Version 1.0, approved branch workflow 2 November 2026. Owner: Ijamm.

Self-contained BM digital instrument, recorder and four-lane rhythm game in index.html. No build, external assets, backend or companion runtime is required. Digital exports: JSON full data and CSV timing.

Ten arrangements have short (10–15s) and long versions; exact pitches/onsets/rests are retained. Video-title provenance is labelled, with unverified note/timestamp transcription clearly stated. Eight manual keys A S D F G H J K; game lanes A S D F. Score limits: 512 events and 180s. MIDI 0 means rest.

Studio keeps raw input timestamps separate from edited/quantized score. Tempo slider retimes score, never raw capture. Playback and melody/table selection stay aligned. Reset preserves notes and edits. Microphone estimation is optional/local; unknown notes remain unknown.

Game supports 10 songs, both variants, tempo factors 75/100/135%, score/combo/life, Excellent/Good/Miss, pause/resume and local best records. Use the actual source/tests for exact constants. Browser AudioContext is the timing origin; no claim of physical acoustic latency calibration.

Branch roles and manual-update policy: docs/BRANCH_POLICY.md. Architecture follows this SOR. Audit reviews the actual combined HTML, runs all tests and publishes main on user instruction. Share/tutorial do not update automatically. Versions follow vX.XX.X independently for this project.

## Instrument extension — ui candidate, 4 November 2026

The first view is an instrument chooser. The inline INSTRUMENTS registry owns pitch bounds, default octave and sustain capability; a recorder view adapter owns raised pads, inline SVG and verified Baroque data. Both instruments reuse the existing Studio controller, timeline, editor, catalog, transport, metronome, scheduler and JSON/CSV export. Per-instrument workspace snapshots preserve takes/edits on switching. Game rules and game audio remain unchanged. Recorder microphone detection is not implemented.

Additive instrument_id, gate_tick, raw_duration_ms and release_ms keep old data readable. Legacy takes default to xylophone; no raw evidence is rewritten. Physical recorder range and honest catalog handling are documented in docs/RECORDER.md. The v1.03.2 release number remains pending audit acceptance of the candidate.

## Unpitched percussion extension — instrument-tamborin candidate

Tamborin uses the actual ui instrument chooser, with a view adapter that suspends the pitched Studio controller and safely returns to Xylophone, Rekoder Soprano or Game. Percussion actions are not added to XyloCore's pitch registry. Kompang remains disabled until implemented.

Inline percussion-core owns unpitched action takes, immutable raw_capture, score editing/tempo and bounded lookahead/metronome scheduling. percussion-ui exposes a configurable Studio factory for transport, capture, trace and persistence; tamborin-ui supplies instrument identity, two action labels, example patterns and its synthesis adapter. No external runtime module is fetched. See the Tamborin handoff for the reusable contract.

Percussion JSON schema e-instru-percussion-take/v1 and per-instrument e-instru-percussion-v1:<id> storage coexist with unchanged pitched schemas and storage. Raw input is performance.now() relative to the first manual input; at_ms is separately editable. Only manual events enter recording. Data limits are 512 actions / 180000 ms onset; a playback tail of at most 1000 ms may extend the scheduler past the final legal onset. All sounds remain digital synthesis.
