# E-mel Auth — e-Instru Studio

Set ini meliputi semua **13 jenis e-mel** dalam Supabase Auth: enam e-mel pengesahan dan tujuh notifikasi keselamatan. Kandungan menggunakan Bahasa Melayu, penjenamaan e-Instru Studio dan warna aplikasi: hijau `#126B66`, teks `#172F41` dan latar `#EDF3F7`.

Setiap fail HTML boleh disalin terus ke editor templat Supabase. Jadual susun atur mempunyai `role="presentation"`, satu tajuk utama, teks pautan yang jelas, fon sistem dan butang besar. Templat tidak memuatkan imej, fon atau skrip luaran. Lebar maksimum ialah 600 px; ruang dan saiz tajuk menyesuaikan pada telefon. Kandungan tindakan tidak menetapkan tempoh sah secara tetap kerana tempoh sebenar bergantung pada konfigurasi Auth.

Mengubah fail dalam repositori sahaja tidak menerbitkan templat ke projek Supabase. Penyediaan templat juga tidak menambah aliran telefon, OAuth atau MFA ke antara muka aplikasi; notifikasi jenis itu dihantar apabila ciri berkenaan digunakan dan notifikasinya diaktifkan.

## Status projek khusus — 4 November 2026

Projek baharu **e-Instru Studio** (`ahvyieyojqciohdogsqc`, Singapore) telah diwujudkan. Pengesahan e-mel, secure email change, secure password change dan keperluan kata laluan semasa telah disimpan; panjang minimum ialah lapan aksara. Ketujuh-tujuh suis notifikasi keselamatan telah diaktifkan dan disimpan pada Dashboard.

SMTP tersuai masih belum dikonfigurasi. Dashboard memaparkan “Set up custom SMTP to edit templates”, maka 13 HTML berjenama dalam repositori belum diterbitkan; hos masih menggunakan templat lalai. Tiada e-mel sebenar dihantar atau disahkan sampai dalam tugasan ini. Status ini berbeza daripada kejayaan ujian kod dan pengaktifan suis notifikasi.

Site URL ialah `https://undead41.github.io/xylo-studio/`. Enam redirect URL tepat telah ditambah: Site URL, URL `index.html`, serta Site URL dengan `?auth_flow=signup`, `?auth_flow=recovery`, `?auth_flow=magiclink` dan `?auth_flow=email_change`. Tiada wildcard hos lain dibenarkan. Aplikasi mengendalikan callback pada akar laman dan membuang kelayakan callback daripada sejarah URL.

## Templat dan subjek

[manifest.json](../supabase/templates/manifest.json) ialah sumber subjek dan pemetaan medan. Jangan ubah nama pemboleh ubah Go dalam HTML menjadi nilai contoh.

| Jenis dalam Dashboard | Fail | Subjek |
| --- | --- | --- |
| Confirm sign up | [confirmation.html](../supabase/templates/confirmation.html) | Sahkan e-mel anda \| e-Instru Studio |
| Invite user | [invite.html](../supabase/templates/invite.html) | Jemputan ke e-Instru Studio |
| Magic link or OTP | [magic_link.html](../supabase/templates/magic_link.html) | Pautan log masuk anda \| e-Instru Studio |
| Change email address | [email_change.html](../supabase/templates/email_change.html) | Sahkan pertukaran e-mel \| e-Instru Studio |
| Reset password | [recovery.html](../supabase/templates/recovery.html) | Tetapkan semula kata laluan \| e-Instru Studio |
| Reauthentication | [reauthentication.html](../supabase/templates/reauthentication.html) | Kod pengesahan anda \| e-Instru Studio |
| Password changed | [password_changed_notification.html](../supabase/templates/password_changed_notification.html) | Kata laluan telah ditukar \| e-Instru Studio |
| Email address changed | [email_changed_notification.html](../supabase/templates/email_changed_notification.html) | Alamat e-mel telah ditukar \| e-Instru Studio |
| Phone number changed | [phone_changed_notification.html](../supabase/templates/phone_changed_notification.html) | Nombor telefon telah ditukar \| e-Instru Studio |
| Sign-in method linked | [identity_linked_notification.html](../supabase/templates/identity_linked_notification.html) | Kaedah log masuk telah dipautkan \| e-Instru Studio |
| Sign-in method removed | [identity_unlinked_notification.html](../supabase/templates/identity_unlinked_notification.html) | Kaedah log masuk telah dibuang \| e-Instru Studio |
| Verification method added | [mfa_factor_enrolled_notification.html](../supabase/templates/mfa_factor_enrolled_notification.html) | Kaedah pengesahan telah ditambah \| e-Instru Studio |
| Verification method removed | [mfa_factor_unenrolled_notification.html](../supabase/templates/mfa_factor_unenrolled_notification.html) | Kaedah pengesahan telah dibuang \| e-Instru Studio |

