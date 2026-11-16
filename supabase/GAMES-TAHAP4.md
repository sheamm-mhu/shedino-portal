# SHEGAMES, tahap 4: level 1, 2, dan 4 beserta pengelolaannya di Admin

Sekarang keempat level bisa dimainkan dan dikelola dari panel Admin.

## Di panel Admin (tab SHEGAMES)
Tab-tabnya: **Umum**, **1 Teka-teki silang**, **2 Tebak rambu**, **3 Pilihan ganda**, **4 Tebak bahaya**, **Peserta & skor**, ditambah bilah **Terbitkan** dan **Batalkan perubahan**.

- **Umum**: nama perusahaan, zona waktu, daftar departemen, level aktif, nilai lulus, batas percobaan, urutan level, dasar peringkat, penentu seri.
- **Setiap tab level** punya kartu **Pengaturan level** sendiri (dan kotak "Level aktif"):
  - Level 1: maksimal bantuan huruf, penalti per bantuan.
  - Level 2: jumlah soal per permainan, waktu per soal.
  - Level 3: jumlah soal per permainan, waktu per soal.
  - Level 4: batas waktu, penalti salah ketuk.
  Jumlah soal dipakai bersama oleh level 2 dan 3. Pengaturan level langsung berlaku tanpa Terbitkan.

### Level 1, teka-teki silang
- Daftar kata dan petunjuk: tambah, ubah, hapus, pulihkan, cari, **Impor dari dokumen** (.docx, .xlsx, .csv, .pdf, .txt) dengan pratinjau yang bisa diedit, mode Tambahkan atau Ganti semua, dan **Unduh templat Excel**. Format teks: `KATA | petunjuk` per baris (juga `1. Kata - petunjuk` dan `kata: petunjuk`), atau tabel berkolom Jawaban dan Petunjuk. Kata yang sudah ada ditandai kembar.
- **Tata letak kotak dibuat otomatis**: setiap daftar kata berubah, kotak disusun ulang (susunan sama untuk semua pemain). Tombol **Buat tata letak otomatis** dan **Acak ulang** menampilkan pratinjau untuk dipilih lalu **Simpan**. Kata yang tidak punya huruf yang sama dengan kata lain tidak bisa disilangkan dan diberi tahu agar diubah atau dihapus. Terbit ditolak bila tata letak belum memuat semua kata.

### Level 2, tebak rambu
- **Unggah banyak gambar rambu sekaligus** (JPG, PNG, WebP; SVG tidak diizinkan). Gambar dikecilkan di komputer Anda menjadi WebP maksimal 640 px. Nama berkas menjadi nama rambu, dan kategori (Larangan, Peringatan, Wajib, Kondisi aman, Pemadam api) ditebak dari katanya. Semua bisa diedit di pratinjau sebelum disimpan. Nama kembar ditandai.
- Daftar rambu berupa kartu: ubah (nama, kategori, arti, ganti gambar), hapus, pulihkan.

### Level 4, tebak bahaya
- **Tambah foto bahaya**: unggah foto (dikecilkan maksimal 1600 px). Klik foto untuk menambah titik, seret untuk memindah, atau pilih titik lalu gunakan tombol panah. Untuk tiap titik isi nama bahaya, risiko, pengendalian, dan atur ukuran area ketuk dengan penggeser (lingkaran di foto ikut berubah, sama dengan yang dipakai saat bermain).
- Ubah titik pada foto yang sudah tayang, hapus, atau pulihkan.

## Draf dan terbit
Semua perubahan konten (soal, kata, rambu, foto, tata letak) berupa **draf** sampai **Terbitkan**. Mengubah sebuah butir kembali ke isi semula, atau menekan Pulihkan setelah menghapus, membersihkan penanda perubahan.

## Di sisi pemain (`shegames.html`)
- **Level 1**: kotak isian dengan nomor, petunjuk mendatar dan menurun, bar petunjuk aktif, navigasi keyboard (panah, Spasi atau Enter ganti arah, Backspace, Tab pindah kata), bantuan huruf dari server (kotak terkunci berwarna kuning), huruf yang diketik tersimpan bila halaman dimuat ulang. Di ponsel, mengetuk kotak memunculkan papan ketik.
- **Level 2**: gambar rambu dengan 4 pilihan nama; setelah menjawab tampil nama dan arti rambu.
- **Level 4**: ketuk foto untuk menandai bahaya (penanda bernomor, kartu risiko dan pengendalian); salah ketuk menampilkan tanda silang dan penalti; bisa dengan papan ketik (bidik dengan panah, Enter menandai); penghitung waktu bila diatur; sesi bisa dilanjutkan; hasil menampilkan semua titik, yang terlewat ditandai.
- Aturan berurutan bawaan tetap berlaku: lulus level 1 untuk membuka level 2, dan seterusnya. Admin bisa memilih "Bebas" di tab Umum.

## Data contoh yang ikut terpasang
8 rambu (gambar SVG buatan sendiri), 1 ilustrasi area gudang dengan 5 titik bahaya, tata letak untuk 15 kata TTS bawaan. Untuk instalasi lama (level 3 saja), data ini ditambahkan sekali saat `games.sql` dijalankan, dan keempat level diaktifkan hanya bila pengaturan level masih bawaan. Rambu dan foto yang Anda hapus tidak dimasukkan ulang.

## Cara memasang
1. Supabase, SQL Editor: jalankan seluruh `supabase/schema.sql`, lalu seluruh `supabase/games.sql` (aman diulang).
2. GitHub: unggah isi folder `shedino` (tanpa `config.js`), tunggu Vercel **Ready**.
3. Admin, tab SHEGAMES: periksa tiap tab level, ganti konten bila perlu, lalu **Terbitkan**.

## Catatan
- Gambar yang diunggah disimpan di penyimpanan `site-media` (folder `games/signs` dan `games/scenes`). Gambar lama yang tidak dipakai lagi tidak dihapus otomatis.
- Foto contoh area gudang adalah ilustrasi; ganti dengan foto asli area kerja Anda.
- PDF hasil scan tidak bisa dibaca (tanpa OCR dan tanpa AI, sesuai keputusan).
