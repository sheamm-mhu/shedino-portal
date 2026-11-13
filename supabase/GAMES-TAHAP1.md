# SHEGAMES, tahap 1: data, skor, dan peringkat (sisi server)

Tahap ini belum punya tampilan. Isinya hanya lapisan database dan aturan permainan, supaya semua tahap berikutnya (level 3, 2, 1, 4, dasbor, admin, impor dokumen) memakai fondasi yang sama dan aman.

## Cara memasang
1. Jalankan `supabase/schema.sql` bila belum pernah (sudah, bila situs Anda sudah berjalan).
2. Di Supabase: **SQL Editor**, **Create a new snippet**, tempel SELURUH isi `supabase/games.sql`, klik **Run**. Aman diulang; data tidak dihapus.
3. Cek: jalankan `select count(*) from public.game_words;` (hasil 15) dan `select count(*) from public.game_questions;` (hasil 12).

Yang berubah di database: tabel baru berawalan `game_`, kolom `department` di `profiles`, dan fungsi pendaftaran `handle_new_user` yang kini juga menyimpan departemen. Fungsi lain dan tabel Anda yang ada tidak disentuh.

## Aturan yang sudah berlaku di server
- **Skor** dihitung di server. Level 1: % kata benar dikurangi 5 poin per bantuan huruf (maksimal 3). Level 2 dan 3: % benar. Level 4: % bahaya ditemukan dikurangi 5 poin per salah ketuk. Minimum 0.
- **Lulus** bila skor lebih dari atau sama dengan nilai lulus (bawaan 60). Hanya skor lulus yang masuk peringkat.
- **Minggu** memakai minggu ISO (Senin sampai Minggu) di zona Asia/Makassar.
- **Peringkat**: skor terbaik per level per minggu. Admin memilih dasar peringkat (total skor lalu level tertinggi, atau sebaliknya) dan arah seri waktu (tercepat atau terlama). Skor identik berbagi peringkat.
- **Keamanan**: pemain tidak punya akses langsung ke tabel soal, kunci, sesi, atau percobaan. Semua lewat fungsi yang memeriksa akun. Kunci jawaban tidak pernah dikirim sebelum pemain menjawab. Satu sesi aktif per level; batas percobaan per minggu dapat diatur; sesi yang dibiarkan lebih dari 2 jam hangus.
- **Draf dan terbit**: perubahan konten admin tersimpan sebagai draf dan baru berlaku setelah **Terbitkan**, yang memeriksa dulu (minimal 4 kata dengan tata letak yang cocok, 4 rambu, 3 soal, 1 foto bertitik) untuk level yang aktif.

## Asumsi yang saya ambil (ubah bila perlu)
1. Level berurutan dinilai **per minggu**: untuk memainkan level 2 minggu ini, level 1 harus lulus minggu ini.
2. Level yang tidak lulus tidak dihitung ke total peringkat.
3. Waktu penentu seri adalah jumlah durasi percobaan terbaik tiap level (skor sama: durasi tersingkat).
4. Mengetuk titik bahaya yang sudah ditemukan tidak dihukum.
5. Teka-teki silang tidak punya tombol "periksa" di tengah permainan (agar jawaban tidak bisa ditebak berulang); jawaban dinilai saat selesai.
6. NIK memakai kolom `employee_id` yang sudah ada. Peringkat tidak menampilkan NIK maupun email.
7. Data awal hanya 15 kata dan 12 soal. Tata letak TTS awal dan seed rambu/foto menyusul di tahap masing-masing, jadi level 1, 2, dan 4 belum bisa dimainkan sampai tahap itu.

## Fungsi (RPC) untuk tahap berikutnya
Pemain: `game_my_status`, `game_start`, `game_answer`, `game_hint`, `game_tap`, `game_finish`, `game_leaderboard`, `game_settings_public`.
Admin: `game_admin_save_item`, `game_admin_delete_item`, `game_admin_save_layout`, `game_publish`, `game_admin_reset_scores`.

## Uji
`tests/shegames/` berisi 175 pemeriksaan otomatis di Postgres 16 (lihat `tests/shegames/README.md`).
