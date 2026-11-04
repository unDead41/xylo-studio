# Studio Tamborin handoff

Date: 4 November 2026 (Malaysia). Status: implemented; host software verification passed. Browser screenshots and speaker listening are **not established** for this candidate.

## Source and branch identity

- Repository: https://github.com/unDead41/xylo-studio
- Authorized worker branch: `instrument-tamborin` only.
- Own linked worktree: `/workspace/scratch/88ea8cd78810/instrument-tamborin`.
- Initial base / origin/ui at task start: `46338fe646408c758232eec9ba7b5f876ff1f9e4`.
- Initial own implementation commit: `01e954eb472899dbec8bac484579cb36fb9a44d7`.
- Current ui update reviewed and integrated as a merge parent: `115e54d87b10804ae6f94ff0efe895099d035e20` (actual branding, chooser and soprano recorder).
- Local tested merge commit: `2ea7a7c091f20ce5cb0f82bf662e51e489342679`.
- GitHub implementation HEAD: `9b7bf61113e409ba59203c7042da866abed61efb`; parent is integrated ui115e54d. Its tree is byte-identical to the local tested merge tree: `7b47a150e6c35caf3bdf2a785fe0e19d52757a26`.
- Tested `index.html` SHA-256: `3cc191dbdd689aeb312ad37b9bc434229ec07fe40a33d5aa5ebb99d40e4c42d5`.
- The following documentation-only delivery commit adds this handoff. Its parent is the GitHub implementation HEAD above; product/test bytes and the tested source hash are identical. Resolve the delivery wrapper using `git rev-parse origin/instrument-tamborin` after fetch.
- Delivery uses the authorized GitHub connection because the shell has no GitHub push credential. Git Data creates the tested tree/commit and only the instrument-tamborin branch ref; no other branch ref is written. Local worker checkpoints remain available in a local backup ref after synchronizing the final branch.
- A fresh isolated worktree was clean at the initial base. Remote ui advanced during implementation; its actual source/docs/tests/handoff were read before integration. The final pitched core and game rules are byte-identical to ui115e54d.
- VERSION and visible/meta version remain `v1.03.2`. No release tag, Pages publication, main merge/push or ui push is authorized/performed by this worker.

## Implemented behavior

- The actual ui chooser retains Xylophone and Rekoder Soprano, adds playable Tamborin, and shows Kompang as disabled/in development. The existing e-Instru Studio branding, recorder SVG/fingering and pitched workspace are preserved.
- Tamborin has its own large inline wooden-shell/skin/paired-jingle SVG. Pointer/touch surface and large Ketuk/Goncang controls use one action path. Space taps, G shakes; repeated/held keys, text editing, modifiers/composition and native transport button Space handling do not generate duplicate actions. Reduced-motion rules remove movement while text feedback remains.
- Two digital synthetic textures: short membrane/noise strike and longer high-pass noise/inharmonic jingle shake. The UI explicitly says synthesis; no sample, raw microphone recording or external asset is used. A metronome click is its own scheduler event and has an accented downbeat.
- Four two-bar example patterns, BPM40–200, standalone/recording metronome, record, stop, reset and recording replay. Recording tempo is locked as in the existing Studio contract. Example playback, trace audition and metronome do not enter user capture.
- Live trace remains empty until actual input. The recording inspector remains empty until Rakam receives manual input. First recorded onset is exactly zero. Take title, action/onset editing, JSON import/export and CSV export use their own unpitched schema/storage. Starting a new take asks before replacing an existing one.
- Tempo retimes editable at_ms only and stops playback with a status message; raw_capture/raw_ms remain unchanged. Reset stops transport, disables metronome and restores capture BPM without deleting recorded events, evidence or edits. If ordinary retiming would push a valid edit past180s, Reset restores BPM and retains the valid edited onsets, explaining this fallback.
- Stop, view switching, pagehide, visibility loss, blur and detected audio suspension cancel scheduling/voices. Pending audio activation uses session tokens; a stale resolution cannot sound after Stop/navigation. Finished synthesis graphs and scheduler cancellation handles are released. A final legal onset at180000ms may finish its sound tail within the separate +1000ms transport allowance.
- Recorder/xylophone takes, edits, held-note release evidence and old JSON/CSV remain under the original pitched owner. Percussion never masquerades as MIDI notes. All10 songs, both variants and game rules remain intact.

