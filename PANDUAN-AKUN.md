# Panduan Mengaktifkan Akun SHEDINO (Supabase)

Sistem akun memakai **Supabase** (gratis untuk skala kecil). Alurnya:
karyawan daftar sendiri atau dibuatkan admin, akun baru berstatus **Menunggu**,
admin menyetujui di halaman `/admin`, lalu layanan internal terbuka.
Ada dua peran: **Karyawan** dan **Admin**.

## 1. Buat project Supabase
1. Buka **supabase.com**, klik *Start your project*, lalu masuk dengan GitHub.
2. Klik **New project**. Isi nama (misalnya `shedino`), buat *Database Password* (simpan), pilih region terdekat (misalnya Singapore), lalu **Create new project**. Tunggu 1-2 menit.

## 2. Jalankan skema database
1. Di Supabase buka **SQL Editor** > **New query**.
2. Salin seluruh isi file `supabase/schema.sql`, tempel, lalu klik **Run**.
   Ini membuat tabel `profiles`, aturan keamanan (RLS), dan pemicu yang otomatis membuat profil berstatus *pending* untuk setiap akun baru.

## 3. Isi konfigurasi situs
1. Di Supabase buka **Project Settings > API**.
2. Salin **Project URL** dan kunci **anon / publishable**.
3. Buka `public/config.js` lalu isi:
   ```js
   window.SHEDINO_CONFIG = {
     SUPABASE_URL: "https://xxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJ..."
   };
   ```
   Kunci anon aman ditaruh di sini. **Jangan** memasukkan `service_role` key.

## 4. Atur alamat situs di Supabase
Buka **Authentication > URL Configuration**:
- **Site URL**: alamat situs Anda, misalnya `https://shedino.vercel.app`
- **Redirect URLs**: tambahkan `https://shedino.vercel.app/**`
  (tambahkan juga domain sendiri jika sudah dipasang)

Tanpa ini, tautan konfirmasi email dan reset kata sandi tidak akan kembali ke situs Anda.

## 5. Unggah ulang ke GitHub
Ganti file di repository dengan versi terbaru (terutama `public/config.js`).
Vercel akan men-deploy ulang otomatis.

## 6. Buat admin pertama
1. Buka situs Anda, klik **Masuk > Daftar**, lalu daftar dengan email Anda.
2. Di Supabase **SQL Editor**, jalankan (ganti emailnya):
   ```sql
   update public.profiles
     set role = 'admin', status = 'approved'
     where email = 'email-anda@perusahaan.co.id';
   ```
3. Muat ulang situs lalu masuk. Tautan **Admin** muncul di menu.

Setelah itu semua pengelolaan dilakukan lewat halaman **Admin**.

## Mengisi statistik SHE
Kartu statistik di beranda (insiden, AFR, cidera, dan lainnya) terkunci untuk pengunjung umum dan hanya tampil untuk akun yang sudah disetujui.
1. Masuk sebagai admin, klik **Admin**, lalu pilih tab **Statistik SHE**.
2. Isi **Nilai** (bebas, misalnya `0`, `0,35`, atau `92`), **Satuan**, dan **Keterangan periode** (misalnya `YTD 2026`).
3. Klik **Simpan** pada baris yang diubah. Angka langsung tampil di beranda untuk akun yang disetujui.

Jika tab Statistik kosong, jalankan ulang seluruh isi `supabase/schema.sql` di SQL Editor (aman dijalankan berulang, angka yang sudah diisi tidak ditimpa).
Daftar indikator dan warnanya diatur di `public/assets/data.js` pada `STAT_DEFS`. Tambah indikator baru dengan menambah baris di `STAT_DEFS` dan satu baris di tabel `she_stats`.

## Mengelola konten lewat panel Admin
Artikel, layanan, dokumen, FAQ, pengaturan, dan foto diedit langsung di situs.
1. Jalankan ulang seluruh isi `supabase/schema.sql` di SQL Editor (membuat tabel konten dan penyimpanan foto bernama `site-media`). Aman diulang.
2. Masuk sebagai admin, klik **Admin**, lalu pilih tab **Kabar & Edukasi**, **Layanan**, **Dokumen**, **FAQ**, atau **Pengaturan**.
3. Pada tab yang masih kosong, klik **Impor data contoh** sekali agar isi contoh tersalin ke database.
4. Klik **Tambah** atau **Edit**. Untuk foto, klik **Choose File** lalu pilih gambar. Foto otomatis dikecilkan dan diunggah. Klik **Simpan**.

