# SHEGAMES, tahap 5: dasbor manajemen dan ekspor Excel

## Di mana
Halaman **Admin**, tab **SHEGAMES**, tab **Dasbor** (tab pertama, dibuka lebih dulu). Hanya admin yang bisa membukanya, karena memuat NIK dan data semua pemain.

## Isi dasbor
- **Periode**: Mingguan (pilih dari 12 minggu terakhir), Bulanan (12 bulan terakhir, batas bulan mengikuti zona waktu di pengaturan), atau Semua waktu.
- **KPI**: peserta aktif dan persentasenya dari akun terdaftar, rata-rata skor (skor terbaik tiap pemain per level), jumlah yang lulus semua level aktif, skor tertinggi (total skor lulus), dan level aktif.
- **Penyelesaian per level**: jumlah pemain, percobaan, yang lulus, tingkat lulus, dan rata-rata skor.
- **Rata-rata skor per departemen**: peserta dari akun terdaftar tiap departemen (partisipasi) dan rata-rata skornya. Akun tanpa departemen dikelompokkan sebagai "(belum diisi)".
- **5 topik paling sering salah**: soal pilihan ganda, rambu, kata TTS, atau titik bahaya yang paling sering dijawab salah. Butir yang sudah dihapus tetap terhitung dengan label "sudah dihapus".
- **Peringkat lengkap**: seluruh pemain dengan NIK, departemen, skor tiap level, total, dan waktu.

## Ekspor Excel
Tombol **Ekspor Excel** membuat satu berkas .xlsx berisi lima lembar: Ringkasan, Peringkat (dengan NIK; skor sebagai angka), Per departemen, Per level, dan Topik sering salah. Berkas dibuat di komputer Anda dari data yang sedang tampil, jadi periode yang dipilih ikut terekspor. Nama berkas memuat periodenya.

## Cetak
Tombol **Cetak** membuka dialog cetak browser. Saat dicetak, menu, tab, dan tombol disembunyikan; yang tercetak hanya judul periode, KPI, dan tabel-tabel dasbor.

## Cara memasang
Jalankan ulang seluruh `supabase/games.sql` di Supabase (menambah fungsi `game_admin_dashboard`), lalu unggah isi folder `shedino` ke GitHub seperti biasa.

## Catatan definisi
- "Peserta aktif" adalah akun yang menyelesaikan minimal satu percobaan pada periode itu (lulus atau tidak).
- "Rata-rata skor" menghitung skor terbaik tiap pemain per level, termasuk yang belum lulus. Peringkat dan "skor tertinggi" hanya menghitung skor yang lulus.
- Hanya level yang sedang aktif yang dihitung.
