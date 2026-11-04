# Setup akaun e-Instru Studio

Panduan projek Supabase **e-Instru Studio** sahaja: `ahvyieyojqciohdogsqc`, rantau `ap-southeast-1` (Singapore). Jangan ubah projek **GeoDecoder**.

## URL yang tepat

| Tetapan | Nilai |
| --- | --- |
| Aplikasi / Supabase Site URL | `https://undead41.github.io/xylo-studio/` |
| Supabase Redirect URLs: root | `https://undead41.github.io/xylo-studio/` |
| Supabase Redirect URLs: HTML | `https://undead41.github.io/xylo-studio/index.html` |
| Google Authorized JavaScript origins | `https://undead41.github.io` |
| Google Authorized redirect URIs | `https://ahvyieyojqciohdogsqc.supabase.co/auth/v1/callback` |
| Supabase API URL | `https://ahvyieyojqciohdogsqc.supabase.co` |

Origin Google tiada path `/xylo-studio/`. Callback Google ialah URL Supabase di atas; URL pulang ke aplikasi dikawal melalui Site URL/Redirect URLs. Semak di [URL Configuration projek ini](https://supabase.com/dashboard/project/ahvyieyojqciohdogsqc/auth/url-configuration).

## Status dan fail contoh

Semakan dashboard dan public GET pada 4 November 2026:

| Bahagian | Status disahkan |
| --- | --- |
| Site URL / Redirect URLs | URL produksi dan kedua-dua redirect dalam jadual di atas sudah disimpan |
| Email / pendaftaran | Email dan signups hidup; pengesahan email diwajibkan |
| Google | Provider mati; Client ID dan Client Secret kosong |
| Phone | Provider mati; pengesahan telefon diwajibkan; Twilio SID/token/Message Service SID kosong |
| Phone OTP | Panjang 6 digit; tamat tempoh 60 saat |
| Custom SMTP | Toggle **OFF**; penghantaran email awam belum siap |

Kekalkan Google dan Phone dimatikan sehingga credentials lengkap. Provider email yang hidup tidak mengesahkan penghantaran email berfungsi.

[`provider-setup.example.json`](../supabase/provider-setup.example.json) ialah **cadangan field Management API**, bukan eksport tetapan semasa atau arahan automatik. Semua `<...>` ialah placeholder. Jangan hantar keseluruhan fail sebagai PATCH: SMTP ber-placeholder juga tidak sah. Masukkan nilai sebenar terus dalam dashboard atau salinan persendirian di luar repo; hidupkan provider hanya selepas setup lengkap. Fail contoh sengaja menetapkan `external_google_enabled` dan `external_phone_enabled` kepada `false`.

Hanya URL dan publishable key Supabase boleh berada dalam frontend. Client Secret Google, kata laluan SMTP, token SMS, secret key dan `service_role` tidak boleh dimasukkan ke HTML, repo atau fail contoh ini.

## Google / Gmail

1. Buka [Google Auth Platform](https://console.cloud.google.com/auth/overview). Sediakan Branding dan Audience untuk e-Instru Studio; **External** membenarkan akaun Google di luar organisasi, manakala **Internal** terhad kepada organisasi Google Cloud berkenaan.
2. Dalam **Data Access**, gunakan scope asas `openid`, `https://www.googleapis.com/auth/userinfo.email` dan `https://www.googleapis.com/auth/userinfo.profile`. Untuk scope asas ini sahaja, pengecualian Google terpakai walaupun **Testing**: pengguna tidak perlu disenaraikan sebagai test user, tiada amaran Testing dan kebenaran tidak tamat selepas 7 hari. Scope tambahan membatalkan pengecualian ini; ikuti syarat Audience/pengesahan Google yang berkaitan. Polisi akaun/Workspace masih boleh menyekat akses. Log masuk ini tidak memerlukan akses peti masuk Gmail.
3. Dalam **Clients**, cipta OAuth client jenis **Web application**. Salin origin dan redirect URI tepat daripada jadual di atas.
4. Dalam [Authentication > Sign In / Providers > Google](https://supabase.com/dashboard/project/ahvyieyojqciohdogsqc/auth/providers?provider=Google), masukkan **Client IDs** dan **Client Secret** yang Google keluarkan. Simpan dan hidupkan Google setelah kedua-duanya lengkap. Kekalkan semakan nonce untuk aliran web biasa.

Aplikasi memulakan aliran dengan `signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://undead41.github.io/xylo-studio/' } })`. Setup Google tidak menyiapkan SMTP email atau penghantaran SMS.

## Email dan kata laluan

1. Dalam [Sign In / Providers > Email](https://supabase.com/dashboard/project/ahvyieyojqciohdogsqc/auth/providers), hidupkan Email dan kekalkan **Confirm email**. Pengguna baharu mendaftar, mengesahkan pautan email, kemudian log masuk menggunakan email/kata laluan. Pemulihan kata laluan dan hantar semula pengesahan turut memerlukan penghantaran email berfungsi.
2. Untuk pengguna awam, sediakan **custom SMTP** di [Authentication > Email](https://supabase.com/dashboard/project/ahvyieyojqciohdogsqc/auth/smtp). Masukkan sender email yang disahkan oleh penyedia, sender name, host, port, username dan password SMTP. Ikuti pengesahan domain/DNS penyedia dan semak had penghantaran projek.
3. SMTP bawaan Supabase hanya menghantar kepada alamat ahli pasukan organisasi, dengan had semasa **2 email sejam** untuk seluruh projek. Alamat lain boleh menerima `email_address_not_authorized`. Oleh itu, email/password awam, pengesahan dan reset password belum dianggap siap sehingga SMTP sebenar diuji. Jangan matikan Confirm email untuk memintas sekatan ini.

**Pilihan tambahan:** magic link dan email OTP menggunakan `signInWithOtp({ email, options: { emailRedirectTo: 'https://undead41.github.io/xylo-studio/' } })`. Template **Magic Link** menentukan mesej: `{{ .ConfirmationURL }}` memberi pautan, manakala `{{ .Token }}` memberi kod. Jika kedua-dua pilihan UI hendak digunakan, template perlu menyediakan pautan dan kod. Sahkan kod dengan `verifyOtp({ email, token, type: 'email' })`.

## Telefon: SMS OTP

1. Pilih penyedia SMS. Supabase menyokong Twilio/Twilio Verify, MessageBird, Vonage dan Textlocal (sokongan komuniti). Contoh JSON menggunakan **Twilio Messaging**; ia bukan keputusan pembelian.
2. Untuk contoh Twilio, masukkan **Account SID**, **Auth Token** dan **Message Service SID** daripada akaun Twilio sendiri ke [Sign In / Providers > Phone](https://supabase.com/dashboard/project/ahvyieyojqciohdogsqc/auth/providers). Pastikan sender/routing dibenarkan menghantar ke Malaysia. Jika memilih **Twilio Verify**, gunakan Verify Service SID dan field provider Verify yang sepadan; jangan campurkan konfigurasi kedua-duanya.
3. Kekalkan pengesahan telefon. Semakan dashboard projek ini menunjukkan **6 digit** dan **SMS OTP expiry 60 saat**; laraskan expiry dalam dashboard jika perlu sebelum memaklumkan tempoh kepada pengguna. Semak rate limits dan CAPTCHA sebelum dibuka kepada awam. Hidupkan Phone hanya selepas credentials dan penghantaran siap.
4. Masukkan nombor dalam E.164: `012-345 6789` menjadi `+60123456789`. Kod dihantar melalui `signInWithOtp({ phone, options: { channel: 'sms' } })`, kemudian disahkan melalui `verifyOtp({ phone, token, type: 'sms' })`. Gunakan nombor ternormal yang sama untuk kedua-dua langkah. Hantar semula login OTP melalui `signInWithOtp` selepas cooldown yang dibenarkan server; UI tidak boleh menganggap permintaan kod sudah menghasilkan sesi log masuk.

Untuk Twilio ke Malaysia, template SMS perlu menyertakan `RM 0.00` dan nama jenama; elakkan URL, nombor telefon atau permintaan maklumat peribadi dalam mesej. Contoh template ada dalam JSON. Twilio Verify mengurus template/expiry melalui perkhidmatan Verify sendiri.

Kos SMS, SMTP dan sebarang langganan bergantung pada penyedia, destinasi, penggunaan serta pelan akaun. Semak harga/kuota akaun sendiri sebelum mengaktifkan perkhidmatan. Kredit percubaan tidak bermaksud penghantaran awam tanpa had; Twilio trial memerlukan penerima disahkan. Tanpa credentials penyedia SMS, OTP telefon sebenar tidak boleh dihantar.

## Akaun yang sama atau berasingan

Google dan email dengan **alamat email disahkan yang sama** boleh dipautkan secara automatik oleh Supabase kepada pengguna yang sama. Akaun Google sahaja belum mempunyai kata laluan. UI tukar kata laluan semasa memerlukan kata laluan sedia ada, jadi ia belum menyokong setup kata laluan pertama bagi akaun Google sahaja. Gunakan pemulihan kata laluan melalui email yang disahkan selepas SMTP berfungsi, atau aliran khas setup kata laluan apabila dilaksanakan; jangan mendaftar akaun pendua.

Telefon sahaja tidak membawa alamat email tersebut dan boleh menghasilkan akaun berasingan. Jangan anggap nombor telefon dan Google/email bergabung automatik. Untuk menambah telefon pada pengguna sedia ada, pengguna perlu sudah log masuk, panggil `updateUser({ phone })`, kemudian sahkan dengan `type: 'phone_change'`; ini memerlukan aliran pautan telefon tersendiri.

## Handoff dan pengesahan akhir

Ijamm perlu melengkapkan tiga set nilai di dashboard projek **`ahvyieyojqciohdogsqc`**:

| Bahagian | Nilai yang perlu dimasukkan |
| --- | --- |
| Google | Web OAuth Client ID dan Client Secret |
| Email | SMTP host, port, username, password, sender email dan sender name |
| Phone | Credentials penyedia SMS terpilih; untuk contoh Twilio: Account SID, Auth Token, Message Service SID |

Semak flag public tanpa memulakan log masuk atau menghantar email/SMS:

```sh
node scripts/check-auth-providers.mjs --config supabase/provider-public.json
node scripts/check-auth-providers.mjs --config supabase/provider-public.json --require-all
```

Skrip membaca `GET /auth/v1/settings` untuk projek ini sahaja menggunakan publishable key. Exit `0` bermakna bacaan berjaya; `1` bermakna ralat config/rangkaian/respons. Dengan `--require-all`, exit `2` jika email, Google atau Phone belum dilaporkan hidup. Status semasa ialah email `true`, Google `false`, Phone `false`, kedua-dua pengesahan `true`, dan signups `true`; maka exit `2` dijangka untuk semakan ketat. Ia tidak mengesahkan URL dashboard, SMTP, penghantaran atau log masuk sebenar.

Ujian kod/fixture dan public GET bukan ujian hujung ke hujung. Belum ada SMS telefon sebenar dihantar atau ujian hujung ke hujung Google/email/SMS dengan credentials sebenar. Selepas nilai lengkap, uji melalui laman HTTPS: Google kembali ke `/xylo-studio/`; daftar/sahkan/log masuk email; resend dan reset password; magic link/kod email mengikut template; SMS salah/tamat tempoh, resend dan kod sah. Semak `user.id`, sesi dan log keluar; pastikan Google/email disahkan yang sama menggunakan identiti pengguna yang dijangka. Rekod keputusan tanpa token, kata laluan atau kod OTP.

## Rujukan rasmi

- [Google OAuth Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Google: Audience dan pengecualian scope asas](https://support.google.com/cloud/answer/15549945)
- [Email dan kata laluan](https://supabase.com/docs/guides/auth/passwords), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [magic link / email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Phone sign-in](https://supabase.com/docs/guides/auth/phone-login), [rate limits](https://supabase.com/docs/guides/auth/rate-limits), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)
- [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Management API: field Auth config](https://supabase.com/docs/reference/api/v1-update-auth-service-config)
- [Twilio: Malaysia SMS](https://www.twilio.com/en-us/guidelines/my/sms), [Verify dan syarat trial](https://www.twilio.com/docs/verify/api/verification)
