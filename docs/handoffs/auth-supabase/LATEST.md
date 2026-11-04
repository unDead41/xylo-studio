# Optional Supabase accounts and all Auth emails

Date: 4 November 2026. Work branch: `auth-supabase`.
Base: `origin/main` `c0ba48bb9c35244354779cc227ecb7c999bff5dd`.
Candidate index SHA-256: `0f559ac5739f5de9a53c8efee03cbf8fb1af99e74833d916d7819eef85c52ad7`.
Accepted VERSION remains `v1.04.0`; release.json still identifies the accepted main release. This candidate is not a new release or a main/Pages publication.

## Implemented

Optional account entry, signup, password signin, signout, resend confirmation, magic link, recovery, password/email change and reauthentication code UI. Invitation/recovery callbacks open the set-password form. Account operations use a dedicated public configuration, PKCE and one callback owner; callback credentials/errors are scrubbed from history. Friendly BM errors avoid identifying whether a signup/reset target exists. Password updates forward the current password outside verified recovery; host enforcement is enabled.

Editable account assets live under `assets/auth`. `scripts/build-auth.mjs` embeds CSS, configuration, the pinned official Supabase 2.118.0 UMD bundle, service, UI and bootstrap into index.html. The standalone HTML embeds the full vendor MIT notice. No runtime CDN is used. The SDK's multiline strings contain meaningful trailing whitespace; .gitattributes preserves them in vendor/index while other whitespace checks remain enabled.

Opening Account stops capture/playback with takes preserved and pauses Game. Its epoch invalidates delayed audio start/resume so Game cannot run behind the modal. All eight instruments, ten songs, original raw timestamps, local workspaces, exports and Game remain available as guests. Microphone audio remains local. Profiles are provisioned only after auth initialization; stale users cannot initiate a delayed insert, and transient errors allow a later auth-event retry after 60 seconds.

## Hosted changes completed

- New project: [e-Instru Studio](https://supabase.com/dashboard/project/ahvyieyojqciohdogsqc), organization Norhizam, region `ap-southeast-1`. Other application databases were not modified.
- Migration `20261104052615_studio_profiles.sql` is applied. Its local file was created using the CLI and aligned to the hosted migration version. `profiles` contains only id, bounded display name/preferences and server-created timestamp. Credentials remain in Supabase Auth.
- Own-row SELECT/INSERT/UPDATE RLS; anon has no access; authenticated clients cannot update id/created_at or delete rows. The frontend SELECTs then INSERTs, rather than UPSERTing immutable id.
- Site URL and six exact redirect URLs configured, including four `auth_flow` variants. No wildcard cross-site redirect.
- Email provider and new signup enabled, confirmation required, secure email/password change enabled, current password required, minimum password length 8. Phone/OAuth/anonymous signup were not enabled.
- All seven security-email notification switches saved ON. These switches do not add phone/OAuth/MFA management UI.

## Email blocker

All 13 branded BM templates, subjects and exact Management API mappings are prepared under `supabase/templates`; the local generator validates 33 fields, including seven true notification flags. **Custom SMTP is not configured.** The new Free project's Dashboard explicitly blocks custom template editing until SMTP is set up, and its default sender restricts public delivery. The hosted templates therefore remain Supabase defaults. No real signup/recovery/notification mail was sent or inbox delivery verified.

Continue by selecting a provider, configuring its verified sender/host/port/username and secret directly in the project SMTP settings, then applying all 13 prepared templates. Do not put SMTP passwords, management tokens or service-role keys in chat, HTML or Git. Complete real email round trips after the candidate is promoted to the callback host. Use [AUTH_EMAILS.md](../../AUTH_EMAILS.md) and the template manifest for exact subjects/variables.

## Verification

- `node --test tests/*.test.cjs tests/auth/*.test.cjs`: **255 passed, 0 failed** (180 existing + 75 account/integration cases). Tests execute the actual shipped inline source, with fake Auth/DOM/audio boundaries clearly separated from live evidence. Includes a fault-checked regression for deferred Game resume behind Account.
- `node scripts/build-auth.mjs --check`, email-template validation, all 16 inline script compilation checks and Git whitespace checks passed.
- Live database rollback-only RLS tests passed: own reads/writes accepted, cross-user writes/reads excluded, immutable columns/deletion/anon denied, length/type/size constraints enforced. Fixtures were rolled back; hosted users/profiles both remain zero.
- Live security advisor returned zero lints. Migration history and grants/RLS were read back.
- Cloud Chromium: native modal initial focus, empty-form errors without network submission, forward Tab trap, Escape/focus restoration, signup form, and 320/390px framed layout. Actual document widths 310/380px including native scrollbars, scrollWidth equal to clientWidth; modal fits inside each. Desktop visual check passed.
- All 13 template source checks passed. Email visual catalogue could not be loaded through the preview route; no email-client rendering or delivery is claimed. No physical speaker/microphone/acoustic measurement.

Evidence: [node tests](node-tests.txt), [verification.json](verification.json), and [saved notification settings](screenshots/email-settings.png). Six subagents were used; none spawned additional agents. No main, share, tutorial or other worker branch was pushed by this task.
