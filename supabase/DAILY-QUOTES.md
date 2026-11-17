# Daily Quotes: pembuat poster dengan persetujuan admin

## Cara kerja singkat
1. Di artikel "Daily Safety Quotes" ada tombol **Buat Daily Quotes** yang membuka `daily-quotes.html` (juga ada di menu Media).
2. Pengunjung (tanpa akun pun bisa) memilih templat, mengunggah foto, mengisi nama, jabatan, dan kata-kata, lalu **mengunduh** gambarnya atau **mengirim** agar tayang di galeri.
3. Kiriman masuk antrean. **Tidak ada yang tayang di galeri sebelum Anda setujui** di Admin, tab Daily Quotes.

Latar foto dihapus otomatis **di browser pengunjung** (MediaPipe, gratis, Apache 2.0). Penghapusan dilakukan dua tahap (orang dipotong kasar, lalu dipotong ulang pada area sekitarnya agar tepinya tajam), serpihan terpisah dibuang, lubang kecil ditutup, dan tepi dirapikan mengikuti garis tepi foto asli. Foto tidak dikirim ke server mana pun kecuali poster jadi yang sengaja dikirim. Pertama kali dipakai, browser memuat mesinnya sekitar 6 MB; berikutnya lebih cepat.

## Cara memasang
1. Supabase, **SQL Editor**: jalankan seluruh `supabase/daily-quotes.sql` (setelah `schema.sql`). Aman diulang. Ini membuat tabel templat, kiriman, dan pengaturan, bucket penyimpanan `dq-submissions`, kolom `cta` pada artikel, dan satu templat contoh.
2. GitHub: unggah isi folder `shedino` seperti biasa. Pastikan ikut terunggah: `daily-quotes.html`, folder `assets/dq`, dan folder `assets/vendor/mediapipe` (berisi mesin hapus latar, total sekitar 12 MB).
3. Tunggu Vercel **Ready**, lalu muat ulang dengan Ctrl+Shift+R.

Tanpa langkah 1, halaman pembuat menampilkan pesan bahwa fitur belum dipasang, dan fitur lain tetap normal.

## Ajakan di beranda
Di bagian **Kabar SHE** pada beranda, tepat di bawah judulnya, tampil ajakan "Apakah Anda ingin wajah Anda tampil di sini?" lengkap dengan tombol **Buat Daily Quotes** yang langsung membuka pembuat poster. Ajakan ini hanya tampil bila `daily-quotes.sql` sudah dijalankan dan fitur sedang aktif (Admin, Daily Quotes, Pengaturan); bila fitur dimatikan, ajakannya otomatis hilang.

## Tombol di artikel
Di Admin, Kabar & Media, ubah artikelnya, lalu pilih **Tombol "Buat Daily Quotes"**:
- **Otomatis** (bawaan): tombol muncul bila judul memuat "Daily Safety Quotes".
- **Selalu tampilkan**: untuk artikel lain.
- **Jangan tampilkan**.

## Mengganti templat (Admin, Daily Quotes, Templat)
Templat adalah gambar latar mentahan. Isinya hanya latar (judul, logo, hiasan); orang dan teks yang akan diganti **tidak** ikut digambar.
1. **Tambah templat**, isi nama, unggah **latar mentahan** (JPG, PNG, atau WebP; disarankan 1080 x 1350). Ukuran poster mengikuti gambar ini.
2. Bila desain punya bagian yang harus tampil **di depan orang** (misalnya kotak keterangan atau footer), unggah sebagai **lapisan depan**: PNG transparan dengan ukuran yang sama dengan latar. Orang akan berada di antara latar dan lapisan depan.
3. Atur kotak di panggung:
   - Kotak **biru** = tempat orang. Orang diletakkan rata bawah dan di tengah kotak, tingginya mengikuti kotak.
   - Kotak **hijau** = teks. Seret untuk memindah, tarik sudut kanan bawah untuk mengubah ukuran. Isian angka di sebelah kanan untuk ketepatan. Papan ketik: panah menggeser, Ctrl + panah mengubah ukuran, Shift = lompatan besar.
   - Untuk tiap kotak teks atur nama isian, jenis (Nama, Jabatan, Kata-kata, Tanggal, atau Lainnya), huruf, ukuran, warna, perataan, maksimal baris, miring, huruf besar, dan bayangan. Maksimal 8 kotak teks.
4. **Simpan templat**. Templat aktif langsung tersedia bagi pengunjung. Tombol panah mengatur urutan, dan templat pertama menjadi pilihan utama.

Teks otomatis dikecilkan agar muat; bila tetap tidak muat, dipotong dan pengunjung diberi tahu. Untuk ganti desain bulanan, cukup tambah templat baru atau ubah yang ada.

> Templat contoh yang terpasang adalah ilustrasi buatan sendiri. Unggah latar mentahan resmi perusahaan Anda lewat langkah di atas, lalu nonaktifkan atau hapus templat contoh.

