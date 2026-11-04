# Agent instructions — e-Instru Studio

This is a self-contained digital music studio and browser game. Read docs/SOR.md, docs/BRANCH_POLICY.md, README.md, VERSION and the actual source before changes.

- Chat names start e-instru studio - <branch>. Exact branches: main, share, audit, architecture, tutorial, music, gameplay, ui. Ijamm additionally authorized instrument-tamborin on 4 November 2026, based on ui, with pushes restricted to that worker branch.
- Main is the complete owner source. Audit integrates and pushes main when Ijamm requests it. Workers push their own branch only, with base/head hashes and actual test evidence.
- Share is a minimal downloadable distribution snapshot. Tutorial and share update only when the user requests; never merge share back into main.
- Music owns arrangements/data/timing; gameplay owns game rules; ui owns interactions/layout; architecture owns the SOR and structure. index.html is a shared file: coordinate small changes through audit and compile/run the combined source.
- Preserve 10 songs, short/long variants, score timing, pitches, local recordings and gameplay behavior unless requested otherwise. Digital exports are JSON and CSV only. No external runtime repository or backend is required.
- Microphone analysis is opt-in and local. Do not upload/persist raw audio. Local export passwords are a UI convenience, not server authorization.
- Use node --test tests/*.test.cjs. Host DOM/audio fixtures are not measurements of a real browser, microphone or speaker. Record the actual source hash and limits.
- Version separately using VERSION in vX.XX.X form; synchronize visible/meta version, changelog and release.json. No force push, global Git configuration, secrets, caches or generated personal logs.
- The approved 2 November 2026 migration may retire old branch names only after their commits are preserved in main ancestry.

- Ijamm additionally authorized instrument-kompang on 4 November 2026, based on the completed/pushed instrument-tamborin. The latest direct request authorizes integrating this tested digital module into this repository's main. This task exception does not authorize pushes to ui, instrument-tamborin, share or tutorial. Preserve accepted VERSION v1.04.0 unless a separate release version is requested.

- The follow-up school/pancaragam instrument work is isolated on instrument-pancaragam from main SHA 3a2bc106c8885b81334e1dd34ce5810f05dfad8e. Preserve concurrent ui/layout changes when integrating the four new percussion instruments. Do not write another worker's branch or update share/tutorial snapshots.

- The latest overall UI/UX request uses branch ui, based on main c0ba48bb9c35244354779cc227ecb7c999bff5dd so all eight instruments are retained. Six isolated workers contribute chooser, pitched, percussion, game, accessibility and QA changes. Publish this task to ui only; the earlier direct-main exceptions describe their historical tasks. Preserve v1.04.0 until a separate accepted release is requested.

- The subsequent Studio Pro request (4 November 2026) explicitly authorizes six simultaneous module workers on ui from 27df2fa; follow-up adds accessible color-vision display modes alongside light/dark themes. Sources in studio-pro/ are embedded by node scripts/embed-studio-pro.cjs; run --check and the complete Node suite before push. Preserve legacy takes/evidence, eight instruments, ten songs, JSON/CSV contract and accepted v1.04.0. Push ui only; main/Pages/share/tutorial/auth branches remain outside this task.
