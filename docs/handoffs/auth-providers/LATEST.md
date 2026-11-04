# Google/Gmail, email and phone authentication

Date: 4 November 2026 (Malaysia). Worker branch: `auth-providers`. Main base: `c0ba48bb9c35244354779cc227ecb7c999bff5dd`. VERSION remains `v1.04.0`; no main, share, tutorial or Pages setting change is authorized by this task.

## Implemented source

The existing native account dialog now includes Google OAuth and SMS OTP beside email/password signup, confirmation, sign-in, recovery, password/email change and logout. All methods reuse one pinned Supabase SDK client and the existing base callback/session owner. Guest instruments, Game, local takes and raw audio remain independent of accounts.

`assets/auth/provider-service.js` owns public provider discovery, safe errors, same-origin Google return URLs, Malaysia/E.164 phone normalization, six-digit OTP and resend cooldown. An underlying SDK request keeps an independent `busy` lock until its promise settles, including after dialog cancellation. A successfully delivered cancelled SMS still starts the cooldown without restoring a dismissed challenge. `provider-ui.js` owns the accessible Google/phone controls, disclosure, status, input cleanup and cooldown display. Base bootstrap/UI integration prevents overlapping email and provider requests, renders phone identities, and restores Google controls on persisted browser Back.

The email source was imported from the actual concurrent `auth-supabase` checkout without modifying it. `base-auth-source.json` records that initial snapshot. Later fixes for profile retry/duplicate insert, game resume cancellation, native email whitespace handling and the full inline SDK license notice were incorporated. This branch is a complete integration candidate; its initial email snapshot is not a substitute for reviewing any later `auth-supabase` commits when main promotion is requested.

Source changes are grouped under `assets/auth`, `scripts/build-auth.mjs`, the generated inline blocks in `index.html`, `tests/auth`, `tests/auth-providers`, `supabase` and the relevant project contracts. The application still needs no runtime CDN or build to open its shipped HTML. Developer package/lock files pin `@supabase/supabase-js` 2.118.0; the untouched vendored file checksum and full MIT notice are verified during embedding.

## Verification

- `npm test`: **281/281 passed**, including the existing 180 instrument/Game tests, base account tests, 20 provider service tests, six provider/bootstrap integration tests and the provider UI host scenario (14 assertions groups).
- `node scripts/build-auth.mjs --check`: embedded assets match reviewed source.
- `node supabase/templates/build-config.mjs --check`: 13 Malay templates, seven notification flags and 33 Auth fields validate.
- All 18 inline scripts compile. Authored HTML/source whitespace is clean; original whitespace inside vendored SDK template literals is preserved.
- Read-only real `GET /auth/v1/settings` succeeds using the dedicated project's publishable key. `provider-status.json` records safe flags and explicitly marks delivery/sign-in/E2E untested. No email, SMS, OAuth authorization or test user was submitted.
- Supabase `public.profiles` has RLS enabled; the security advisor returned no lints. No database/schema mutation was performed by this provider task.

Current source identity is recorded in `source-hashes.json`; complete host output is in `node-tests.txt`. Host DOM/service/audio doubles are not a physical browser, speaker or phone. Both connected and cloud browsers could not reach the primary-runtime localhost preview; no new auth layout, screen-reader, Google, inbox or SMS end-to-end claim is made. Historical browser artifacts in this repository belong to their recorded source versions.

## Hosted configuration and required handoff

Only the dedicated **e-Instru Studio** project `ahvyieyojqciohdogsqc` (Singapore) was inspected. Existing GeoDecoder and Mathematics Slayer projects were not changed. Site URL is `https://undead41.github.io/xylo-studio/`; the exact root and `index.html` are allowed returns. Dashboard observations: email and email confirmation enabled; Google credentials blank; Phone disabled with blank Twilio fields, six-digit/60-second OTP; custom SMTP disabled.

The code presents unavailable methods accurately. Full activation still needs the owner to enter and submit these values directly in the correct hosted dashboards:

| Method | Missing setup |
| --- | --- |
| Google/Gmail | Google Web OAuth Client ID and Client Secret; callback `https://ahvyieyojqciohdogsqc.supabase.co/auth/v1/callback` |
| Public email | Custom SMTP credentials, verified sender and relevant provider/domain setup |
| Phone | SMS-provider credentials and sender/routing setup; any provider charges need separate approval |

No credentials belong in Git or chat. The default Supabase SMTP restrictions do not support unrestricted public delivery. Complete setup and then test sign-in, confirmation/recovery and wrong/expired/resend OTP cases using authorized real accounts. See `docs/AUTH-PROVIDERS.md` for exact settings, identity-linking limits and the read-only readiness command. Google/email with the same verified email can link; phone-only logins are not automatically merged.
