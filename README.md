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
- `public/assets/data.js`   : isi bawaan dan cadangan (pengaturan, layanan, artikel, dokumen, FAQ, definisi statistik)
- `public/assets/content.js`: memuat konten dari database
- `public/assets/admin-content.js`: editor konten di panel Admin
- `public/assets/site.css`  : gaya situs
- `public/assets/shared.js` : header, footer, tombol WhatsApp, dialog, status akun
- `public/assets/auth.js`   : modul akun (Supabase)
- `public/config.js`        : isi URL dan kunci publik Supabase
- `supabase/schema.sql`     : skema database (jalankan di Supabase SQL Editor)
- `PANDUAN-AKUN.md`         : langkah mengaktifkan akun dan statistik
- `vercel.json`             : konfigurasi Vercel

## Mengubah konten lewat panel Admin (disarankan)
Masuk sebagai admin, klik **Admin**, lalu pilih tab:
- **Papan KPLH**: papan informasi di beranda yang meniru papan di lapangan (bar hijau, kotak kuning Bulan dan Tahun, logo, tabel STATISTIC, OBJECTIVE, MTD, YTD, PTD, dan kolom SHE INFORMATION). Ubah judul, periode, dan semua angka; tambah, hapus, atau pindahkan baris; isi kolom SHE INFORMATION dengan teks atau gambar. Pengunjung dapat mencetak papan dari tombol **Cetak papan**.
- **Kabar & Media**: tambah, edit, hapus artikel (Kabar SHE, Edukasi, Hari Besar, Buletin, Kampanye, atau jenis lain yang Anda tambah di Pengaturan). Artikel bisa diberi lampiran PDF untuk diunduh, misalnya file buletin. Foto sampul diunggah langsung (otomatis dikecilkan), isi artikel disusun dari paragraf dan subjudul.
- **Tab Layanan**: tab pil di atas kartu layanan. Tambah, ganti nama, atur ikon, warna, dan urutan. Jika kolom **Tautan tab** diisi, tab itu menjadi tautan ke halaman lain (bukan penyaring).
- **Layanan**: kartu layanan dengan nama, tab, ikon, deskripsi, **tulisan tombol** (misalnya "Buka Layanan Visitor"), **tautan tombol**, hak akses (Perlu login atau Terbuka), tampil di beranda atau tidak, dan urutan.
- **Dokumen**: unggah file PDF, Word, Excel, atau PowerPoint (maksimal 10 MB) agar tombol Unduh berfungsi.
- **FAQ**: pertanyaan dan jawaban.
- **Pengaturan**: nama perusahaan, alamat, email, WhatsApp, jam layanan, pengumuman tersemat, status sistem, foto tim, **teks halaman depan** (judul besar, kalimat pembuka, bagian Tentang, dan pilar), serta **daftar kategori artikel**. Di sini juga ada **Tampilan bagian atas beranda (hero)**: unggah foto latar, atur gelapnya lapisan di atas foto, dan pilih tata letak **Standar** atau **Terpusat** (judul di tengah, pencarian, dan kartu statistik transparan di atas foto).
- **Statistik SHE** dan **Akun** seperti sebelumnya.

Perubahan langsung tampil di situs tanpa deploy ulang. Pertama kali, klik **Impor data contoh** pada tab yang masih kosong agar isi contoh dari `data.js` tersalin ke database dan bisa Anda edit.
Jika database belum diatur atau tabel kosong, situs memakai isi dari `public/assets/data.js` sebagai cadangan.

## Mengubah konten lewat file (cara lama)
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
