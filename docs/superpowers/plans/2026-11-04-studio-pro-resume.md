# Studio Pro continuation

**Goal:** Continue the existing Pro studio with faster arrangement workflows and playable starting examples, while preserving its calm UI and repairing actual gaps.

**Base:** ui at `906d8fa040dc18b13d8a9cb74ea448b023091a94`.

**Current instruction:** Run six workers concurrently. Theme work belongs to another chat and is excluded from this continuation. Preserve its files and existing runtime tokens.

## Feature and interface decisions

- Copy, paste and clear the current selected track/bar through a closed native Bar tools disclosure. Copy is onset-based, uses zero-based bar indices and 96 ticks/bar, and keeps full note gates. Paste creates fresh IDs; incompatible instruments, invalid clipboards and project-end spills fail without partial edits. Source take evidence stays immutable.
- The core publishes `copyBar(project,trackId,barIndex)`, `pasteBar(project,trackId,barIndex,clipboard,{replace:false})` and `clearBar(project,trackId,barIndex)`.
- Project examples provide three original playable four-bar ensembles: melody/percussion, school rhythm and march. Example loading uses the existing safe project-replacement flow. The empty arranger gets a secondary route to those examples; the editor itself stays uncluttered.
- Audit audio scheduling, mixer gestures, persistence, transport and cursor state; fix reproduced defects with regressions rather than broad refactoring.
- Keep eight instruments, ten songs, BM/English, local data, JSON/CSV, offline HTML and accepted v1.04.0. Push ui only.

## Six concurrent tasks

- [x] Core: validated portable bar clipboard and immutable bar transformations; boundary/history regressions.
- [x] Audio: scheduling fairness, lifecycle and actual transport/effect defects.
- [x] Arranger: bar-tools disclosure, clipboard feedback, compatibility/focus/undo behavior.
- [x] Mixer: actual gesture, selection, mute/solo and meter defects; preserve literal names.
- [x] Projects: original ensemble examples and safe replacement/storage behavior.
- [x] Shell: empty-state example route and actual autosave/cursor/lifecycle defects.
- [x] Coordinator: translations, embedding, combined checks and supported browser verification; record source hashes and excluded theme-file hashes.
- [x] Coordinator: preserve concurrent remote ui work, prepare the verified submission to ui.
