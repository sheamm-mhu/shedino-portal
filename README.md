# SHEDINO - Digital Information SHE

Portal informasi digital Safety, Health & Environment. Situs statis (HTML/CSS/JS) tanpa build step, siap di-deploy ke Vercel. Akun dan statistik memakai Supabase.

## Halaman
| Halaman | Isi |
|---|---|
| `public/index.html` | Beranda: pencarian, papan informasi, statistik SHE, layanan unggulan, kabar, edukasi, dokumen, tentang, FAQ, kontak |
| `public/layanan.html` | Semua layanan dalam 3 kelompok: Layanan, Pengetahuan, Analitik |
| `public/media.html` | Kabar SHE dan Edukasi: tab, filter kategori dan tahun, pencarian, tagar, penomoran halaman |
| `public/artikel.html` | Detail artikel (`?id=...`), artikel terkait, tombol bagikan |
| `public/masuk.html` | Masuk, daftar, dan atur ulang kata sandi |
| `public/admin.html` | Panel Admin: setujui akun, atur peran, isi statistik SHE |

## Struktur file
- `public/assets/data.js`   : **semua konten** (pengaturan, layanan, artikel, dokumen, FAQ, definisi statistik)
- `public/assets/site.css`  : gaya situs
- `public/assets/shared.js` : header, footer, tombol WhatsApp, dialog, status akun
- `public/assets/auth.js`   : modul akun (Supabase)
- `public/config.js`        : isi URL dan kunci publik Supabase
- `supabase/schema.sql`     : skema database (jalankan di Supabase SQL Editor)
- `PANDUAN-AKUN.md`         : langkah mengaktifkan akun dan statistik
- `vercel.json`             : konfigurasi Vercel

## Mengubah konten
Semua teks yang sering berubah ada di **`public/assets/data.js`**, tidak perlu menyentuh desain:
- `CONFIG`    : nama, perusahaan, alamat, email, WhatsApp, jam layanan, pengumuman tersemat, foto tim
- `STATUS`    : status sistem di papan informasi
- `SERVICES`  : layanan (isi `url` agar tombol membuka layanan sebenarnya)
- `MEDIA`     : kabar dan edukasi (tambahkan `image: "media/foto.jpg"` untuk memakai foto sendiri)
- `DOCS`      : dokumen (isi `url` untuk tautan unduhan)
- `FAQ`       : pertanyaan umum

Foto sendiri: buat folder `public/media/` lalu taruh gambar di sana.

## Deploy ke Vercel
1. Unggah seluruh isi folder ini ke repository GitHub.
2. Di vercel.com pilih Add New > Project, impor repository, Framework Preset: Other, lalu Deploy.
3. Setiap perubahan di GitHub otomatis dideploy ulang.

## Akun dan statistik
Ikuti `PANDUAN-AKUN.md`. Tanpa itu situs tetap tampil normal, tetapi tombol Masuk dan statistik menampilkan pesan belum dikonfigurasi.

## Catatan
- Isi contoh (artikel, layanan, dokumen) hanya percobaan. Ganti dengan data Anda.
- Pengecekan login di halaman web adalah pengaturan tampilan. Layanan yang menyimpan data sensitif harus punya login sendiri.
