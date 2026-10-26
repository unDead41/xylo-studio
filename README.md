# Xylo Studio

Versi semasa **V1.03.0** dipaparkan di sebelah logo pada semua saiz paparan. `VERSION` ialah rujukan nombor keluaran. Untuk setiap keluaran HTML seterusnya, naikkan versi dan selaraskan label serta metadata HTML menggunakan format `Vx.xx.x`.

Alat BM dalam satu HTML, berasingan daripada firmware Uno. Buka dist/index.html (atau index.html dalam repo GitHub Pages) dalam Chrome/Edge untuk main8not dan rekod input; versi HTTPS menyediakan permintaan mikrofon.

## Xylo Tiles — mod permainan

Tekan **Permainan** di sebelah logo. Pilih mana-mana daripada 10 lagu, versi Panjang atau Petikan pendek, kemudian tahap Easy, Medium atau Hard. Tempo sebenar dan durasi dipaparkan sebelum mula. Tahap menggunakan 75%, 100% dan 135% BPM asal, dibundarkan kepada integer. Untuk lagu 80 BPM: 60 / 80 / 108 BPM. Happy Birthday 72 BPM: 54 / 72 / 97 BPM. Versi pendek kekal petikan score asal; tempohnya berubah mengikut tempo permainan.

Empat lorong A S D F, tetikus atau sentuhan. Ketuk apabila bahagian bawah jubin sampai ke garis. Setiap jubin hanya satu ketukan; tiada hold note. Lorong ialah kawalan permainan, bukan empat pitch atau empat servo. Pitch MIDI sebenar pada jubin dan bunyi dikekalkan, termasuk Bb4, G3, E5 dan F5. Pitch disusun mengikut tinggi lalu diagih modulo empat; pitch berbeza boleh menggunakan lorong sama. Rehat tidak menjadi jubin dan tidak menyebabkan Miss.

| Penilaian | Masa input dari onset | Mata | Nyawa |
| --- | --- | --- | --- |
| Excellent | ≤70 ms awal/lewat | 100 + bonus kombo | +3, maksimum100 |
| Good | >70 hingga150 ms awal/lewat | 60 + bonus kombo | Kekal |
| Miss | Belum diketuk selepas150 ms | 0, kombo putus | −15 |
| Lorong salah / terlalu awal | Tiada jubin sepadan dalam tetingkap150 ms | 0, kombo putus | −8 |

Bonus bertambah10 mata bagi setiap10 kombo selepas yang pertama, maksimum+50 setiap ketukan. Nyawa bermula100; sifar menamatkan permainan. Countdown empat beat mendahului onset pertama dan tidak termasuk durasi score. Jeda/Sambung (atau Space) mengekalkan posisi; sambung mempunyai dua beat persediaan. Tab tersembunyi, tetingkap hilang fokus atau audio suspended menjeda permainan. Reset/mula semula dan pertukaran ke Studio membatalkan sesi; rakaman/suntingan Studio dikekalkan.

Skor, kombo, nyawa, masa dan keputusan Excellent/Good/Miss/Salah dipaparkan. Ketepatan ialah bilangan not berjaya / semua jubin, termasuk not belum dimainkan jika kalah. Skor terbaik disimpan di pelayar mengikut lagu, versi, tahap, BPM dan versi peraturan; tiada akaun atau leaderboard pelayan. Bunyi hanya dihasilkan bagi jubin yang berjaya diketuk, tanpa autoplay atau bunyi catch-up bagi not terlepas. Kekunci repeat dan pointer yang masih ditekan tidak memberikan mata tambahan.

Clock permainan menggunakan AudioContext.currentTime dengan satu origin; masa input diukur pada handler pelayar. Ini bukan ukuran latency akustik/peranti. Tiada kalibrasi hardware baharu. Bukti ujian dalam qa/game-verification.md.

## Guna

