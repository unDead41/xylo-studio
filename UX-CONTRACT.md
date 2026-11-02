# UX contract

BM digital Studio and four-lane rhythm game. JSON/CSV are the two export formats. No account/backend is required. Local password gate is a UI convenience, never described as server security.

Studio: first captured input is time zero; raw input log survives tempo changes, quantization and edits. Unknown microphone notes stay unknown. Timeline audition selects the matching table event; it never injects a note into recording. Tempo 40–200 BPM is editable during playback and locked during recording. Reset stops transport and restores capture tempo while preserving notes/edits. Long arrangements retain explicit extended pitches/rests.

Game: four lanes, Easy/Medium/Hard at 75/100/135% base BPM, visible tempo/duration, countdown, score/combo/life, pause/resume and local best. Visibility/focus/audio suspension pauses the game; resume gets preparation beats. No points from held/repeated key events. Only successful tiles sound. Leaving Game cancels its session while preserving Studio takes.

Microphone is opt-in, local analysis, with tracks stopped on cancellation/disposal. Raw audio is neither uploaded nor persisted. JSON keeps evidence flags and raw timestamps. All songs retain honest arrangement/video provenance. Tests must exercise actual inline source and derive export controls from the real HTML.
