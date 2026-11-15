# SHEGAMES, tahap 3: pengaturan dan bank soal di panel Admin

## Di mana
Halaman **Admin**, tab **SHEGAMES**. Ada tiga bagian dan satu bilah terbit.

- **Pengaturan**: nama perusahaan, zona waktu, daftar departemen, level aktif, nilai lulus, batas percobaan, urutan level, dasar peringkat, penentu seri, jumlah soal, waktu per soal, dan penalti. Langsung berlaku saat disimpan.
- **Soal pilihan ganda**: daftar soal dengan status (Tayang, Draf baru, Diubah belum terbit, Akan dihapus), tambah, ubah, hapus, pulihkan, cari, **Impor dari dokumen**, dan **Unduh templat Excel**.
- **Peserta & skor**: daftar akun disetujui dengan NIK, departemen, jumlah percobaan, level lulus, terakhir main; hapus skor satu peserta, minggu ini, atau semua (selalu dengan konfirmasi).
- **Bilah terbit**: jumlah perubahan yang belum diterbitkan, tombol **Terbitkan** dan **Batalkan perubahan**.

## Draf dan terbit
Setiap perubahan soal tersimpan sebagai draf. Pemain tetap memakai soal lama sampai Anda menekan **Terbitkan**. Terbit ditolak bila level aktif tidak memenuhi syarat (misalnya kurang dari 3 soal), dengan pesan yang menyebut masalahnya.

## Impor dari dokumen
Berkas dibaca di komputer admin dan tidak diunggah ke server. Yang didukung:
- **Word (.docx)**: format `1. Soal`, `A. ...`, `B. ...`, `Jawaban: B`, `Penjelasan: ...`. Dikenali juga: pilihan sebaris (`A. x  B. y  C. z`), kunci bertanda bintang (`*B. ...`), penomoran otomatis Word, kunci yang dicetak tebal atau disorot, dan tabel berkolom Soal, A, B, C, D, Jawaban, Penjelasan.
- **Excel (.xlsx)** dan **CSV**: kolom Soal (atau Pertanyaan), A sampai E (atau Opsi A...), Jawaban (atau Kunci), Penjelasan (atau Pembahasan). Kunci boleh huruf, angka, atau teks pilihannya.
- **PDF berisi teks** dan **TXT**: format teks seperti Word. PDF hasil scan (gambar) ditolak dengan penjelasan.
- Format lama .doc dan .xls tidak didukung; simpan ulang sebagai .docx atau .xlsx.

Setelah dibaca, muncul **pratinjau yang bisa diedit**. Soal bermasalah (tanpa kunci, pilihan kurang, pilihan kembar, dan lain-lain) ditandai dan tidak ikut disimpan sampai diperbaiki. Pilih **Tambahkan** atau **Ganti semua**, lalu simpan sebagai draf dan **Terbitkan**.

## Perubahan server (jalankan ulang `supabase/games.sql`)
Fungsi admin baru: `game_admin_clear`, `game_admin_discard`, `game_admin_pending`, `game_admin_participants`.
Level yang belum punya konten dinonaktifkan dulu (hanya level 3 aktif) agar penerbitan soal tidak terhalang. `schema.sql` kini juga menyimpan departemen saat pendaftaran, sehingga urutan menjalankan kedua file tidak lagi berpengaruh.

## Belum termasuk
Level 1, 2, 4 beserta pengelolaan kontennya (kata TTS, rambu, foto bahaya), dasbor manajemen, dan ekspor Excel peringkat.
