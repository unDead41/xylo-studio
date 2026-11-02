# Branch dan chat

Keputusan Ijamm pada 2 November 2026. Nama branch tepat ialah nama dalam jadual.

| Branch | Nama chat | Tugas |
| --- | --- | --- |
| `main` | xylo studio - main | Sumber pembangunan lengkap milik Ijamm; penerbitan laman daripada main. |
| `share` | xylo studio - share | HTML kendiri dan panduan ringkas untuk agihan; kemas kini apabila diminta. |
| `audit` | xylo studio - audit | Audit branch, regression, integrasi ke main dan versioning. |
| `architecture` | xylo studio - architecture | Struktur kod dan SOR projek digital. |
| `tutorial` | xylo studio - tutorial | Panduan setup dan bermain; kemas kini hanya apabila diminta. |
| `music` | xylo studio - music | Katalog lagu, pitch, tick, tempo dan eksport JSON/CSV. |
| `gameplay` | xylo studio - gameplay | Peraturan permainan, kesukaran, skor, kombo, nyawa dan penilaian. |
| `ui` | xylo studio - ui | Susun atur, akses papan kekunci, sentuhan dan paparan responsif. |

`main` bukan chat pekerja. Setiap chat semak branch/ref, working tree, SHA asas, SOR dan handoff sebelum bekerja. Gunakan folder sendiri. Jangan menukar checkout chat lain.

`share` ialah snapshot agihan, bukan branch input integrasi; jangan merge share kembali ke main. `tutorial` dan `share` tidak menerima kemas kini kandungan automatik. Penciptaan awal branch menggunakan sumber yang telah disemak; pembekuan bermula selepas migrasi ini.

Audit mengesan perubahan yang belum diterima, menyemak keserasian kod/API, menjalankan ujian pada calon gabungan dan hanya push main apabila Ijamm mengarahkannya. Permintaan push untuk branch kerja tidak sendiri bermaksud push main. Jika remote berubah, baca diff, integrasikan secara terkawal dan uji semula; tiada force push.

Versi projek dalam `VERSION` menggunakan `vX.XX.X`, diselaraskan dengan changelog dan metadata keluaran. Nombor versi hanya dinaikkan bagi keluaran yang diterima, bukan setiap commit audit. Laporan ujian menyatakan SHA atau hash sumber yang diuji.

Semua branch lama dalam migrasi dipelihara sebagai parent sejarah main sebelum nama lamanya dihentikan. Fail sejarah ialah bukti lama, bukan keputusan semasa.