Jenis **Magic link or OTP** mempunyai satu slot templat. Set ini memilih pautan log masuk melalui `{{ .ConfirmationURL }}`. Jika aplikasi kemudian menyediakan borang OTP e-mel, slot yang sama boleh menggunakan `{{ .Token }}` dan borang mesti memanggil `verifyOtp({ email, token, type: 'email' })`. Menukar HTML sahaja tidak menyediakan borang atau pengesahan OTP. Reauthentication berasingan menggunakan kod `{{ .Token }}` untuk aliran pengesahan semula Auth.

## Pemboleh ubah Go

Supabase mengisi nilai ini semasa penghantaran. Nilai `{{ ... }}` bukan placeholder untuk diisi secara manual.

| Pemboleh ubah | Digunakan oleh set ini |
| --- | --- |
| `{{ .ConfirmationURL }}` | Pautan pengesahan sebenar untuk confirmation, invite, magic link, email change dan recovery; juga pautan salin/tampal. |
| `{{ .Token }}` | Kod sekali guna dalam reauthentication. |
| `{{ .SiteURL }}` | Pautan kembali ke aplikasi dalam tujuh notifikasi keselamatan. |
| `{{ .NewEmail }}` | Alamat baharu dalam permintaan email change sahaja. |
| `{{ .OldEmail }}`, `{{ .Email }}` | Alamat terdahulu dan alamat semasa dalam email changed notification. |
| `{{ .OldPhone }}`, `{{ .Phone }}` | Nombor terdahulu dan nombor semasa dalam phone changed notification; nilai kosong dipaparkan sebagai “Tiada”. |
| `{{ .Provider }}` | Penyedia dalam identity linked/unlinked notification. |
| `{{ .FactorType }}` | Jenis faktor dalam MFA enrolled/unenrolled notification. `totp` dilabel aplikasi pengesah dan `phone` dilabel telefon; jenis lain dipaparkan seperti diterima. |

Supabase turut mendokumenkan `.TokenHash`, `.RedirectTo` dan `.Data`. Set ini tidak memerlukannya. Jangan tambah pemboleh ubah rekaan seperti `.AppName`, `.SupportEmail`, `.ExpiresIn` atau `.CurrentYear`. Maklumat nama daripada `user_metadata` tidak digunakan dalam kandungan ini.

Pautan tindakan pengesahan menggunakan `.ConfirmationURL` yang lengkap. Menggantikannya dengan `.SiteURL` sahaja akan membuka aplikasi tanpa melakukan pengesahan. Notifikasi keselamatan sekadar memaklumkan tindakan yang telah berlaku; ia tidak mempunyai pautan pembatalan atau pemulihan bertoken. Teks keselamatan mengarahkan pengguna menetapkan semula kata laluan dan menghubungi pentadbir aplikasi tanpa mereka-reka alamat sokongan.

## Tetapan URL aplikasi

Untuk GitHub Pages projek ini, tetapkan **Authentication → URL Configuration** seperti berikut:

