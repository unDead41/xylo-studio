# Rekoder Soprano — pitch, penjarian dan data

Implemented in v1.04.0, accepted for promotion from `ui` to `main` on 4 November 2026. Deployment verification is recorded separately after the main ref update.

## Primary sources checked 4 November 2026

- Yamaha, [Soprano recorder (Baroque) fingering chart](https://www.yamaha.com/en/musical_instrument_guide/common/images/recorder/fingering_baroque.pdf), page 1, visually checked. Use the first/standard fingering where alternatives are shown. The diagram is rebuilt as inline SVG from the following data; it does not load Yamaha images at runtime.
- Yamaha, [Recorder fingering](https://www.yamaha.com/en/musical_instrument_guide/recorder/play/play002.html) and [Baroque style and German style](https://www.yamaha.com/en/musical_instrument_guide/recorder/selection/selection002.html). F differs between systems. This application implements Baroque only.
- Toyama/AULOS, [Soprano products](https://aulos.jp/en/products/soprano.html): the manufacturer lists register c″–d⁗. Converted from Helmholtz to scientific pitch notation this is C5–D7, MIDI 72–98. This physical range is broader than the eight basic application pads. Yamaha also distinguishes soprano/tenor written C from the sounding octave; all MIDI values here are **sounding pitch**.

## Basic pad map

`T` is rear thumb hole 0; 1–7 are front holes. `Closed` means fully covered, including both openings of double holes 6 and 7. All unlisted holes are open. Shapes, crosses, numbers and text accompany color in the SVG and state chips.

| Pad | Solfa | Key | Sounding pitch | MIDI | Closed holes (Baroque) |
| --- | --- | --- | --- | --- | --- |
| C | Do | A | C5 | 72 | T, 1, 2, 3, 4, 5, 6, 7 |
| D | Re | S | D5 | 74 | T, 1, 2, 3, 4, 5, 6 |
| E | Mi | D | E5 | 76 | T, 1, 2, 3, 4, 5 |
| F | Fa | F | F5 | 77 | T, 1, 2, 3, 4, 6, 7 |
| G | Sol | G | G5 | 79 | T, 1, 2, 3 |
| A | La | H | A5 | 81 | T, 1, 2 |
| B | Ti | J | B5 | 83 | T, 1 |
| C′ | Do | K | C6 | 84 | T, 2 |

Additional verified rows used by the existing catalog: Bb5 (82): T,1,3,4; D6 (86): 2; E6 (88): vented T + 1,2,3,4,5; F6 (89): vented T + 1,2,3,4,6. Vented T is represented as partially open; Yamaha indicates 1/3–1/4 open rather than an exact half. The runtime value `.5` is a state enum, not a measured aperture fraction. Other pitches inside the physical range can be synthesized, but a missing fingering row is explicitly labelled as unavailable. Do not infer missing rows or mix German F into this table.

## Catalog and range handling

Recorder catalog loads use the existing `preset` function at octave 5, an explicit +12-semitone transposition from the original octave-4 catalog. `original_midi`, timing, rests, provenance and arrangement text remain unchanged; the inspector discloses the transposition. No existing take is transposed when changing instruments: each instrument has its own retained workspace.

Extra in-range score pitches receive labelled raised pads and appear in Jejak melodi and Data ketukan. The long Are You Sleeping? arrangement retains G4 (MIDI 67) after the explicit catalog transposition. Because that is below C5, recorder playback is disabled with a persistent warning; timeline audition also explains why it cannot sound. The score and exports retain G4. The user may select a different arrangement or explicitly edit pitch. No event is dropped, folded into another octave or silently substituted.

## Capture and compatibility

The existing `xylo-studio-take/v2` schema, localStorage key `xylo-studio-v2`, API names and original catalog arrangement IDs remain stable compatibility identifiers. Active UI branding is e-Instru Studio. Legacy v1/v2 takes without `instrument_id` load as `xylophone`.

- `instrument_id`: `xylophone` or `recorder`, stored on the take and new recorder events/raw captures.
- `onset_tick` and `duration_tick`: existing continuous score cells, 24 ticks per quarter note; old files keep their original meaning.
- `gate_tick`: optional sounding duration independent of the next onset. Recorder playback uses it, falling back to `duration_tick` for older events/catalog arrangements.
- `raw_ms`: original onset relative to first input; `release_ms` is the original release on the same axis; `raw_duration_ms` is the measured hold. Quantization, editing and tempo do not rewrite these evidence fields or the raw_capture log.
- Editing exposes a recorder gate field. Reflow extends the final score cell to cover held notes. JSON retains all metadata; CSV adds instrument, gate, release and raw duration columns after its original columns.
- `instruments` in the saved workspace envelope keeps each instrument's take and lastCustom. Undo history survives in-session switches; as before it is not restored after reload. Storage conflicts retain the existing no-overwrite/export recovery behavior.

## Audio and input boundaries

A fundamental sine plus weaker second/third harmonics uses a 32ms attack, held sustain and 65ms release. This is a soft synthetic recorder approximation, not a sampled/acoustically calibrated instrument. Pointer capture, pointerup/cancel/lost capture, keyup, blur, visibility, pagehide, view changes, Stop and AudioContext interruption release/cancel held and scheduled voices. Late audio startup checks the original input token before starting a voice. A sounding scheduled gate is retimed on live tempo changes; future notes still use the existing scheduler. Sustained timeline auditions enable Stop; starting a new audition, recording or score playback cancels prior audition voices. Valid empty takes restore on reload without replacing other instrument workspaces.

The four-lane rhythm game retains its original xylophone audio and rules. The existing optional local microphone detector is xylophone-only and disabled for recorder. No raw microphone audio is stored or uploaded. Browser signal checks prove Web Audio generation/release, not listening quality on speakers, tuning on real recorders, real-device audio latency or physical phone testing.