## Direct changes relative to integrated ui

| Area | Files |
| --- | --- |
| Standalone runtime, minimal pitched bridge, actual chooser card | `index.html` |
| Shared test boundary extensions | `tests/helpers/studio.cjs` |
| Percussion model/scheduler, synthesis cleanup, UI/lifecycle and cross-instrument tests | `tests/percussion-core.test.cjs`, `tests/percussion-audio.test.cjs`, `tests/tamborin-ui.test.cjs`, `tests/tamborin-lifecycle.test.cjs`, `tests/tamborin-integration.test.cjs` |
| Browser continuation harness, syntax checked only | `tests/browser-tamborin.cjs` |
| Active context/contracts | `AGENTS.md`, `README.md`, `DESIGN.md`, `UX-CONTRACT.md`, `docs/SOR.md`, `docs/BRANCH_POLICY.md` |
| Candidate provenance, no version increment | `CHANGELOG.md`, `release.json` |
| Plan and verification evidence | `docs/superpowers/plans/2026-11-04-instrument-tamborin.md`, this handoff, `node-tests.txt`, `source-hashes.json` |

The recorder files, screenshots and handoff inherited from ui remain in history unchanged. They demonstrate ui's earlier candidate, **not Tamborin verification**. release.json scopes those earlier browser results to their original source hash.

## Verification actually performed

- Baseline `node --test tests/*.test.cjs`:64/64 passed at initial ui46338fe.
- New percussion tests first failed against missing features; scheduler/timing, source cleanup, pending Henti and Reset/audition regressions were observed failing before their fixes.
- Final `node --test tests/*.test.cjs`: **121 passed,0 failed**, on the exact hash above. Full output: `node-tests.txt`. Includes current ui recorder regressions and six additional recorder/Tamborin/game integration checks.
- Independent final review found no remaining material integration defect. Pitched `xylo-core` and `xylo-game-core` blocks were compared byte-for-byte to integrated ui.
- HTML check: no duplicate IDs, missing label/ARIA references or nested buttons. No external script/runtime asset dependency introduced.
- `node --check tests/browser-tamborin.cjs`: passed. The browser harness itself was **not run**.
- `git diff --check`: passed before implementation commit.
- Source/test SHA-256 values: `source-hashes.json`.

Host fixtures simulate DOM/audio boundaries and time. They establish state transitions, data identity, event isolation, timing math and cancellation behavior. They do not establish visual geometry, actual audio output, speaker quality, physical touch, microphone behavior or acoustic latency.

## Browser/screenshot limitation and continuation

The connected browser and cloud browser could not reach the localhost preview started inside the isolated execution environment (`ERR_CONNECTION_REFUSED`). Cloud browser file navigation is disallowed by its URL policy. No browser-rendered Tamborin desktop/small-screen screenshot was obtained, and no speaker listening was performed. Existing ui screenshots are intentionally not relabelled as Tamborin evidence.

A repository-owned test-only harness is ready for a browser-capable environment:

```sh
node --test tests/*.test.cjs
node tests/browser-tamborin.cjs
```

Install/provide Playwright and a supported Chromium only in the test environment; production stays one downloadable HTML. Optional `BROWSER_EXECUTABLE` chooses a test browser, and `BROWSER_OUTPUT` chooses a separate evidence folder. The default screenshot folder is `docs/handoffs/instrument-tamborin/screenshots` and will be created only when that harness actually runs.

