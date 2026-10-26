# Music HTML handoff — Xylo Tiles V1.03.1

Date:26 October2026 (Asia/Kuala_Lumpur).

Site base SHA:af625e4af124bafda4645aac070f5bfc49a158cb. Pages base SHA:1c409afc83bc53bedac8118d476dc3d6fdde084b. Final source SHA is recorded as source_commit in release.json in the Pages repository after source packaging. Pages branch:xylo/music in unDead41/xylo-studio. The firmware repository unDead41/xylophone is unchanged; its integration remains Master's responsibility.

The existing20 score variants (10long,10short), pitches, tick positions and rests are unchanged. Xylo Tiles adapts each to four UI lanes and three tempos:75%,100%,135% of base BPM. All pitches are synthesized exactly, including those outside the eight manual Studio bars. Four game lanes do not describe a servo mapping. No model, pin, angle, supply or actuator limit is introduced.

The game adds onset judgments, score/combo/life, local best records, countdown, pause/resume, reset/restart and mouse/touch/ASDF controls. Studio takes remain separate. The small audio startup/resume promise fix prevents a stale promise from blocking suspended audio. Pure game rules and browser integration are separate inline modules; all remain in one downloadable HTML.

62 automated checks pass. See qa/game-verification.md for actual browser observations and limits. Mapping/calibration: unchanged and physically unverified. The shared synthesizer and simulated clocks are not hardware/acoustic evidence; video note/timestamp transcription remains unverified.

For Master: integrate no game code into Arduino Uno. Keep this as the external HTML companion. Review the score/export contract separately from gameplay scoring. For future releases, update canonical dist/index.html plus VERSION, run tests, copy the tested HTML to Pages index.html and update release.json/source commit. Keep Sites and GitHub Pages bytes aligned. Preserve the private Site audience and never publish firmware main from this worker.