Tab dan kartu layanan:
- Tab **Tab Layanan** mengatur tab pil di atas kartu (misalnya Layanan, Pengetahuan, Analitik). Isi kolom **Tautan tab** bila ingin tab itu menuju halaman atau situs lain, bukan menyaring kartu.
- Tab **Layanan** mengatur kartunya. Kolom **Tulisan pada tombol** dan **Tautan tombol** menentukan teks dan tujuan tombol di kartu.
- Jika nama tab diganti, layanan di tab itu ikut pindah otomatis. Jika tab dihapus, layanannya tampil sebagai kelompok tambahan sampai dipindahkan.
- Di tab **Pengaturan** Anda juga mengubah teks halaman depan. Gunakan `{nama}`, `{tagline}`, dan `{perusahaan}` bila ingin nilai otomatis disisipkan.

Membagikan artikel ke WhatsApp:
- Buka artikel, klik **Bagikan ke WhatsApp**. Di ponsel, gambar sampul dikirim bersama keterangannya. Di iPhone tertentu WhatsApp bisa membuang teks keterangan; bila itu terjadi, klik **Salin keterangan** lalu tempel sendiri di bawah gambar.
- Untuk memposting di Saluran WhatsApp: simpan gambar sampul, klik **Salin keterangan**, lalu tempel di kolom keterangan gambar.
- Bila yang dibagikan hanya tautan (klik **Salin tautan**), WhatsApp menampilkan pratinjau berisi judul, ringkasan, dan gambar artikel. Tampilan akhirnya (ukuran dan pemotongan gambar, panjang teks) diatur oleh WhatsApp sendiri, jadi bisa berbeda dari kiriman gambar biasa.
- Pastikan folder `api` dan file `vercel.json` ikut diunggah ke GitHub. Tanpa itu, tautan pratinjau `/s/...` tidak berfungsi; ubah `sharePreview` menjadi `false` di `public/assets/data.js` sebagai gantinya.

Video di artikel (Kabar, Edukasi, Hari Besar, Buletin, Kampanye):
- Di tab **Kabar & Media**, pada formulir artikel ada kolom **Video (opsional)**. Ada dua cara:
  1. **Unggah file video**: klik **Choose File**, pilih video MP4 (disarankan), WebM, atau MOV. Ukuran maksimal **50 MB**. Bilah kemajuan tampil selama mengunggah, jangan menutup halaman sampai muncul tulisan hijau Berhasil. Lalu klik **Simpan**.
  2. **Tempel tautan**: YouTube, Vimeo, atau Google Drive (video dibuka lewat pratinjau Drive). Cara ini paling cocok untuk video panjang atau besar.
- Jalankan ulang seluruh isi `supabase/schema.sql` agar penyimpanan menerima video (menambah jenis file video dan batas 50 MB).
- Batas 50 MB mengikuti paket gratis Supabase (Project Settings, Storage). Kalau video lebih besar, kecilkan dulu (misalnya dengan HandBrake atau pengaturan resolusi di aplikasi kamera) atau unggah ke YouTube dengan mode **Tidak publik** lalu tempel tautannya.
- Video dari iPhone berformat MOV/HEVC kadang tidak bisa diputar di Android. Agar aman di semua perangkat, rekam dengan pengaturan **Paling Kompatibel** di iPhone, atau ubah menjadi MP4 (H.264).
- Paket gratis Supabase membatasi lalu lintas data sekitar 5 GB per bulan. Video yang sering ditonton banyak orang menghabiskan kuota dengan cepat, sehingga tautan YouTube lebih hemat.
- Foto sampul artikel dipakai sebagai gambar awal (poster) pemutar. Kartu artikel yang memiliki video ditandai ikon putar dan tag Video.

Papan Informasi KPLH:
- Buka tab **Papan KPLH**. Ubah judul, bulan, tahun, dan angka pada tabel, lalu klik **Simpan papan**. Papan di beranda langsung diperbarui.
- Gunakan **+ Tambah baris**, **Hapus**, dan tombol panah untuk mengatur baris. **Kembalikan ke isi contoh** mengisi ulang tabel dengan data bawaan (baru tersimpan setelah Simpan papan).
- Kolom **SHE INFORMATION** boleh dibiarkan kosong seperti papan asli, atau diisi teks dan gambar.
- Papan ini tampil untuk semua pengunjung. Pengunjung bisa mencetaknya dari tombol **Cetak papan** (kertas A4 mendatar).

