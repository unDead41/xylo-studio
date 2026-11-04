# Agent instructions — e-Instru Studio

This is a self-contained digital music studio and browser game. Read docs/SOR.md, docs/BRANCH_POLICY.md, README.md, VERSION and the actual source before changes.

- Chat names start e-instru studio - <branch>. Exact branches: main, share, audit, architecture, tutorial, music, gameplay, ui. Ijamm additionally authorized instrument-tamborin on 4 November 2026, based on ui, with pushes restricted to that worker branch.
- Main is the complete owner source. Audit integrates and pushes main when Ijamm requests it. Workers push their own branch only, with base/head hashes and actual test evidence.
- Share is a minimal downloadable distribution snapshot. Tutorial and share update only when the user requests; never merge share back into main.
- Music owns arrangements/data/timing; gameplay owns game rules; ui owns interactions/layout; architecture owns the SOR and structure. index.html is a shared file: coordinate small changes through audit and compile/run the combined source.
- Preserve 10 songs, short/long variants, score timing, pitches, local recordings and gameplay behavior unless requested otherwise. Digital exports are JSON and CSV only. Guest Studio and Game require no backend connection; optional account operations use the dedicated Supabase project.
- Microphone analysis is opt-in and local. Do not upload/persist raw audio. Local export passwords are a UI convenience, not server authorization.
- Use node --test tests/*.test.cjs. Host DOM/audio fixtures are not measurements of a real browser, microphone or speaker. Record the actual source hash and limits.
- Version separately using VERSION in vX.XX.X form; synchronize visible/meta version, changelog and release.json. No force push, global Git configuration, secrets, caches or generated personal logs.
- The approved 2 November 2026 migration may retire old branch names only after their commits are preserved in main ancestry.

- Ijamm additionally authorized instrument-kompang on 4 November 2026, based on the completed/pushed instrument-tamborin. That instrument task authorized integrating its tested digital module into this repository's main. The historical exception does not authorize a later feature's main push or pushes to ui, instrument-tamborin, share or tutorial. Preserve accepted VERSION v1.04.0 unless a separate release version is requested.

- The follow-up school/pancaragam instrument work is isolated on instrument-pancaragam from main SHA 3a2bc106c8885b81334e1dd34ce5810f05dfad8e. Preserve concurrent ui/layout changes when integrating the four new percussion instruments. Do not write another worker's branch or update share/tutorial snapshots.

- The Supabase account/email task is isolated on `auth-supabase` from main SHA `c0ba48bb9c35244354779cc227ecb7c999bff5dd`. The task exception permits work on that branch only; it does not authorize pushing main or other workers' branches. Main promotion needs a new direct request. Keep VERSION `v1.04.0`, share/tutorial snapshots and Pages settings unchanged.
- Accounts are optional. Preserve guest/offline access, all eight instruments, ten songs, Game and existing local recordings. Authentication never uploads or clears local takes or raw audio. Database scope is user-owned profiles under RLS, using the dedicated project `ahvyieyojqciohdogsqc` (Singapore, organization Norhizam).
- Bundle pinned vendored `supabase-js` `2.118.0` inline in the self-contained HTML, preserving provenance/license; do not introduce a runtime CDN. Account operations need network/HTTPS and use the allowed hosted callback root `https://undead41.github.io/xylo-studio/`. Browser configuration contains public project values only, never service-role, management or SMTP secrets.
- Maintain all 13 Malay email template sources and distinguish source validation from hosted activation and live delivery. Custom SMTP is not yet supplied for this new project's public delivery/custom templates. Do not claim delivered email from a successful API request or mocked test. Keep profile/session tests separate from raw audio and recording behavior.

- The follow-up Google/Gmail and phone-provider work is isolated on `auth-providers`, using the actual concurrent `auth-supabase` source in its own checkout. Only this worker branch may be pushed by this task. Keep main, share, tutorial and other worker branches untouched. All three methods use the same dedicated project and SDK client; provider availability must be read from its public Auth settings. Keep callback exchange in the base service and prevent overlapping email/OAuth/OTP operations. Provider credentials belong in the hosted dashboard, never the repository.
- Validate the complete auth changes with `node --test tests/*.test.cjs tests/auth/*.test.cjs tests/auth-providers/*.test.cjs` and `node scripts/build-auth.mjs --check`. Provider host tests do not establish real OAuth, inbox or SMS delivery.
