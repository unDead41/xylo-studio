# e-Instru Studio

Versi **v1.04.0**. Alat muzik digital dan permainan rentak BM/BI dalam satu HTML kendiri.

Pilihan **BM / BI** pada header menukar bahasa antara Bahasa Melayu dan English untuk pemilih instrumen, semua studio, permainan, panduan, dialog serta mesej ralat. Pilihan disimpan pada pelayar ini. Bahasa boleh ditukar ketika sesi sedang berjalan; teks dikemas kini tanpa memuat semula aplikasi. Nama rakaman, data asal dan eksport JSON/CSV dikekalkan.

## Calon Studio Pro — branch ui

**Studio Pro** menambah ruang susunan berbilang trek tanpa memenuhi studio instrumen dengan kawalan lanjutan. Buka dari pemilih instrumen atau navigasi atas; tiga tab **Susunan**, **Mixer** dan **Projek** berkongsi transport, tempo, ulangan dan kursor.

- Gabungkan sehingga lapan trek daripada lapan instrumen. Gunakan **Tambah ke Studio Pro** di studio instrumen untuk membawa masuk rakaman atau lagu semasa; rakaman asal dikekalkan.
- Sunting satu bar pada satu masa melalui grid 16 langkah, not/ketukan, masa, tempoh dan kekuatan. Kemas masa, transpose, gandakan trek serta Undur/Ulang tersedia.
- Buka **Alat bar** untuk Salin, Tampal atau Kosongkan bar terpilih. Tampal menambah not secara lalai; pilihan Gantikan menggantikan not dalam bar sasaran. Instrumen perlu sepadan dan Undur tersedia.
- Main trek bersama dengan Jeda/Sambung/Henti, metronom dan ulangan bahagian. Laras tahap, pan, Bisu/Solo, Reverb/Delay dan output utama melalui Mixer.
- Namakan, autosimpan, buka, gandakan dan padam salinan projek setempat. Eksport/import projek JSON atau eksport seluruh susunan CSV. Had projek: 4–32 bar, 512 not/ketukan bagi setiap trek dan 20 projek dalam pelayar.
- Mulakan melalui **Cuba contoh projek** atau **Projek → Mulakan dengan contoh**: Melodi dan rentak, Rentak sekolah atau Rentak perarakan. Setiap contoh ialah susunan asal empat bar yang boleh dimainkan dan disunting.

BM/BI turut tersedia untuk Studio Pro dan tetapan paparan; nama projek dan rakaman tersuai kekal literal. Butang **Paparan** sentiasa tersedia. Tema **Ikut peranti / Cerah / Gelap** berasingan daripada **Warna asal / Protanopia / Deuteranopia / Tritanopia / Kontras tinggi**. Mod warna menambah palet alternatif, corak bar, tanda keadaan dan label; pilihan disimpan pada peranti. Bentuk dan penjarian sebenar alat tidak ditukar.

Sumber modular berada dalam `studio-pro/`; jalankan `node scripts/embed-studio-pro.cjs` selepas menyuntingnya. `index.html` yang disimpan kekal HTML kendiri tanpa muatan modul luar. Semak dengan `node scripts/embed-studio-pro.cjs --check` dan `node --test tests/*.test.cjs`. Calon ini berada di `ui`; penerbitan main/Pages tidak diubah. [Handoff Studio Pro terkini](docs/handoffs/ui/STUDIO_PRO_RESUME.md).

