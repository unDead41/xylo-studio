# SOR — Xylo Studio

Version 1.0, approved branch workflow 2 November 2026. Owner: Ijamm.

Self-contained BM digital instrument, recorder and four-lane rhythm game in index.html. No build, external assets, backend or companion runtime is required. Digital exports: JSON full data and CSV timing.

Ten arrangements have short (10–15s) and long versions; exact pitches/onsets/rests are retained. Video-title provenance is labelled, with unverified note/timestamp transcription clearly stated. Eight manual keys A S D F G H J K; game lanes A S D F. Score limits: 512 events and 180s. MIDI 0 means rest.

Studio keeps raw input timestamps separate from edited/quantized score. Tempo slider retimes score, never raw capture. Playback and melody/table selection stay aligned. Reset preserves notes and edits. Microphone estimation is optional/local; unknown notes remain unknown.

Game supports 10 songs, both variants, tempo factors 75/100/135%, score/combo/life, Excellent/Good/Miss, pause/resume and local best records. Use the actual source/tests for exact constants. Browser AudioContext is the timing origin; no claim of physical acoustic latency calibration.

Branch roles and manual-update policy: docs/BRANCH_POLICY.md. Architecture follows this SOR. Audit reviews the actual combined HTML, runs all tests and publishes main on user instruction. Share/tutorial do not update automatically. Versions follow vX.XX.X independently for this project.
