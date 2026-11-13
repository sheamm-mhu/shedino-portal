# SHEGAMES, tahap 2: tampilan, level 3, dan peringkat (mingguan, bulanan, semua waktu)

## Yang baru
- Halaman **`shegames.html`** dengan sidebar navy berlogo SHEGAMES (perisai keselamatan + stik permainan; empat tombolnya memakai warna empat level). Warna, huruf, dan tombol mengikuti situs SHEDINO. Di ponsel, menu pindah ke bilah bawah.
- **Lobi**: sapaan, ringkasan minggu ini (level lulus, total skor, peringkat), dan empat kartu level berbentuk rambu: persegi (teka-teki silang), segitiga (rambu), lingkaran (pilihan ganda), segi delapan (bahaya). Status tiap kartu: Main, Lanjutkan, Lulus, Terkunci, Belum tersedia, atau Segera hadir.
- **Level 3 (pilihan ganda)** bisa dimainkan: soal teracak, penghitung waktu, umpan balik benar/salah dan penjelasan dari server, jawab dengan klik atau tombol 1-4/A-D, layar hasil dengan skor, status lulus, dan skor terbaik minggu ini. Sesi yang terputus bisa dilanjutkan.
- **Peringkat** dengan filter **Mingguan** (12 minggu terakhir), **Bulanan** (12 bulan terakhir), dan **Semua waktu**, plus filter departemen dan pencarian nama. Ada podium 3 besar, posisi Anda, dan tabel skor per level.
- **Cara main** berisi aturan yang mengikuti pengaturan admin.
- Pemain yang belum punya departemen diminta mengisinya saat pertama membuka SHEGAMES (bisa diubah lewat ikon pensil).
- Menu **SHEGAMES** ditambahkan ke header situs.

## Perubahan server (jalankan ulang `supabase/games.sql`)
- `game_leaderboard` menerima `p_month` untuk peringkat bulanan (batas bulan memakai WITA). Skor bulanan = skor terbaik tiap level di bulan itu.
- `game_set_department` agar pemain mengisi departemennya sendiri. Daftar departemen awal: Produksi, Plant, Engineering, SCM-FAW, HCGA, SHE, Office (bisa diubah admin).
- Level berurutan tidak lagi terkunci oleh level yang belum punya konten. Contoh: selama level 1 dan 2 belum punya soal, level 3 tetap bisa dimainkan.

## Cara memasang
1. Supabase: **SQL Editor**, **Create a new snippet**, tempel seluruh isi `supabase/games.sql`, **Run** (aman diulang).
2. GitHub: unggah isi folder `shedino` (tanpa `config.js`), lalu tunggu Vercel **Ready**.
3. Buka `https://situs-anda/shegames` dan masuk dengan akun yang sudah disetujui.

## Belum termasuk (tahap berikutnya)
Level 2, 1, dan 4 (tampil "Belum tersedia" sampai tahapnya), dasbor manajemen dan ekspor Excel, panel admin SHEGAMES, dan impor dokumen.