## Persetujuan (Admin, Daily Quotes, Persetujuan)
- Tab **Menunggu**, **Disetujui**, **Ditolak** dengan jumlahnya. Lencana di tab Admin menunjukkan jumlah yang menunggu.
- Klik gambar untuk melihat ukuran besar. **Setujui** langsung menayangkan di galeri. **Tolak** boleh disertai alasan (hanya terlihat admin). **Batalkan tayang** mengembalikan ke antrean. **Hapus** menghapus kiriman dan berkas gambarnya.
- Tiap kartu menunjukkan pengirim, apakah memakai akun SHEDINO, dan kode singkat perangkat untuk membantu mengenali kiriman beruntun.

## Pengaturan
- **Fitur aktif**: bila mati, pembuat menampilkan pesan dan pengiriman ditolak.
- **Pengirim wajib login**: bila nyala, hanya akun yang sudah Anda setujui yang bisa mengirim. Aktifkan bila mulai ada kiriman sembarangan.
- **Batas antrean menunggu** (bawaan 100) dan **batas kiriman per perangkat per hari** (bawaan 5).
- **Pesan untuk pengirim**.

## Keamanan
Pengiriman terbuka untuk umum, jadi ada pagar berlapis:
- Pengunjung tidak menulis langsung ke tabel; hanya lewat fungsi `dq_submit` yang memeriksa panjang isian, membuang karakter kendali, memastikan gambar benar-benar ada di bucket kita dan di jalur yang benar, serta menerapkan batas antrean dan batas harian.
- Bucket kiriman hanya menerima JPEG, WebP, atau PNG maksimal 1 MB, hanya ke folder `p/`; pengunjung tidak bisa melihat daftar atau menghapus berkas.
- Kolom pribadi (token perangkat, pengirim, akun) tidak bisa dibaca pengunjung, bahkan untuk kiriman yang disetujui.
- Ada isian jebakan untuk bot, dan pengirim wajib mencentang izin dari orang pada foto.
- Semua teks kiriman ditampilkan dengan pengamanan XSS.

Batas harian per perangkat memakai token di browser, jadi hanya menahan pengguna biasa, bukan penyerang yang gigih. Untuk itu ada pengaturan wajib login.

## Teks yang panjang
Teks otomatis menyesuaikan kotaknya, dengan urutan: (1) kata utuh, huruf dikecilkan sedikit bila perlu; (2) bila ada kata yang tetap terlalu panjang (misalnya tanpa spasi), kata itu **dipatahkan per huruf dan turun ke baris berikutnya**; (3) bila tetap tidak muat, teks dipotong dan pengunjung diberi tahu. Jumlah baris yang boleh dipakai ditentukan **Maksimal baris** dan **Tinggi** kotak di editor templat; editor memberi peringatan bila tingginya tidak cukup untuk jumlah baris yang diminta. Untuk kotak "Kata-kata", gunakan Maksimal baris 3 sampai 4 dan Tinggi sekitar 7% atau lebih.

## Menghaluskan bagian bawah orang
Penggeser **Haluskan bagian bawah** (di langkah unggah foto) membuat bagian bawah orang memudar halus, sehingga tidak ada garis potong kasar di atas kotak keterangan. Bawaannya 35; 0 berarti tanpa pemudaran.

## Merapikan hasil potong latar
Bila masih ada sisa latar atau bagian orang yang ikut terpotong, pengunjung punya tiga alat di bawah foto:
- **Rapikan tepi** (penggeser): ke kanan merapatkan tepi (membuang pinggiran latar), ke kiri melebarkan (bila orang ikut terpotong).
- **Hapus sisa** (kuas): gosok bagian latar yang masih tersisa pada pratinjau.
- **Pulihkan** (kuas): gosok bagian orang yang ikut terhapus; isi foto asli di area itu dikembalikan.
- **Batalkan coretan** menghapus semua coretan kuas sekaligus. Ukuran kuas bisa diatur; lingkaran kuas terlihat mengikuti penunjuk.
Di ponsel, pilih alatnya dulu (supaya layar tidak ikut bergeser saat menggosok). Foto PNG yang sudah tanpa latar juga bisa dirapikan dengan alat yang sama.

## Batasan yang perlu diketahui
- Hasil potong latar bagus untuk foto potret biasa, tetapi tidak sempurna pada latar ramai, helai rambut halus, atau benda yang menempel pada orang (misalnya tiang atau peralatan); untuk itu ada alat perapi di atas. Model yang dipakai kecil agar muat di situs dan jalan di ponsel, jadi bukan setajam layanan potong latar berbayar. Bila orang tidak terdeteksi, pengunjung diberi tahu dan foto dipakai utuh di dalam bingkai. Pengunjung juga bisa mengunggah PNG tanpa latar yang dipakai apa adanya.
- Perangkat lama atau murah bisa lambat saat menghapus latar (beberapa detik).
- Font Bricolage Grotesque dan Figtree dimuat dari Google Fonts; tanpa internet, poster memakai font cadangan.
- Pengujian memakai Chromium dan Postgres lokal. Belum diuji di Supabase asli, iPhone, atau Android sungguhan.

## Lisensi pihak ketiga
Folder `assets/vendor/mediapipe` berisi MediaPipe Selfie Segmentation dari Google, berlisensi Apache 2.0 (lihat `LICENSE.txt` di folder itu).
