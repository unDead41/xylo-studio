# Xylo Studio

Versi **v1.03.2**. Alat muzik digital dan permainan rentak BM dalam satu HTML kendiri.

Buka [laman](https://undead41.github.io/xylo-studio/) atau muat turun ZIP branch [share](https://github.com/unDead41/xylo-studio/tree/share), extract dan buka index.html dalam Chrome/Edge. Tiada pemasangan, akaun atau backend diperlukan. Mikrofon pilihan memerlukan HTTPS/localhost serta kebenaran pengguna.

## Studio

Main lapan bar menggunakan tetikus/sentuhan atau A S D F G H J K. Pilih 10 lagu versi Panjang atau Petikan pendek. Rakam ketukan, sunting not/masa, seret Tempo 40–200 BPM dan lihat Data ketukan serta Jejak melodi bergerak bersama. Reset menghentikan sesi dan memulihkan tempo asal tanpa membuang not/suntingan.

Eksport JSON menyimpan score, raw timestamp dan metadata; CSV menyediakan data masa yang boleh disemak. Kata laluan UI eksport ialah demo41 atau demo@41. Ia kemudahan setempat dan tidak melindungi fail daripada orang yang boleh mengubah JavaScript. Simpanan pelayar tidak menggantikan sandaran JSON.

## Permainan

Pilih Permainan, lagu, versi dan Easy/Medium/Hard (75/100/135% BPM asal). Ketuk empat lorong A S D F pada garis masa. Excellent ≤70ms: 100 mata asas dan +3 nyawa; Good ≤150ms: 60 mata asas; Miss: −15 nyawa; ketukan salah: −8 nyawa. Nyawa maksimum 100, kombo memberikan bonus. Countdown, jeda/sambung dan local best disediakan. Rehat tidak menjadi jubin.

Semua bunyi ialah sintesis digital. Mikrofon dianalisis secara tempatan; raw audio tidak dihantar atau disimpan. Bacaan pitch/onset ialah anggaran. Susunan lagu kekal berlabel cadangan apabila transkripsi video belum disahkan.

## Pembangunan

Pasang Node.js 20+ kemudian jalankan `node --test tests/*.test.cjs`. Source utama ialah index.html; tiada dist atau checkout luar diperlukan. Host tests menggunakan boundary DOM/audio simulasi. Bukti semasa dalam docs/audits/audit/LATEST.md.

Branch dan nama chat: docs/BRANCH_POLICY.md. SOR: docs/SOR.md. Tutorial/share hanya diperbaharui apabila diminta. GitHub Pages menggunakan main, folder root.
