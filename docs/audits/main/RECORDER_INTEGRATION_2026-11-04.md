# Main integration audit — v1.04.0

4 November 2026. Ijamm explicitly instructed direct promotion to main and requested two subagents. This supersedes the earlier ui-only/no-main restriction for this integration. Share and tutorial remain unchanged.

## Source and scope

- Main base SHA: 46338fe646408c758232eec9ba7b5f876ff1f9e4.
- Integrated ui SHA: 115e54d87b10804ae6f94ff0efe895099d035e20.
- Worktree: /workspace/scratch/977575ac93c3/e-instru-main; separate from the preserved ui workspace.
- Merge preserves both main and ui ancestry; the combined source was checked before ref update. Latest branch inspection found no additional main/index changes to integrate.
- Final tested index.html SHA-256: 45b1ddb7677e75923680f0cc11095c6c7e588651ae068496b85d129fcd7e2e89.
- Browser test SHA-256: 3186ee5040b782913c7c4ba5f54f3275e4e87bfd9c779b61dc77f89d9836ef1d.
- Accepted release version: v1.04.0, synchronized across VERSION, application meta/visible/accessible version, README, changelog and release.json.
- The release commit is the merge commit carrying this report; its exact SHA is supplied in the delivery response and can be resolved with git rev-parse origin/main. The source hashes above identify the verified bytes without a self-referential commit hash.

The integration includes the complete e-Instru Studio branding, chooser and soprano recorder from ui. Runtime remains one self-contained HTML file; no backend, external assets or dependency is introduced. Original schema/storage/API names remain compatibility identifiers. Two audited defects were fixed before release:

1. **P1, workspace data loss on reload.** An empty active recorder take was skipped at startup, causing fallback xylophone data to overwrite a saved xylophone workspace. Valid empty takes now import normally; invalid/missing active data adopts a separately valid stored workspace instead of overwriting it.
2. **P2, long audition cancellation.** Recorder timeline auditions retained idle transport state, leaving Stop disabled and their sound active when recording/playback began. Active idle recorder voices now enable Stop; transitions and replacement previews cancel prior voices/pending epochs. Cleanup refreshes controls when the audition finishes.

Five regression tests reproduced these failures before the fixes and passed afterward. Shared capture/edit/export/timeline and game behavior remain intact; source review directly compared all 60 xylophone arrangements and 180 difficulty charts with the original main and found their pitch/timing/chart data unchanged.

## Independent reviews and verification

Exactly two subagents were used; both remained read-only:

- Code/release reviewer found P1/P2, independently reviewed their fixes and reported no remaining blockers. Recorder suite15/15 plus additional preview race/held-key cancellation checks passed.
- Independent verifier reran the full candidate: **79 Node tests passed, 0 failed** and **17 Chromium workflow groups passed**, 0 recorded page errors. It verified the final product/test hashes and merge ancestry. Source/test files remained unchanged during validation.

Commands and evidence:

- node --test tests/*.test.cjs — 79/79 PASS; node-tests.txt.
- BROWSER_OUTPUT set to an isolated scratch output, BROWSER_EXECUTABLE set to the local Chromium executable, then node tests/browser-recorder.cjs — Chromium133.0.6943.0; browser-results.json.
- Browser coverage includes manual mouse/key/touch sustain/release, raw duration evidence, edits, tempo/metronome, JSON/CSV download, per-instrument persistence/reload, legacy v1 data, out-of-range notes, extended pitches, game return, cancellation/blur, reduced motion, offline file use, plus the new empty/malformed active workspace and long-audition regressions.
- One initial browser attempt timed out taking the desktop screenshot during a host stall, after eight functional groups. An exact-command retry completed all17 groups without code changes. No application assertion failed in the timed-out attempt.
- npx --yes -p @google/design.md designmd lint DESIGN.md — 0 errors, 0 warnings.
- Version/metadata/changelog/README synchronization assertions — PASS.
- git diff --check — PASS.
- Static audit rerun: exit1, 36 actionless-button scanner flags, 0 unresolved ownership findings. Existing/new handlers are bound using addEventListener, which that static scanner does not infer. The findings are reviewed false positives; this is not reported as a passing static audit. See ../../handoffs/ui/STATIC_REVIEW.md and current static-audit.json.
- Actual final-source screenshots: screenshots/recorder-desktop.png (1440×1000), screenshots/recorder-phone.png (390×844). Chooser/xylophone historical screenshots remain in the ui handoff.

## Delivery and continuation

Push only the authorized main ref with an expected-head check and no force. ui and all other branch refs remain intact. Existing main/root Pages configuration automatically builds from main; confirm the GitHub Actions result and live page after the update before claiming deployment. The delivery response records those outcomes because they happen after this commit is created. No share/tutorial snapshot or repository URL is changed.

Other instrument workers should incorporate the new main initialization and audition fixes before their later integration because index.html is shared. Do not rebuild or replace the recorder implementation from older snapshots.

Web Audio signal checks are not speaker/acoustic tuning, physical phone testing, microphone validation, Safari/Firefox or assistive-technology certification. Recorder microphone detection remains deliberately unsupported; missing fingering rows and score range limits remain explicit in the interface.
