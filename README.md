# e-Instru Studio

Versi **v1.04.0**. Alat muzik digital dan permainan rentak BM dalam satu HTML kendiri.

Buka [laman](https://undead41.github.io/xylo-studio/) atau muat turun ZIP branch [share](https://github.com/unDead41/xylo-studio/tree/share), extract dan buka index.html dalam Chrome/Edge. Studio dan Permainan boleh digunakan sebagai tetamu tanpa akaun atau sambungan rangkaian. Mikrofon pilihan memerlukan HTTPS/localhost serta kebenaran pengguna. Snapshot share dikemas kini secara manual dan tidak menerima perubahan akaun ini secara automatik.

## Akaun Supabase — cabang auth-supabase

Cabang `auth-supabase`, berasaskan main `c0ba48bb9c35244354779cc227ecb7c999bff5dd`, menambah pendaftaran e-mel/kata laluan, log masuk, log keluar, pengesahan e-mel, lupa kata laluan dan pertukaran kata laluan. Akaun ialah pilihan; lapan instrumen, sepuluh lagu, Permainan dan rakaman pelayar terus berfungsi sebagai tetamu. Log masuk atau keluar tidak memindahkan, memadam atau menyegerakkan rakaman setempat ke pangkalan data.

Projek Supabase khusus `ahvyieyojqciohdogsqc` diwujudkan di Singapore dalam organisasi Norhizam. Skop pangkalan data ialah profil pengguna dalam `profiles`, dengan Row Level Security (RLS) bagi akses profil milik pengguna. Rakaman, score, sejarah permainan dan audio mentah tidak disimpan dalam jadual baharu. Kata laluan akaun diurus oleh Supabase Auth; kata laluan UI eksport setempat kekal berasingan.

Fungsi akaun memerlukan rangkaian dan laman HTTPS. URL callback hos ialah `https://undead41.github.io/xylo-studio/`; buka pautan pengesahan/pemulihan di hos yang dibenarkan, bukan fail `file://`. `index.html` membundel SDK `supabase-js` versi tetap `2.118.0` secara inline daripada salinan vendor; tiada CDN atau fail SDK luar dimuatkan ketika aplikasi dibuka. Konfigurasi pelayar hanya menggunakan URL projek dan kunci awam; kunci `service_role`, kata laluan SMTP dan token pengurusan tidak boleh dimasukkan dalam HTML atau Git.

Semua 13 templat e-mel BM tersedia sebagai sumber dalam [manifest templat](supabase/templates/manifest.json): enam aliran pengesahan dan tujuh pemberitahuan keselamatan. Semak sumber dengan `node supabase/templates/build-config.mjs --check`. Penyediaan sumber tidak bermaksud templat telah aktif pada hos atau e-mel telah sampai. Custom SMTP belum disediakan untuk projek ini; pengaktifan templat tersuai dan penghantaran e-mel kepada pengguna awam masih memerlukan konfigurasi tersebut. Templat telefon, identiti dan MFA melengkapkan konfigurasi e-mel; ia tidak menambah aliran UI tersebut ke aplikasi.

Perubahan ini belum dipromosikan ke `main` melalui tugasan ini. GitHub Pages terus menerbitkan sumber `main`; ujian hos dan penghantaran e-mel sebenar perlu dilaporkan berasingan daripada ujian simulasi. Versi diterima kekal **v1.04.0**.

## Instrumen

Skrin pertama ialah **Pilih instrumen anda** dengan lapan instrumen: Xylophone, Rekoder Soprano Baroque, Tamborin, Kompang, Dram Sisi, Dram Bes, Simbal dan Segi Tiga. Kad disusun dalam dua lajur pada desktop dan satu lajur pada skrin kecil; empat alat baharu berada di bawah Perkusi sekolah & pancaragam. Gunakan **Tukar instrumen** untuk kembali; rakaman dan suntingan setiap instrumen dikekalkan dalam ruang kerjanya sendiri. Penjenamaan aplikasi ialah **e-Instru Studio**; nama repository dan URL laman kekal.

Rekoder mempunyai lapan pad C–C′ (bunyi sebenar C5–C6, MIDI 72–84). Tahan tetikus/sentuhan atau A S D F G H J K untuk memanjangkan nada; lepaskan untuk berhenti. Panduan penjarian SVG menunjukkan lubang belakang T, hadapan 1–7 dan keadaan buka/tutup melalui bentuk serta label. Lihat [pemetaan dan sumber pengeluar](docs/RECORDER.md). Not tambahan katalog dipaparkan; pitch di luar julat soprano menyekat playback dengan amaran, tanpa mengubah score. Mikrofon sedia ada hanya untuk xylophone.

Keluaran sumber utama **v1.04.0** menggabungkan implementasi `ui` ke `main` atas arahan Ijamm. Snapshot share/tutorial kekal dikemas kini secara manual.

## Studio

Main lapan bar menggunakan tetikus/sentuhan atau A S D F G H J K. Pilih 10 lagu versi Panjang atau Petikan pendek. Rakam ketukan, sunting not/masa, seret Tempo 40–200 BPM dan lihat Data ketukan serta Jejak melodi bergerak bersama. Reset menghentikan sesi dan memulihkan tempo asal tanpa membuang not/suntingan.

Eksport JSON menyimpan score, identiti instrumen, raw timestamp serta tempoh tahan/lepas rekoder; CSV menyediakan data masa yang boleh disemak. Kata laluan UI eksport ialah demo41 atau demo@41. Ia kemudahan setempat dan tidak melindungi fail daripada orang yang boleh mengubah JavaScript. Simpanan pelayar tidak menggantikan sandaran JSON.

## Permainan

Pilih Permainan, lagu, versi dan Easy/Medium/Hard (75/100/135% BPM asal). Ketuk empat lorong A S D F pada garis masa. Excellent ≤70ms: 100 mata asas dan +3 nyawa; Good ≤150ms: 60 mata asas; Miss: −15 nyawa; ketukan salah: −8 nyawa. Nyawa maksimum 100, kombo memberikan bonus. Countdown, jeda/sambung dan local best disediakan. Rehat tidak menjadi jubin.

Semua bunyi ialah sintesis digital. Mikrofon dianalisis secara tempatan; raw audio tidak dihantar atau disimpan. Bacaan pitch/onset ialah anggaran. Susunan lagu kekal berlabel cadangan apabila transkripsi video belum disahkan.

## Pembangunan

Pasang Node.js 22+ kemudian jalankan `npm test` (atau `node --test tests/*.test.cjs tests/auth/*.test.cjs`). Source utama ialah index.html; tiada dist atau checkout luar diperlukan. Host tests menggunakan boundary DOM/audio simulasi. Untuk perubahan akaun, sunting `assets/auth`, kemudian jalankan `node scripts/build-auth.mjs`; `node scripts/build-auth.mjs --check` memastikan HTML sepadan dengan sumbernya. Bukti calon akaun dalam [handoff auth](docs/handoffs/auth-supabase/LATEST.md); bukti keluaran diterima dalam [audit main](docs/audits/main/LATEST.md). Ujian pelayar tambahan: `node tests/browser-recorder.cjs` dengan Playwright/Chromium tersedia.

Branch dan nama chat: docs/BRANCH_POLICY.md. SOR: docs/SOR.md. Tutorial/share hanya diperbaharui apabila diminta. GitHub Pages menggunakan main, folder root.

## Studio perkusi — Tamborin dan Kompang

Kedua-dua studio perkusi boleh dimainkan dengan tetikus, sentuhan dan papan kekunci. Tamborin: ketuk permukaan SVG atau tekan Ruang; G untuk goncang. Kompang: ketuk kawasan Tengah atau gelang Tepi pada permukaan SVG; F untuk tengah, J untuk tepi. Tab memfokuskan setiap kawasan/kawalan; Enter atau Ruang memainkannya. Tengah menghasilkan bunyi rendah dan berisi; tepi lebih tajam dan pendek. Bunyi ialah sintesis digital, bukan rakaman alat sebenar atau tuntutan kesetiaan akustik.

Pilih satu daripada empat corak rentak, tempo 40–200 BPM dan metronom. Main contoh tidak mengisi rakaman. Tekan Rakam, main rentak dan Henti; ketukan pertama menjadi masa sifar. Main rakaman, jejak rentak, suntingan tindakan/masa serta eksport/import JSON dan eksport CSV tersedia. Data perkusi menggunakan schema dan kunci simpanan berasingan; rakaman xylophone/rekoder lama kekal serasi.

Susun atur Tamborin dan Kompang diselaraskan dengan Xylophone/Rekoder: instrumen di kiri, inspector rakaman di kanan, Rakam/Main rakaman/Henti di bawah instrumen, diikuti tempo/metronom/Reset. Corak rentak, jejak dan jadual Data ketukan yang terus kelihatan berada di bawahnya. Eksport JSON/CSV berada dalam inspector; pada telefon inspector tersusun selepas ruang utama. Bukti desktop/telefon terkini: [handoff UI](docs/handoffs/ui/LATEST.md). Ujian susun atur: `node tests/browser-layout.cjs`.

Tempo dikunci semasa rakaman. Perubahan tempo retime masa main sahaja dan menghentikan playback; masa input asal tidak berubah. Reset menghentikan sesi dan memulihkan tempo tangkapan tanpa membuang tindakan atau suntingan. Jika retime ke tempo asal akan melebihi had 180 saat, Reset memulihkan BPM sambil mengekalkan masa suntingan yang sah dan memaklumkannya pada status.

Kompang menggunakan model, pengawal rakaman, jejak dan penjadual Tamborin yang sama dengan konfigurasi tindakan serta sintesisnya sendiri. Data kedua-duanya disimpan berasingan; bertukar instrumen menghentikan bunyi/penjadual tanpa membuang rakaman. Bukti gabungan dan screenshot desktop/telefon: [handoff Kompang](docs/handoffs/instrument-kompang/LATEST.md). Ujian pelayar tambahan: `node tests/browser-kompang.cjs` dan `node tests/browser-tamborin.cjs` (Playwright/Chromium untuk ujian sahaja). Nombor keluaran diterima kekal v1.04.0; penambahan Kompang asal tidak menambah kebergantungan runtime.

## Perkusi sekolah & pancaragam

| Instrumen | F / kawasan pertama | J / kawasan kedua |
| --- | --- | --- |
| Dram Sisi (snare drum) | Ketuk kulit | Ketuk rim |
| Dram Bes (bass drum) | Ketuk kuat | Ketuk lembut |
| Simbal (cymbals) | Laga kuat | Laga lembut |
| Segi Tiga (triangle) | Ketuk terbuka | Ketuk tertahan |

Keempat-empat studio menggunakan rakaman, jejak, jadual suntingan, tempo 40–200 BPM, metronom, Reset serta JSON/CSV daripada pengawal perkusi yang sama. Setiap alat mempunyai dua kawasan SVG interaktif, dua butang besar dan empat corak latihan 4/4. Segi Tiga tertahan ialah satu ketukan pendek baharu; ia bukan arahan untuk menghentikan ketukan terbuka sebelumnya. Simbal dan Segi Tiga mempunyai ekor deringan sehingga satu saat dalam main semula.

Identiti simpanan berasingan ialah `snare`, `bass_drum`, `cymbals` dan `triangle`. Import menolak fail milik instrumen lain. Semua alat baharu ialah perkusi tidak berpic dengan bunyi sintesis; tiada MIDI palsu atau audio mentah disimpan. Bukti ujian dan batasan: [handoff pancaragam](docs/handoffs/instrument-pancaragam/LATEST.md).
