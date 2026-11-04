# Supabase browser SDK

`supabase-2.118.0.js` is the unmodified UMD bundle from the official npm package
`@supabase/supabase-js@2.118.0`, licensed under MIT (see LICENSE).

SHA-256: `ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3`.

It is embedded by `node scripts/build-auth.mjs`. The downloadable studio remains
self-contained; account requests go only to the configured Supabase project.
No SDK, font or other library is loaded from a CDN at runtime.