1. Pilih Versi lagu → Panjang untuk versi 38.6–72.8s, atau Petikan pendek untuk versi 10–15s. Kemudian pilih salah satu daripada10 lagu atau tekan Rakam.
2. Klik bar atau gunakan A S D F G H J K; ketukan pertama menjadi origin0.
3. Semasa playback, baris Data ketukan dan not Jejak melodi semasa ditanda ▶/hijau serta ditatal dalam panel masing-masing. Klik not dalam Jejak melodi juga memilih baris event yang sama. Seret slider Tempo40–200 BPM untuk mengemas kini masa score/durasi serta-merta, termasuk semasa playback; masa input asal tidak berubah. Tempo dikunci ketika rakaman.24tick =1quarter. Klik not dalam Jejak melodi untuk dengar pitch tersebut (Enter/Space juga boleh); sunting melalui ikon pensel dalam Data ketukan; pembetulan separa dibenarkan, eksport/playback hanya selepas score sah.
4. Klik Eksport score dan masukkan `demo41` atau `demo@41` untuk membuka JSON (data lengkap), CSV (semakan), atau C++ PROGMEM (data untuk API Music). Simpan rakaman JSON juga meminta kata laluan. Panel ditutup = dikunci semula; kata laluan tidak disimpan dalam localStorage. C++ hanya untuk score maksimum64 event/30s mengikut engine Uno sebenar. Versi panjang boleh dieksport lengkap sebagai JSON/CSV. C++ bukan installer firmware dan tidak menetapkan pin/sudut/kalibrasi.
5. Reset di kanan Metronom menghentikan playback/rakaman, kembali ke awal, memulihkan capture_bpm asal dan mematikan Metronom. Semua not/suntingan/raw timestamp kekal; Kosongkan ialah tindakan berasingan.
6. Data semasa dan rakaman sendiri terakhir disimpan berasingan dalam pelayar. Gunakan Rakaman saya untuk memuatkan rakaman terakhir. Eksport JSON untuk sandaran. Butang Import/Panduan, pengenalan dan kotak bantuan dibuang mengikut gambar pengguna; loader core masih menyemak data simpanan lama.

Sepuluh tajuk dalam keterangan video Aazis tersedia. Empat preset asal (Mary Had a Little Lamb; Rain Rain Go Away; Are You Sleeping?; Jingle Bells) dikekalkan tepat daripada code Music7570da0 pada 80 BPM / 12s. Enam preset HTML tambahan ialah I Love You, I Love You; The Wheels on the Bus; Happy Birthday; Humpty Dumpty; If You're Happy and You Know It; Baby Shark. Pilihan pendek kekal10–15s; pilihan panjang38.6–72.8s menambah bentuk/rangkap/ulangan yang dinyatakan. BPM/durasi sebenar pada kad. Rujuk qa/long-catalog.md untuk susunan dan pitch tambahan. Semua not/audio/timestamp video belum ditranskripsi; tajuk sahaja disahkan dalam keterangan video. Nota petikan/transposisi terdapat pada panel sumber dan eksport JSON; enam preset baharu tidak didakwa berasal daripada firmware. Rujuk qa/catalog.md. Uniform octave transpose dilabel dalam data. Score musically held-duration bukan tempoh mouse ditekan atau resonans bunyi. Had pemain HTML512 event/180s; had eksport C++ Uno64 event/30s kekal. Lapan bar manual dikekalkan; score panjang boleh mempunyai pitch tambahan yang dipaparkan dan dibunyikan tanpa penggantian. MIDI0 ialah rehat. Sasaran10–15s hanya untuk petikan pendek.

## Bukti / batas

Semua bunyi papan maya ialah sintetik. Mikrofon adalah opt-in, analisis tempatan dan tiada raw audio disimpan/dihantar. Pitch dan onset mikrofon ialah anggaran; semak semua not, termasuk '?' yang dipelihara walaupun operator menekan stop sebelum analisis pitch selesai. Ringing/chord/noise/latency peranti boleh menjejaskan bacaan. Tidak ada pengesahan akustik atau ketukan servo fizikal. Permission sebenar dan ketepatan terhadap xylophone Ijamm perlu diuji pada peranti pengguna.

JSON menyimpan raw_capture asal berasingan daripada score yang disunting/quantized. Quantization collisions tidak dibuang; baiki masa/grid sebelum C++. Pengesahan penuh ditetapkan pada eksport/playback, bukan memerangkap edit separa.

## Semakan pembangunan

```sh
node --test tests/*.test.cjs
node tests/cpp_compat.cjs --music-root <checkout-Music-sebenar>
```

Source HTML buildless tanpa font/aset/library luar. App tidak memuatkan data Internet dan tidak bergantung pada backend. Rujuk DESIGN.md, UX-CONTRACT.md dan qa/verification.md.

Kata laluan eksport ialah kunci UI dalam HTML kendiri. Ia bukan kawalan akses pelayan: pemilik fail yang membaca/mengubah JavaScript boleh memintasnya. Tidak sesuai untuk melindungi data sulit; tiada dakwaan perlindungan sedemikian.

## GitHub Pages

Buka https://undead41.github.io/xylo-studio/ dan pilih Permainan di sebelah logo. Repo ini khusus HTML; branch penerbitan xylo/music, folder /(root), Deploy from a branch. .nojekyll mengekalkan penerbitan statik. Untuk kemas kini, ganti index.html dengan HTML keluaran yang diuji, selaraskan VERSION/release.json dan push xylo/music. Kod firmware unDead41/xylophone tidak diubah.