Jenis konten (Hari Besar, Buletin, Kampanye, dan lainnya):
- Buka tab **Pengaturan**, bagian **Jenis konten**. Tambah, ganti nama, atau hapus jenis. Jenis tampil sebagai tab di halaman Kabar & Media dan di menu **Media**.
- Saat membuat artikel di tab **Kabar & Media**, pilih **Jenis**-nya. Kolom **Lampiran** dipakai untuk mengunggah PDF (misalnya file buletin) yang muncul sebagai tombol **Unduh lampiran**.
- Setelah pembaruan ini, jalankan ulang seluruh isi `supabase/schema.sql` (agar kolom lampiran dibuat dan jenis konten tidak lagi dibatasi).

Foto latar beranda:
- Buka tab **Pengaturan**, bagian **Tampilan bagian atas beranda (hero)**.
- Pilih **Tata letak**, klik **Choose File** pada **Foto latar**, lalu atur **Gelapnya lapisan di atas foto** (20 sampai 90). Klik **Simpan pengaturan**.
- Pakai foto lebar (landscape), minimal 1600 piksel. Foto otomatis dikecilkan saat diunggah. Foto yang terang atau ramai memerlukan lapisan lebih gelap agar tulisan terbaca.
- Untuk menghapus foto latar, klik **Hapus foto** lalu **Simpan pengaturan**.

Catatan:
- Foto dan file tersimpan di Supabase Storage (bucket `site-media`, paket gratis 1 GB). Menghapus atau mengganti foto di formulir tidak menghapus file lamanya dari penyimpanan. Bersihkan lewat menu **Storage** di Supabase bila perlu.
- Artikel atau dokumen dengan kotak **Tayangkan di situs** tidak dicentang berstatus draf dan hanya terlihat oleh admin.
- Jika seluruh data sebuah tab dihapus, situs kembali memakai isi contoh dari `data.js`.
- Hanya alamat yang diawali `https://` atau alamat di dalam situs yang diterima pada kolom alamat layanan dan file.

## Memperbarui dari versi lama
Jika Anda sudah punya project Supabase dari versi sebelumnya, jalankan ulang `supabase/schema.sql` agar tabel statistik dibuat. Akun yang sudah ada tidak terpengaruh. Saat mengunggah ke GitHub, jangan menimpa `public/config.js` yang sudah Anda isi (gunakan paket "update tanpa config" jika tersedia).

## Cara akun dibuat
- **Daftar sendiri:** karyawan membuka *Masuk > Daftar*. Akun berstatus *Menunggu* sampai admin menekan **Setujui**.
- **Dibuatkan admin:** di Supabase buka **Authentication > Users > Add user > Create new user**, isi email dan kata sandi, centang *Auto Confirm User*. Akun itu otomatis masuk daftar *Menunggu* di halaman Admin, lalu setujui di sana.

## Pengaturan email (penting)
- Secara bawaan Supabase mewajibkan **konfirmasi email**. Atur di **Authentication > Providers > Email**.
- Layanan email bawaan Supabase dibatasi jumlah kirimnya per jam, cukup untuk uji coba tetapi tidak untuk banyak karyawan. Untuk penggunaan nyata, pasang SMTP sendiri di **Authentication > Emails > SMTP Settings**.
- Anda bisa mengubah teks email (konfirmasi, reset kata sandi) di **Authentication > Emails**.

## Menghubungkan layanan
Di `public/assets/data.js`, pada daftar `SERVICES`, tambahkan alamat layanan:
```js
{ id:"s3", ..., login:true, url:"https://apd.perusahaan.co.id", title:"Permintaan APD", ... }
```
Layanan dengan `login:true` hanya dibuka untuk akun berstatus **Disetujui**.

## Catatan keamanan
- Pengecekan login di halaman web bersifat **pengaturan tampilan**. Alamat layanan yang ditulis di `assets/data.js` tetap bisa dilihat siapa pun yang membuka kode sumber halaman.
- Jika sebuah layanan menyimpan data sensitif, layanan itu sendiri harus meminta login (misalnya memakai Supabase dengan RLS, atau SSO perusahaan). Jangan hanya mengandalkan tombol di portal ini.
- Aturan pada `supabase/schema.sql` memastikan karyawan **tidak bisa** menyetujui dirinya sendiri atau mengubah perannya. Hanya admin yang berstatus disetujui yang bisa.
- Menolak atau mencabut akses tidak menghapus akun. Untuk menghapus permanen, gunakan **Authentication > Users** di Supabase.
- Project Supabase gratis akan dijeda jika lama tidak ada aktivitas. Buka dashboard Supabase dan klik *Restore* bila itu terjadi.

## Uji cepat setelah pengaturan
1. Daftar dengan email kedua, pastikan muncul status *Menunggu persetujuan* di menu.
2. Masuk sebagai admin, buka **Admin**, klik **Setujui**.
3. Masuk lagi sebagai akun kedua, pastikan statusnya *Aktif* dan layanan terbuka.
