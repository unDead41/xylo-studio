# Main publication — Studio Pro

4 November 2026. Ijamm explicitly requested pushing the completed Studio Pro work to the branch used by GitHub Pages and verifying that all changes appear on the public website. This supersedes the historical ui-only restrictions for this publication. Accepted VERSION remains **v1.04.0**.

## Source and integration

- Main base: `c0ba48bb9c35244354779cc227ecb7c999bff5dd`.
- Integrated ui head: `5701bec6c62fc0b314a62d4c0150004ff18a1ba9`.
- Main is an ancestor of that ui head. Publish a descendant carrying the complete reviewed ui tree and these documentation/metadata updates; preserve all existing main and ui history. Use an expected-head check and no force.
- Runtime index.html SHA-256: `91ad5adacd358703d8024efc79104f253fa35eb44c98308ce5e931a9229ae5c5`.
- The runtime is byte-identical to the reviewed ui source. Theme modules remain unchanged. Eight instruments, ten songs, original recordings/evidence, BM/English and JSON/CSV remain available.
- Existing GitHub Pages publishing target is main, root directory; no new hosting service or audience change is required. Share, tutorial and other branch refs are excluded.

## Included behavior

Studio Pro provides an eight-track arrangement/editor, bar copy/paste/replace/clear with Undo, synchronized transport/loop/metronome, track/master Mixer with pan/mute/solo/Reverb/Delay, local projects/autosave/import/export and three original playable four-bar examples. This publication also brings the previously reviewed shared UI and BM/English changes into main. Advanced tools remain within the established three-tab/disclosure layout.

Implementation, exact source hashes and browser observations: [Studio Pro continuation](../../handoffs/ui/STUDIO_PRO_RESUME.md). Its 24 BM/English panel/width checks and actual-module storage/audio/mixer regressions apply to the identical runtime.

## Verification

- `node scripts/embed-studio-pro.cjs --check`: required to pass against the final tracked-tree archive.
- `node --test tests/*.test.cjs`: **375 passed, 0 failed**, from that archive before updating main.
- `git diff --check`: passes. Core source is tracked and no untracked local runtime source is required.
- The ui push workflow for the integrated source completed successfully: [Digital studio run 41793602698](https://github.com/unDead41/xylo-studio/actions/runs/41793602698).
- Generic strict static findings remain the previously reviewed native-listener/global-resize scanner limitations, not a passing strict audit; see the continuation evidence.

After the main ref update, verify both its GitHub workflow/deployment outcome and the public page's exact index bytes and Studio Pro controls before reporting that the changes are live. Those post-update outcomes are supplied in the delivery response, since their commit/workflow identifiers do not exist while this report is being created.

No physical speaker/latency, microphone or participant accessibility measurement is implied. The earlier recorder integration audit is retained in [RECORDER_INTEGRATION_2026-11-04.md](RECORDER_INTEGRATION_2026-11-04.md).