| Tetapan | Nilai |
| --- | --- |
| Site URL | `https://undead41.github.io/xylo-studio/` |
| Redirect URL produksi yang dibenarkan | `https://undead41.github.io/xylo-studio/` |
| `emailRedirectTo` / `redirectTo` dalam panggilan aplikasi | `https://undead41.github.io/xylo-studio/` |

Callback dikendalikan di halaman akar aplikasi tersebut. Jangan mencipta URL `/auth/callback` atau `/reset-password` tanpa melaksanakan dan membenarkan laluan itu. Gunakan URL HTTPS sebenar dan subdirektori `/xylo-studio/`, bukan akar domain GitHub Pages. Kekalkan garis miring hujung supaya nilai aplikasi dan senarai dibenarkan sepadan. URL pembangunan boleh ditambah secara berasingan untuk origin/port sebenar yang digunakan.

`signUp` dan `signInWithOtp` menerima `options.emailRedirectTo`; `resetPasswordForEmail` menerima `redirectTo`; `inviteUserByEmail` menerima `options.redirectTo`. Tanpa nilai itu, Supabase menggunakan Site URL sebagai destinasi lalai. Semua destinasi mesti sepadan dengan senarai Redirect URLs. Elakkan wildcard luas bagi URL produksi. API admin jemputan mesti berjalan pada pelayan/persekitaran dipercayai; kunci `service_role`, secret key dan token Management API tidak boleh dimasukkan ke HTML awam.

Jika **Secure email change** diaktifkan, Supabase meminta pengesahan alamat lama dan baharu. Gunakan templat email change untuk kedua-dua e-mel dan biarkan Supabase menghasilkan `.ConfirmationURL` yang sesuai. `.NewEmail` hanya disokong oleh templat permintaan pertukaran; notifikasi pertukaran yang telah selesai menggunakan `.OldEmail` dan `.Email`.

## Menyediakan dalam Dashboard

1. Semak had SMTP di bawah dan konfigurasi penghantar sebelum menguji penghantaran sebenar.
2. Buka **Authentication → Email → Templates** / halaman **Email Templates** projek. Nama menu boleh berubah; URL templat ialah `https://supabase.com/dashboard/project/PROJECT_REF/auth/templates`.
3. Bagi setiap baris jadual, salin subjek daripada manifest dan keseluruhan HTML daripada fail yang sepadan. Kekalkan ungkapan `{{ ... }}`.
4. Hidupkan setiap satu daripada tujuh suis notifikasi keselamatan jika projek perlu menghantarnya. Menyimpan badan templat sahaja tidak mengaktifkan notifikasi.
5. Semak pratonton, simpan dan sahkan semula subjek/badan yang disimpan. Uji pautan menggunakan akaun ujian yang anda kawal apabila penghantaran sebenar telah dibenarkan.

Matikan ciri **click tracking / link tracking** dalam penyedia SMTP supaya URL pengesahan tidak ditulis semula. Pengimbas keselamatan sesetengah penyedia e-mel boleh membuka pautan sekali guna sebelum pengguna; jika ini berlaku, pertimbangkan OTP atau halaman pengesahan perantaraan yang memerlukan tindakan pengguna. Halaman perantaraan perlu dibina dan diuji sebelum URL templat diubah.

## Medan Management API yang tepat

Endpoint baca/kemas kini ialah `GET` / `PATCH https://api.supabase.com/v1/projects/PROJECT_REF/config/auth`. Token yang digunakan ialah **personal access token Supabase Management API**, bukannya publishable key, anon key atau `service_role`.