Buka [laman](https://undead41.github.io/xylo-studio/) atau muat turun ZIP branch [share](https://github.com/unDead41/xylo-studio/tree/share), extract dan buka index.html dalam Chrome/Edge. Tiada pemasangan, akaun atau backend diperlukan. Mikrofon pilihan memerlukan HTTPS/localhost serta kebenaran pengguna.

## Instrumen

Skrin pertama ialah **Pilih instrumen anda** dengan lapan instrumen: Xylophone, Rekoder Soprano Baroque, Tamborin, Kompang, Dram Sisi, Dram Bes, Simbal dan Segi Tiga. Kad padat disusun dalam dua lajur pada desktop dan satu lajur pada skrin kecil. Pautan kumpulan Melodi & nada, Rentak & tradisi dan Perkusi sekolah & pancaragam memudahkan pilihan; setiap kad menerangkan tindakan dan pintasan studio. Gunakan **Tukar instrumen** untuk kembali; rakaman dan suntingan setiap instrumen dikekalkan dalam ruang kerjanya sendiri. Penjenamaan aplikasi ialah **e-Instru Studio**; nama repository dan URL laman kekal.

Rekoder mempunyai lapan pad C–C′ (bunyi sebenar C5–C6, MIDI 72–84). Tahan tetikus/sentuhan atau A S D F G H J K untuk memanjangkan nada; lepaskan untuk berhenti. Panduan penjarian SVG menunjukkan lubang belakang T, hadapan 1–7 dan keadaan buka/tutup melalui bentuk serta label. Lihat [pemetaan dan sumber pengeluar](docs/RECORDER.md). Not tambahan katalog dipaparkan; pitch di luar julat soprano menyekat playback dengan amaran, tanpa mengubah score. Mikrofon sedia ada hanya untuk xylophone.

Keluaran sumber utama **v1.04.0** menggabungkan implementasi `ui` ke `main` atas arahan Ijamm. Snapshot share/tutorial kekal dikemas kini secara manual.

## Studio

Main lapan bar menggunakan tetikus/sentuhan atau A S D F G H J K. Pilih 10 lagu versi Panjang atau Petikan pendek. Rakam ketukan, sunting not/masa, seret Tempo 40–200 BPM dan lihat Data ketukan serta Jejak melodi bergerak bersama. Reset menghentikan sesi dan memulihkan tempo asal tanpa membuang not/suntingan.

Eksport JSON menyimpan score, identiti instrumen, raw timestamp serta tempoh tahan/lepas rekoder; CSV menyediakan data masa yang boleh disemak. Kata laluan UI eksport ialah demo41 atau demo@41. Ia kemudahan setempat dan tidak melindungi fail daripada orang yang boleh mengubah JavaScript. Simpanan pelayar tidak menggantikan sandaran JSON.

## Permainan

Pilih Permainan, lagu, versi dan Easy/Medium/Hard (75/100/135% BPM asal). Ketuk empat lorong A S D F pada garis masa. Excellent ≤70ms: 100 mata asas dan +3 nyawa; Good ≤150ms: 60 mata asas; Miss: −15 nyawa; ketukan salah: −8 nyawa. Nyawa maksimum 100, kombo memberikan bonus. Countdown, jeda/sambung dan local best disediakan. Rehat tidak menjadi jubin.

Semua bunyi ialah sintesis digital. Mikrofon dianalisis secara tempatan; raw audio tidak dihantar atau disimpan. Bacaan pitch/onset ialah anggaran. Susunan lagu kekal berlabel cadangan apabila transkripsi video belum disahkan.

## Pembangunan

Pasang Node.js 20+ kemudian jalankan `node --test tests/*.test.cjs`. Source utama ialah index.html; tiada dist atau checkout luar diperlukan. Host tests menggunakan boundary DOM/audio simulasi. Bukti keluaran dan semakan gabungan dalam [audit main](docs/audits/main/LATEST.md); sejarah implementasi dalam [handoff ui](docs/handoffs/ui/LATEST.md). Ujian pelayar tambahan: `node tests/browser-recorder.cjs` dengan Playwright/Chromium tersedia.

Branch dan nama chat: docs/BRANCH_POLICY.md. SOR: docs/SOR.md. Tutorial/share hanya diperbaharui apabila diminta. GitHub Pages menggunakan main, folder root.

## Studio perkusi — Tamborin dan Kompang

Kedua-dua studio perkusi boleh dimainkan dengan tetikus, sentuhan dan papan kekunci. Tamborin: ketuk permukaan SVG atau tekan Ruang; G untuk goncang. Kompang: ketuk kawasan Tengah atau gelang Tepi pada permukaan SVG; F untuk tengah, J untuk tepi. Tab memfokuskan setiap kawasan/kawalan; Enter atau Ruang memainkannya. Tengah menghasilkan bunyi rendah dan berisi; tepi lebih tajam dan pendek. Bunyi ialah sintesis digital, bukan rakaman alat sebenar atau tuntutan kesetiaan akustik.

Pilih satu daripada empat corak rentak, tempo 40–200 BPM dan metronom. Main contoh tidak mengisi rakaman. Tekan Rakam, main rentak dan Henti; ketukan pertama menjadi masa sifar. Main rakaman, jejak rentak, suntingan tindakan/masa serta eksport/import JSON dan eksport CSV tersedia. Data perkusi menggunakan schema dan kunci simpanan berasingan; rakaman xylophone/rekoder lama kekal serasi.

Susun atur Tamborin dan Kompang diselaraskan dengan Xylophone/Rekoder: instrumen di kiri, inspector rakaman di kanan, Rakam/Main rakaman/Henti di bawah instrumen, diikuti tempo/metronom/Reset. Corak rentak, jejak dan jadual Data ketukan yang terus kelihatan berada di bawahnya. Eksport JSON/CSV berada dalam inspector; pada telefon inspector tersusun selepas ruang utama. Bukti desktop/telefon terkini: [handoff UI](docs/handoffs/ui/LATEST.md). Ujian susun atur: `node tests/browser-layout.cjs`.

Tempo dikunci semasa rakaman. Perubahan tempo retime masa main sahaja dan menghentikan playback; masa input asal tidak berubah. Reset menghentikan sesi dan memulihkan tempo tangkapan tanpa membuang tindakan atau suntingan. Jika retime ke tempo asal akan melebihi had 180 saat, Reset memulihkan BPM sambil mengekalkan masa suntingan yang sah dan memaklumkannya pada status.

Kompang menggunakan model, pengawal rakaman, jejak dan penjadual Tamborin yang sama dengan konfigurasi tindakan serta sintesisnya sendiri. Data kedua-duanya disimpan berasingan; bertukar instrumen menghentikan bunyi/penjadual tanpa membuang rakaman. Bukti gabungan dan screenshot desktop/telefon: [handoff Kompang](docs/handoffs/instrument-kompang/LATEST.md). Ujian pelayar tambahan: `node tests/browser-kompang.cjs` dan `node tests/browser-tamborin.cjs` (Playwright/Chromium untuk ujian sahaja). Nombor keluaran diterima kekal v1.04.0; tiada kebergantungan runtime ditambah.

## Perkusi sekolah & pancaragam

| Instrumen | F / kawasan pertama | J / kawasan kedua |
| --- | --- | --- |
| Dram Sisi (snare drum) | Ketuk kulit | Ketuk rim |
| Dram Bes (bass drum) | Ketuk kuat | Ketuk lembut |
| Simbal (cymbals) | Laga kuat | Laga lembut |
| Segi Tiga (triangle) | Ketuk terbuka | Ketuk tertahan |

Keempat-empat studio menggunakan rakaman, jejak, jadual suntingan, tempo 40–200 BPM, metronom, Reset serta JSON/CSV daripada pengawal perkusi yang sama. Setiap alat mempunyai dua kawasan SVG interaktif, dua butang besar dan empat corak latihan 4/4. Segi Tiga tertahan ialah satu ketukan pendek baharu; ia bukan arahan untuk menghentikan ketukan terbuka sebelumnya. Simbal dan Segi Tiga mempunyai ekor deringan sehingga satu saat dalam main semula.

Identiti simpanan berasingan ialah `snare`, `bass_drum`, `cymbals` dan `triangle`. Import menolak fail milik instrumen lain. Semua alat baharu ialah perkusi tidak berpic dengan bunyi sintesis; tiada MIDI palsu atau audio mentah disimpan. Bukti ujian dan batasan: [handoff pancaragam](docs/handoffs/instrument-pancaragam/LATEST.md).

## Calon UI/UX keseluruhan — branch ui

Penambahbaikan semasa dibangunkan di `ui` daripada main lapan instrumen terkini. Teks dan kawalan dikongsi lebih mudah dibaca, navigasi Studio/Permainan kekal tersedia semasa menatal, dan butang Rakam/Main/Henti menyusun semula pada telefon. Main lagu dan Main rakaman mengikut sumber semasa; bantuan papan kekunci, keadaan kosong dan panduan rakaman lebih jelas.

Studio perkusi membezakan latihan bebas, rakaman, contoh dan main semula. Latihan baharu menggunakan jejak sementara; rakaman tersimpan dan masa input asal kekal. Dialog memberikan fokus awal dan ralat pada medan yang betul, kemudian memulihkan fokus selepas suntingan; kata laluan eksport setempat mempunyai butang Tunjuk/Sembunyi.

Permainan mempunyai ringkasan cabaran/keadaan, panduan ringkas, peraturan terperinci dalam panel boleh buka, serta butang mula/sambung/main lagi pada arena dan keputusan. Peraturan skor, nyawa dan masa kekal sama. Versi diterima kekal v1.04.0; calon ini dipush ke `ui` untuk semakan. Penerbitan Pages masih daripada main. [Bukti dan handoff UI terkini](docs/handoffs/ui/LATEST.md).