The harness serves the tested HTML on temporary localhost HTTP, exercises actual mouse/keyboard/Web Audio signal/recording/replay/tempo/metronome/JSON/CSV/navigation, captures desktop1440×1000 and phone390×844 screenshots, and checks touch emulation, reduced motion and page errors. It does not request microphone access. Record its actual source hash/results and listen on real classroom desktop/phone speakers before release acceptance. Safari/Firefox and assistive-technology checks remain unverified.

## Reusable Kompang component contract

Everything below is an identifiable inline block inside the same `index.html`; there are no network imports.

| Block / API | Contract |
| --- | --- |
| `percussion-core` / `PercussionCore.INSTRUMENTS` | Unpitched registry. Tamborin currently provides actions `tap` and `shake`. Add a real Kompang identity/action definition only when implementing it; do not add it to the pitched registry. |
| `createTake(instrument,bpm)` | Returns schema`e-instru-percussion-take/v1`, instrument,bpm,capture_bpm,title,sound_source,events and immutable raw_capture. |
| `capture(take,action,performanceStampMs)` | Mutates the active take with one manual event. First timestamp becomes raw_ms0; stable event id links editable action/at_ms to raw original action/raw_ms.512 events and180000ms input limit. |
| `setTempo(take,bpm)` / `editEvent(take,index,action,atMs)` | Return a new validated take. Editable timing/action can change; original evidence stays fixed. BPM40–200. |
| `importTake(text)` / `csv(take)` | Strict identity/schema/range validation; JSON preserves evidence, CSV exposes edited and original data separately. Import strips unknown properties. |
| `createScheduler({now,schedule,setTimer,clearTimer,onEnd})` | All scheduler times are milliseconds. `now` uses audio.currentTime×1000. `schedule(event,absoluteMs)` returns a cancellation function; set its optional`endAtMs` to release completed handles during infinite metronome sessions. |
| Scheduler`start({events,durationMs,bpm,metronome,leadMs})` |100ms lookahead/25ms polling; finite playback or Infinity metronome. Metronome emits separate action`metronome` plus beat/accent. Input onsets≤180000; finite transport≤181000 permits the sound tail. |
| Scheduler`stop()` /`running` /`elapsedMs` | Cancels timers/queued voices, invalidates stale callbacks and exposes transport state. Completion invokes onEnd once. |
| `percussion-audio` /`PercussionAudio.tamborin(context,action,atSeconds,accent)` | Instrument-specific synthetic texture adapter. Returns`{cancel,endAt}` in AudioContext seconds. Kompang supplies its own adapter with that shape. |
| `percussion-ui` /`PercussionStudio.createStudio(config)` | Reusable Main/Rakam/Henti, metronome, raw capture, trace rendering/audition, action/onset editor, title, independent storage/import/export and lifecycle cleanup. Returns`{enter(),leave()}`. |
| Studio config |`{instrument,name,labels,descriptions,voice,patternEvents,prefix='perc',defaultBpm=80,shortcuts}`.`prefix` maps the current percSurface/percTap/etc view IDs to another instrument's matching markup. `voice` follows the audio adapter shape;`patternEvents({bpm,kind})` returns`{events,durationMs}`. |
| `tamborin-ui` | Thin Tamborin configuration: labels, synthesis, four example patterns and shortcuts. This is the instrument-specific template for a future Kompang configuration. |
| `instrument-navigation` | Thin adapter to ui's actual chooser and Game bridge. Enter suspends the pitched owner; leave cancels percussion while preserving its take. Add the Kompang view/card here only after its controller is real. |

## Decisions for audit

- Kept playback tempo changes as an explicit stop/restart in percussion, while the existing pitched owner retains live retiming. This avoids rescheduling raw user evidence and keeps the new scheduler interface simple.
- Kept a separate percussion schema and storage key instead of extending MIDI fields with fake pitches. Existing pitched imports therefore remain unchanged; use the Tamborin import control for percussion JSON.
- Reset always restores capture BPM. For a valid near180s edit that cannot be expanded at the original tempo, preserve the edited onset values rather than failing Reset or deleting the edit.
- Kompang is visible but disabled. It is not advertised as playable until implemented.