| ID templat | Medan subjek | Medan badan HTML |
| --- | --- | --- |
| `confirmation` | `mailer_subjects_confirmation` | `mailer_templates_confirmation_content` |
| `invite` | `mailer_subjects_invite` | `mailer_templates_invite_content` |
| `magic_link` | `mailer_subjects_magic_link` | `mailer_templates_magic_link_content` |
| `email_change` | `mailer_subjects_email_change` | `mailer_templates_email_change_content` |
| `recovery` | `mailer_subjects_recovery` | `mailer_templates_recovery_content` |
| `reauthentication` | `mailer_subjects_reauthentication` | `mailer_templates_reauthentication_content` |
| `password_changed_notification` | `mailer_subjects_password_changed_notification` | `mailer_templates_password_changed_notification_content` |
| `email_changed_notification` | `mailer_subjects_email_changed_notification` | `mailer_templates_email_changed_notification_content` |
| `phone_changed_notification` | `mailer_subjects_phone_changed_notification` | `mailer_templates_phone_changed_notification_content` |
| `identity_linked_notification` | `mailer_subjects_identity_linked_notification` | `mailer_templates_identity_linked_notification_content` |
| `identity_unlinked_notification` | `mailer_subjects_identity_unlinked_notification` | `mailer_templates_identity_unlinked_notification_content` |
| `mfa_factor_enrolled_notification` | `mailer_subjects_mfa_factor_enrolled_notification` | `mailer_templates_mfa_factor_enrolled_notification_content` |
| `mfa_factor_unenrolled_notification` | `mailer_subjects_mfa_factor_unenrolled_notification` | `mailer_templates_mfa_factor_unenrolled_notification_content` |

| Notifikasi | Medan pengaktifan; nilai untuk menghantar |
| --- | --- |
| Password changed | `mailer_notifications_password_changed_enabled: true` |
| Email changed | `mailer_notifications_email_changed_enabled: true` |
| Phone changed | `mailer_notifications_phone_changed_enabled: true` |
| Identity linked | `mailer_notifications_identity_linked_enabled: true` |
| Identity unlinked | `mailer_notifications_identity_unlinked_enabled: true` |
| MFA factor enrolled | `mailer_notifications_mfa_factor_enrolled_enabled: true` |
| MFA factor unenrolled | `mailer_notifications_mfa_factor_unenrolled_enabled: true` |

Pembina [build-config.mjs](../supabase/templates/build-config.mjs) membaca manifest dan 13 fail HTML untuk menghasilkan **33 medan** tersebut: 26 subjek/badan dan tujuh suis `true`. Ia tidak membuat panggilan rangkaian atau membaca rahsia, dan tidak mengubah SMTP, Site URL, pembekal log masuk, polisi kata laluan atau tetapan Auth lain.

Jalankan dari akar repositori:

```bash
node supabase/templates/build-config.mjs --check
node supabase/templates/build-config.mjs > /tmp/e-instru-auth-email-config.json
```

Fail JSON yang terhasil ialah badan permintaan sebenar, bukannya `content_path` atau URL fail HTML. Berikut contoh penggunaan oleh pentadbir yang telah dibenarkan. `PROJECT_REF` dan `SUPABASE_ACCESS_TOKEN` ialah pemboleh ubah persekitaran pentadbir yang perlu disediakan secara selamat; nilai contoh tidak disimpan dalam repositori.

```bash
curl --fail-with-body --request PATCH \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  --header "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  --header "Content-Type: application/json" \
  --data-binary @/tmp/e-instru-auth-email-config.json
```

Sebelum PATCH, simpan salinan medan templat semasa melalui GET jika perlu untuk rollback. Selepas PATCH, GET semula dan bandingkan hanya 33 medan templat/notifikasi dengan payload. Respons konfigurasi Auth boleh mengandungi tetapan sensitif; jangan cetak, komit atau kongsi keseluruhan respons. Sebarang sandaran tempatan perlu kekal di luar repositori.

## SMTP dan had penghantaran

**Templat berjenama memerlukan penyedia penghantar yang sesuai.** Perubahan Supabase pada **3 Jun 2026** menyekat penyuntingan templat bagi projek Free baharu yang menggunakan SMTP lalai. Projek Free sedia ada sebelum tarikh itu mengekalkan templatnya; pelan Pro ke atas dan projek Free dengan SMTP sendiri tidak tertakluk pada sekatan tersebut. Status dan umur projek sebenar perlu disemak pada Dashboard.

