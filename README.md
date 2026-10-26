# Xylo Studio — V1.02.0

Alat xylophone HTML dengan lapan bar maya, rakaman ketukan, jejak melodi dan sepuluh lagu dalam versi panjang serta petikan pendek.

**Buka aplikasi:** https://undead41.github.io/xylo-studio/

## Guna

- Ketuk bar dengan tetikus, sentuhan atau kekunci A S D F G H J K. Audio bermula selepas interaksi pengguna.
- Pilih lagu, kemudian Main score. Klik not pada Jejak melodi untuk mendengar dan melihat baris sepadan dalam Data ketukan.
- Seret slider tempo 40–200 BPM. Masa score dikemas kini; masa input rakaman asal dikekalkan.
- Reset di kanan Metronom kembali ke awal, memulihkan tempo asal dan mematikan Metronom sambil mengekalkan semua not.
- Eksport menerima kata laluan demo41 atau demo@41. Ini sekatan antara muka JavaScript, bukan pengesahan pelayan atau perlindungan data rahsia.

Simpanan pelayar berada pada origin GitHub Pages ini. Rakaman pada pautan lama tidak berpindah automatik; simpan JSON dari pautan lama sebagai salinan. Tiada audio mikrofon dihantar atau disimpan. Pengesan mikrofon ialah percubaan yang memerlukan semakan manual.

## Bukti dan batasan

HTML ini byte-identical dengan keluaran Xylo Studio V1.02.0 yang telah diuji; tiada perubahan kod aplikasi untuk GitHub Pages. 44 ujian core, katalog dan UI lulus pada source yang sama. Manifest hash dan source commit ada dalam release.json.

Sumber tajuk sepuluh lagu: https://www.youtube.com/watch?v=ZSiK3_bSxW8. Score ialah susunan cadangan, bukan transkripsi audio/video yang disahkan. Tiada rakaman atau imej pihak ketiga disertakan.

**SOFTWARE VERIFIED:** 44 ujian automatik. **HARDWARE/ACOUSTIC VERIFIED: NO.** Pratonton sintetik tidak membuktikan ketukan fizikal. Eksport C++ menggunakan had kontrak engine rujukan 64 event/30s dan tidak menetapkan pin, sudut atau kalibrasi servo.

## Penerbitan dan arahan sambung

Repo ini khusus untuk laman statik. Branch penerbitan ialah xylo/music, folder root, dengan .nojekyll. Settings → Pages → Deploy from a branch → xylo/music → /(root).

Untuk kemas kini, ganti index.html dengan HTML keluaran yang telah diuji, selaraskan VERSION dan release.json, kemudian push branch xylo/music. GitHub Pages membina semula daripada branch tersebut. Versi di sebelah logo mesti sepadan dengan VERSION.

Repo firmware unDead41/xylophone dan branch main-nya tidak diubah oleh penerbitan ini. Integrasi firmware kekal milik Master.