SMTP lalai Supabase hanya menghantar kepada alamat ahli pasukan organisasi projek, mempunyai had yang boleh berubah dan tiada SLA penghantaran. Dokumentasi yang disemak pada 4 November 2026 menyatakan dua e-mel sejam bagi perkhidmatan lalai. Penghantaran umum memerlukan custom SMTP atau Send Email hook. Jangan matikan pengesahan e-mel untuk memintas had.

Custom SMTP memerlukan nilai sebenar daripada penyedia yang dipilih: host, port, pengguna, kata laluan SMTP dan alamat From yang disahkan. Nama penghantar yang dicadangkan ialah **e-Instru Studio**. Tiada alamat From, domain atau kelayakan SMTP direka dalam set ini. Lengkapkan SPF/DKIM/DMARC mengikut penyedia dan semak Rate Limits selepas konfigurasi; menukar templat tidak menaikkan had penghantaran.

Medan berkaitan jika SMTP disediakan melalui Management API ialah `smtp_admin_email`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass` dan `smtp_sender_name`. `external_email_enabled` mengawal pembekal e-mel, `mailer_autoconfirm` mengawal pengesahan automatik, dan `mailer_secure_email_change_enabled` mengawal pertukaran e-mel selamat. Medan ini **tidak disertakan** dalam payload templat supaya tiada kelayakan atau tetapan pembekal ditulis secara tidak sengaja.

## Pembangunan setempat dan semakan

Untuk Supabase CLI setempat, jenis pengesahan menggunakan `[auth.email.template.ID]` dan notifikasi menggunakan `[auth.email.notification.EVENT]`. `ID` ialah enam ID pengesahan dalam manifest; `EVENT` ialah nama notifikasi tanpa akhiran `_notification`. Setiap bahagian menerima `subject` dan `content_path`; bahagian notifikasi turut memerlukan `enabled = true`.

```toml
[auth.email.template.confirmation]
subject = "Sahkan e-mel anda | e-Instru Studio"
content_path = "./supabase/templates/confirmation.html"

[auth.email.notification.password_changed]
enabled = true
subject = "Kata laluan telah ditukar | e-Instru Studio"
content_path = "./supabase/templates/password_changed_notification.html"
```

Tetapan `content_path` adalah untuk CLI setempat. Projek dihoskan menggunakan HTML kandungan melalui Dashboard atau Management API. Mulakan semula stack setempat selepas perubahan konfigurasi; Mailpit boleh menangkap e-mel ujian tanpa menghantarnya keluar. Pengesahan signup setempat memerlukan `enable_confirmations = true` di bawah `[auth.email]`.

Semakan automatik pembina memeriksa liputan 13 jenis, nama medan, fail, deklarasi pemboleh ubah dan tujuh suis notifikasi. Semakan HTML/visual setempat tidak membuktikan penghantaran SMTP, kelakuan klien e-mel sebenar atau pelaksanaan aliran Auth di projek dihoskan. Ujian menyeluruh perlu meliputi signup, jemputan, magic link, pemulihan kata laluan, kedua-dua peti masuk bagi secure email change, reauthentication serta notifikasi yang digunakan aplikasi.

## Sumber rasmi

Disemak pada **4 November 2026**; changelog dan dokumentasi semasa menjadi rujukan nama medan serta skop pemboleh ubah.

- [Supabase changelog](https://supabase.com/changelog.md)
- [Email Templates: 13 jenis, pemboleh ubah dan medan Management API](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Customizing email templates: konfigurasi CLI dan notifikasi](https://supabase.com/docs/guides/local-development/customizing-email-templates)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Test auth flows](https://supabase.com/docs/guides/auth/testing-auth-flows)
- [3 Jun 2026: Changes to Email Template Customisation on Free Tier](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)
