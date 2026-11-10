/* =====================================================================
   SHEDINO - DATA & PENGATURAN
   Ubah isi di file ini untuk mengganti konten situs. Tidak perlu menyentuh
   desain atau kode halaman.
   ===================================================================== */

/* ---------- 1. Pengaturan umum ---------- */
window.CONFIG = {
  name: "SHEDINO",
  tagline: "Digital Information SHE",
  company: "PT Nama Perusahaan",
  address: "Kantor SHE, Area Operasional (isi alamat lengkap Anda)",
  mapsUrl: "",                       // tautan Google Maps (opsional)
  teamPhoto: "",                     // foto tim SHE untuk bagian Tentang, misalnya "media/tim-she.jpg" (opsional)
  email: "she@perusahaan.co.id",
  whatsapp: "6281234567890",         // format internasional, tanpa + dan tanpa 0 di depan
  whatsappLabel: "+62 812-3456-7890",
  hours: "Senin sampai Jumat, 08.00 - 17.00 WIB",
  pinned: { title: "Pemeliharaan platform pelatihan", text: "Sabtu, 02.00 - 04.00 WIB. Pendaftaran pelatihan ditunda sementara." },

  /* Teks halaman. Gunakan {nama}, {tagline}, dan {perusahaan} untuk menyisipkan nilai di atas. */
  heroTitle: "Semua informasi SHE, satu pintu.",
  heroLead: "Cari layanan, prosedur, kabar, dan edukasi keselamatan, kesehatan, dan lingkungan tanpa perlu bertanya ke banyak orang.",
  servicesIntro: "Layanan, pengetahuan, dan analitik untuk mendukung pekerjaan yang aman. Layanan \"Perlu login\" hanya terbuka untuk akun yang sudah disetujui.",
  aboutP1: "{nama} ({tagline}) adalah portal digital resmi Departemen SHE {perusahaan}. Portal ini dirancang untuk mewujudkan lingkungan kerja yang aman, sehat, dan ramah lingkungan dengan menyatukan layanan, pengetahuan, dan analitik dalam satu platform terpadu.",
  aboutP2: "Dengan satu pintu informasi, koordinasi keselamatan, pemantauan kesehatan pekerja, dan pelestarian lingkungan menjadi lebih cepat, jelas, dan terdokumentasi.",
  pillars: [
    { title: "Keselamatan kerja", text: "Mengutamakan pencegahan kecelakaan dan perlindungan maksimal bagi setiap pekerja di lapangan." },
    { title: "Kesehatan kerja", text: "Menjaga kesehatan fisik dan mental pekerja melalui pemeriksaan berkala dan lingkungan kerja yang bersih." },
    { title: "Lingkungan", text: "Berkomitmen menjaga alam sekitar, mengelola limbah dengan baik, dan menggunakan sumber daya secara bijak." },
    { title: "Informasi digital", text: "Layanan cepat seperti perizinan, pelaporan hazard, dan pencarian prosedur secara real-time untuk mendukung nihil kecelakaan." }
  ]
};

/* ---------- 2. Status sistem (papan informasi di beranda) ---------- */
/* state: "ok" (normal) | "warn" (pemeliharaan) | "crit" (gangguan) */
window.STATUS = [
  { name: "Sistem izin kerja",  state: "ok",   text: "Normal" },
  { name: "Pelaporan hazard",   state: "ok",   text: "Normal" },
  { name: "Platform pelatihan", state: "warn", text: "Pemeliharaan" },
  { name: "Helpdesk SHE",       state: "ok",   text: "Normal" }
];

/* ---------- 3. Kartu statistik ----------
   Angka sebenarnya diisi Admin lewat halaman Admin > Statistik SHE dan hanya
   tampil untuk akun yang sudah disetujui. Daftar di bawah menentukan urutan,
   label, dan warna kartu. "key" harus sama dengan data di database. */
window.STAT_DEFS = [
  { key: "insiden",    label: "Jumlah insiden",        unit: "kasus",   tone: "amber" },
  { key: "afr",        label: "AFR",                   unit: "",        tone: "blue"  },
  { key: "cidera",     label: "Jumlah cidera",         unit: "orang",   tone: "red"   },
  { key: "nearmiss",   label: "Near miss dilaporkan",  unit: "laporan", tone: "gray"  },
  { key: "lingkungan", label: "Pencemaran lingkungan", unit: "kasus",   tone: "teal"  },
  { key: "skor",       label: "Skor program SHE",      unit: "/ 100",   tone: "blue"  },
  { key: "closing",    label: "Closing rate hazard",   unit: "%",       tone: "teal"  },
  { key: "inspeksi",   label: "Inspeksi terlaksana",   unit: "%",       tone: "amber" }
];

/* ---------- 4a. Tab layanan ----------
   Tab di atas kartu layanan. name   : nama tab (dipakai juga di kolom "group" tiap layanan)
   icon : ikon tab | tone : blue, teal, amber, red, atau gray (warna ikon kartu)
   url  : jika diisi, tab menjadi TAUTAN ke alamat itu (bukan filter) */
window.GROUPS = [
  { id:"layanan",     name:"Layanan",     icon:"clip",   tone:"blue",  url:"", note:"Pengajuan dan pelaporan administrasi SHE." },
  { id:"pengetahuan", name:"Pengetahuan", icon:"book",   tone:"teal",  url:"", note:"Prosedur, pelatihan, dan sumber belajar." },
  { id:"analitik",    name:"Analitik",    icon:"chart",  tone:"amber", url:"", note:"Data dan pemantauan untuk pengambilan keputusan." }
];

/* ---------- 4b. Layanan ----------
   group : "Layanan" | "Pengetahuan" | "Analitik"
   login : true = hanya untuk akun yang sudah disetujui
   url   : alamat layanan sebenarnya (https://... atau halaman di situs ini)
   btnLabel : tulisan pada tombol kartu, misalnya "Buka Layanan Visitor"
   featured : true = tampil di beranda */
window.SERVICES = [
  { id:"s1", group:"Layanan", icon:"idcard", login:false, featured:true,  title:"Pendaftaran tamu", btnLabel:"Daftarkan Tamu", desc:"Ajukan izin kunjungan tamu ke area operasional dan pantau statusnya." },
  { id:"s2", group:"Layanan", icon:"truck",  login:true,  featured:false, title:"Komisioning unit", btnLabel:"Mulai Komisioning", desc:"Ajukan pemeriksaan kelayakan kendaraan dan alat berat sebelum beroperasi." },
  { id:"s3", group:"Layanan", icon:"helmet", login:true,  featured:false, title:"Permintaan APD", btnLabel:"Cek & Ajukan APD", desc:"Cek jadwal ganti, riwayat pengambilan, dan ajukan alat pelindung diri." },
  { id:"s4", group:"Layanan", icon:"clip",   login:true,  featured:true,  title:"Izin kerja khusus", btnLabel:"Buka Layanan Izin Kerja", desc:"Pilih jenis izin sesuai aktivitas atau pantau status persetujuannya." },
  { id:"s5", group:"Layanan", icon:"alert",  login:true,  featured:true,  title:"Laporan hazard", btnLabel:"Buat Laporan Hazard", desc:"Laporkan kondisi berbahaya di lapangan beserta foto dan lokasinya." },
  { id:"s6", group:"Layanan", icon:"stop",   login:true,  featured:true,  title:"Stop Work Authority", btnLabel:"Buka Stop Work Authority", desc:"Hentikan, laporkan, dan perbaiki pekerjaan yang tidak aman secara tercatat." },
  { id:"s7", group:"Layanan", icon:"sign",   login:false, featured:false, title:"Pemesanan rambu", btnLabel:"Pesan Rambu", desc:"Ajukan, pantau, dan unggah bukti pemasangan rambu atau stiker keselamatan." },
  { id:"s8", group:"Layanan", icon:"flag",   login:true,  featured:false, title:"Pelaporan insiden", btnLabel:"Laporkan Insiden", desc:"Laporkan insiden atau hampir celaka agar dapat segera ditindaklanjuti." },

  { id:"k1", group:"Pengetahuan", icon:"search", login:true,  featured:true,  title:"Pencarian prosedur", btnLabel:"Cari Prosedur", desc:"Cari cepat SOP, instruksi kerja, formulir, dan dokumen standar." },
  { id:"k2", group:"Pengetahuan", icon:"book",   login:true,  featured:false, title:"Pelatihan SHE", btnLabel:"Buka Pelatihan", desc:"Akses platform pelatihan dan edukasi keselamatan, kesehatan, dan lingkungan." },
  { id:"k3", group:"Pengetahuan", icon:"news",   login:true,  featured:false, title:"Internal memo", btnLabel:"Baca Memo", desc:"Baca memo manajemen yang berkaitan dengan keselamatan, kesehatan, dan lingkungan." },
  { id:"k4", group:"Pengetahuan", icon:"shield", login:true,  featured:false, title:"Kartu kontrol kritis", btnLabel:"Lihat Kartu Kontrol", desc:"Ringkasan pengendalian bahaya kritis untuk setiap jenis pekerjaan." },
  { id:"k5", group:"Pengetahuan", icon:"file",   login:false, featured:false, title:"Pustaka dokumen", btnLabel:"Buka Pustaka Dokumen", desc:"Kebijakan, panduan, dan formulir resmi yang berlaku.", url:"index.html#dokumen" },

  { id:"a1", group:"Analitik", icon:"chart",   login:true, featured:true,  title:"Statistik SHE", btnLabel:"Lihat Statistik", desc:"Pantau indikator utama seperti insiden, AFR, cidera, dan closing rate hazard.", url:"index.html#statistik" },
  { id:"a2", group:"Analitik", icon:"pulse",   login:true, featured:false, title:"Analisis hazard", btnLabel:"Buka Analisis", desc:"Closing rate, validasi hazard, dan deteksi laporan ganda dalam satu halaman." },
  { id:"a3", group:"Analitik", icon:"chart",   login:true, featured:false, title:"Indeks kualitas program", btnLabel:"Lihat Indeks", desc:"Pantau skor kualitas penerapan program keselamatan harian." },
  { id:"a4", group:"Analitik", icon:"monitor", login:true, featured:false, title:"Monitoring inspeksi", btnLabel:"Buka Monitoring", desc:"Lihat progres inspeksi terjadwal dan temuan yang belum ditutup." }
];

/* ---------- 5. Kabar SHE dan Edukasi ----------
   tab   : "kabar" | "edukasi"
   image : (opsional) alamat gambar, misalnya "media/foto1.jpg". Jika kosong,
           situs membuat sampul otomatis sesuai kategori.
   body  : daftar paragraf; gunakan { h: "Subjudul" } untuk subjudul.
   Contoh di bawah hanya isi percobaan, silakan ganti dengan berita Anda. */
window.CATEGORIES = [
  "Keselamatan Kerja", "Kesehatan Kerja", "Lingkungan Hidup", "Prosedur Kerja",
  "Tanggap Darurat", "Pengoperasian Unit", "Organisasi & Sistem Manajemen"
];

window.MEDIA = [
  { id:"general-safety-talk-bulanan", tab:"kabar", date:"2026-11-03", category:"Keselamatan Kerja",
    title:"General Safety Talk bulanan digelar serentak di seluruh area",
    excerpt:"Ratusan pekerja mengikuti sesi keselamatan bulanan yang membahas disiplin prosedur dan pelaporan hazard.",
    tags:["GeneralSafetyTalk","ZeroAccident","SafetyFirst"],
    body:[
      "Kegiatan General Safety Talk bulan ini diikuti pekerja dari seluruh unit kerja. Sesi dibuka oleh manajemen yang menekankan bahwa keselamatan adalah tanggung jawab bersama, bukan hanya tugas departemen SHE.",
      { h:"Materi utama" },
      "Materi mencakup rangkuman kinerja keselamatan bulan sebelumnya, pentingnya melaporkan hazard sedini mungkin, dan pengingat tentang penggunaan alat pelindung diri sesuai jenis pekerjaan.",
      "Peserta juga diajak berdiskusi tentang temuan lapangan. Hasil diskusi akan ditindaklanjuti oleh masing-masing penanggung jawab area dan dipantau melalui sistem pelaporan hazard."
    ] },
  { id:"simulasi-kebakaran-workshop", tab:"kabar", date:"2026-10-28", category:"Tanggap Darurat",
    title:"Simulasi tanggap darurat kebakaran di area workshop berjalan lancar",
    excerpt:"Tim tanggap darurat dan pekerja menguji alur evakuasi, komunikasi, dan penggunaan alat pemadam.",
    tags:["TanggapDarurat","Simulasi","ERT"],
    body:[
      "Simulasi kebakaran dilaksanakan untuk menguji kesiapan tim tanggap darurat serta kecepatan evakuasi pekerja dari area workshop menuju titik kumpul.",
      "Seluruh peserta berhasil berkumpul di titik aman dalam waktu yang ditargetkan. Tim pemadam menggunakan alat pemadam api ringan sesuai prosedur, sementara tim medis menyiapkan penanganan korban simulasi.",
      { h:"Catatan evaluasi" },
      "Evaluasi menemukan beberapa perbaikan kecil, antara lain penambahan penanda jalur evakuasi dan penyegaran cara melapor melalui radio. Seluruh catatan telah dimasukkan ke rencana perbaikan."
    ] },
  { id:"inspeksi-apar-triwulan", tab:"kabar", date:"2026-10-20", category:"Keselamatan Kerja",
    title:"Inspeksi APAR triwulan selesai, seluruh unit dinyatakan layak",
    excerpt:"Pemeriksaan tekanan, segel, dan masa berlaku alat pemadam api ringan di semua lokasi telah rampung.",
    tags:["APAR","Inspeksi","SafetyFirst"],
    body:[
      "Tim SHE menyelesaikan inspeksi triwulan seluruh alat pemadam api ringan (APAR) di area kantor, workshop, dan fasilitas pendukung.",
      "Setiap unit diperiksa kondisi tabung, tekanan, segel pengaman, serta masa berlaku isi. Unit yang mendekati masa kedaluwarsa dijadwalkan untuk pengisian ulang.",
      "Hasil inspeksi dicatat dan dapat dilihat pada menu Monitoring inspeksi oleh akun yang berhak."
    ] },
  { id:"audit-internal-k3lh", tab:"kabar", date:"2026-10-12", category:"Organisasi & Sistem Manajemen",
    title:"Audit internal sistem manajemen K3LH periode Oktober dimulai",
    excerpt:"Auditor internal memeriksa penerapan prosedur dan kelengkapan dokumen di setiap departemen.",
    tags:["AuditInternal","K3LH","SistemManajemen"],
    body:[
      "Audit internal bertujuan memastikan penerapan sistem manajemen K3LH sesuai prosedur yang berlaku dan menemukan peluang perbaikan sejak dini.",
      "Setiap departemen diminta menyiapkan dokumen pendukung dan menunjuk perwakilan untuk mendampingi auditor selama pemeriksaan.",
      "Temuan audit akan dibahas dalam rapat tinjauan manajemen dan ditindaklanjuti dengan batas waktu yang jelas."
    ] },
  { id:"pemeriksaan-kesehatan-berkala", tab:"kabar", date:"2026-09-30", category:"Kesehatan Kerja",
    title:"Pemeriksaan kesehatan berkala dibuka untuk seluruh pekerja",
    excerpt:"Pendaftaran pemeriksaan kesehatan tahunan sudah dibuka. Hasilnya menjadi dasar pemantauan kesehatan pekerja.",
    tags:["KesehatanKerja","MCU"],
    body:[
      "Pemeriksaan kesehatan berkala dilakukan untuk mendeteksi gangguan kesehatan sejak dini dan memastikan pekerja layak menjalankan tugasnya.",
      "Pekerja dapat memilih jadwal melalui klinik perusahaan. Hasil pemeriksaan bersifat rahasia dan hanya dapat diakses oleh pekerja yang bersangkutan serta tenaga medis.",
      "Pekerja yang memerlukan tindak lanjut akan dihubungi oleh tim kesehatan kerja."
    ] },
  { id:"penanaman-pohon-bulan-lingkungan", tab:"kabar", date:"2025-12-05", category:"Lingkungan Hidup",
    title:"Penanaman 500 pohon menandai bulan lingkungan",
    excerpt:"Pekerja bersama mitra kerja menanam bibit pohon di area reklamasi sebagai bagian dari komitmen lingkungan.",
    tags:["Lingkungan","Reklamasi","Penghijauan"],
    body:[
      "Kegiatan penanaman diikuti pekerja dari berbagai departemen bersama mitra kerja. Bibit ditanam di area yang telah disiapkan tim lingkungan.",
      "Selain menanam, peserta mendapat penjelasan tentang pentingnya perawatan bibit pada bulan-bulan awal agar tingkat hidupnya tinggi.",
      "Tim lingkungan akan memantau pertumbuhan bibit secara berkala dan melaporkannya dalam evaluasi tahunan."
    ] },
  { id:"penghargaan-zero-accident-2025", tab:"kabar", date:"2025-11-14", category:"Keselamatan Kerja",
    title:"Penghargaan capaian nihil kecelakaan tahun 2025 diserahkan",
    excerpt:"Beberapa unit kerja menerima penghargaan atas konsistensi menjaga catatan keselamatan sepanjang tahun.",
    tags:["ZeroAccident","Penghargaan"],
    body:[
      "Penghargaan diserahkan kepada unit kerja yang mencatat nihil kecelakaan kerja berat sepanjang periode penilaian.",
      "Manajemen menegaskan bahwa capaian ini adalah hasil kerja sama seluruh pekerja yang disiplin mengikuti prosedur dan berani melaporkan kondisi tidak aman.",
      "Capaian ini menjadi motivasi untuk menjaga standar yang sama pada tahun berikutnya."
    ] },

  { id:"mengenali-tanda-kelelahan", tab:"edukasi", date:"2026-11-06", category:"Kesehatan Kerja",
    title:"Mengenali tanda kelelahan sebelum mengemudi",
    excerpt:"Kelelahan menurunkan konsentrasi dan memperlambat reaksi. Kenali tandanya dan tahu kapan harus berhenti.",
    tags:["Fatigue","Berkendara","KesehatanKerja"],
    body:[
      "Kelelahan adalah salah satu penyebab utama kecelakaan saat mengemudi dan mengoperasikan unit. Gejalanya sering muncul perlahan sehingga tidak disadari.",
      { h:"Tanda yang perlu diwaspadai" },
      "Sering menguap, mata terasa berat, sulit fokus, melewati rambu tanpa sadar, atau tiba-tiba menyadari tidak ingat beberapa menit perjalanan terakhir.",
      { h:"Yang sebaiknya dilakukan" },
      "Berhenti di tempat yang aman, minum air, lakukan peregangan, dan beristirahat. Jika masih mengantuk, laporkan kepada pengawas agar penggantian dapat diatur. Kafein hanya membantu sebentar dan tidak menggantikan tidur."
    ] },
  { id:"zona-aman-pengisian-angin-ban", tab:"edukasi", date:"2026-11-02", category:"Pengoperasian Unit",
    title:"Zona aman saat pengisian angin ban unit besar",
    excerpt:"Tekanan udara dalam ban sangat besar. Gunakan peralatan standar dan jangan berdiri di jalur ledakan.",
    tags:["Ban","ZonaAman","PengoperasianUnit"],
    body:[
      "Pengisian angin ban unit besar berisiko tinggi karena udara bertekanan dapat menyebabkan ban atau pelek terlepas dengan kekuatan besar.",
      { h:"Langkah dasar" },
      "Gunakan peralatan yang layak dan terkalibrasi, pasang sangkar pengaman jika tersedia, dan isi udara dari jarak aman menggunakan selang yang cukup panjang.",
      "Jangan berdiri di depan permukaan ban atau pelek. Posisi yang paling aman adalah di samping tapak ban. Ikuti selalu tekanan yang ditetapkan pabrikan dan prosedur yang berlaku."
    ] },
  { id:"stop-work-authority", tab:"edukasi", date:"2026-10-25", category:"Prosedur Kerja",
    title:"Langkah menghentikan pekerjaan yang tidak aman (Stop Work Authority)",
    excerpt:"Setiap pekerja berhak dan wajib menghentikan pekerjaan jika melihat kondisi yang membahayakan.",
    tags:["StopWorkAuthority","Prosedur","SafetyFirst"],
    body:[
      "Stop Work Authority memberi wewenang kepada setiap pekerja untuk menghentikan pekerjaan yang dinilai tidak aman, tanpa takut disalahkan.",
      { h:"Cara melakukannya" },
      "Pertama, hentikan pekerjaan dan amankan area. Kedua, sampaikan alasan penghentian kepada pengawas. Ketiga, catat dan laporkan melalui layanan Stop Work Authority. Pekerjaan baru boleh dilanjutkan setelah kondisi diperbaiki dan dinyatakan aman.",
      "Penghentian yang dilakukan dengan itikad baik tidak akan dikenai sanksi."
    ] },
  { id:"cara-melaporkan-hazard", tab:"edukasi", date:"2026-10-18", category:"Prosedur Kerja",
    title:"Cara melaporkan hazard dengan benar dan cepat",
    excerpt:"Laporan yang jelas mempercepat penanganan. Ketahui informasi apa saja yang perlu disertakan.",
    tags:["Hazard","Pelaporan","Prosedur"],
    body:[
      "Hazard adalah kondisi atau tindakan yang berpotensi menimbulkan cedera atau kerusakan. Semakin cepat dilaporkan, semakin kecil kemungkinan menjadi insiden.",
      { h:"Isi laporan yang baik" },
      "Sebutkan lokasi dengan jelas, jelaskan kondisi yang ditemukan, lampirkan foto bila memungkinkan, dan tuliskan tingkat risiko menurut Anda.",
      "Laporan dapat dibuat melalui layanan Laporan hazard. Anda dapat memantau perkembangan penanganannya sampai laporan ditutup."
    ] },
  { id:"memilih-apd-yang-tepat", tab:"edukasi", date:"2026-09-22", category:"Keselamatan Kerja",
    title:"Memilih APD yang tepat sesuai bahaya pekerjaan",
    excerpt:"APD adalah lapisan perlindungan terakhir. Pilih sesuai bahaya dan pastikan kondisinya layak pakai.",
    tags:["APD","Keselamatan","SafetyFirst"],
    body:[
      "Alat pelindung diri tidak menggantikan pengendalian bahaya lain, tetapi menjadi pelindung terakhir ketika bahaya tidak bisa dihilangkan.",
      { h:"Prinsip pemilihan" },
      "Kenali bahaya pekerjaan terlebih dahulu: benturan, bahan kimia, kebisingan, debu, atau percikan. Lalu pilih APD yang sesuai standar dan ukurannya pas.",
      "Periksa kondisi APD sebelum dipakai. Ganti yang retak, aus, atau sudah melewati masa pakai, dan ajukan penggantian melalui layanan Permintaan APD."
    ] },
  { id:"pengelolaan-limbah-b3-dasar", tab:"edukasi", date:"2026-08-30", category:"Lingkungan Hidup",
    title:"Dasar pengelolaan limbah B3 di area kerja",
    excerpt:"Pisahkan, beri label, dan simpan limbah berbahaya di tempat yang tepat untuk mencegah pencemaran.",
    tags:["LimbahB3","Lingkungan","Prosedur"],
    body:[
      "Limbah bahan berbahaya dan beracun (B3) seperti oli bekas, filter, dan kemasan bahan kimia harus dikelola terpisah dari sampah biasa.",
      { h:"Tiga langkah sederhana" },
      "Pisahkan limbah B3 pada wadah yang sesuai, beri label jenis dan tanggal, lalu simpan di tempat penyimpanan sementara yang beratap dan memiliki bak penampung tumpahan.",
      "Jika terjadi tumpahan, hentikan sumbernya, amankan area, gunakan bahan penyerap, lalu laporkan kepada tim lingkungan."
    ] },
  { id:"rambu-lalu-lintas-area-operasional", tab:"edukasi", date:"2025-10-10", category:"Pengoperasian Unit",
    title:"Memahami rambu lalu lintas di area operasional",
    excerpt:"Rambu membantu semua pengguna jalan memprediksi situasi. Pelajari arti rambu yang paling sering ditemui.",
    tags:["Rambu","LaluLintas","PengoperasianUnit"],
    body:[
      "Rambu lalu lintas di area operasional dibuat untuk mengatur kecepatan, prioritas, dan jarak antar unit sehingga risiko tabrakan dapat ditekan.",
      { h:"Rambu yang perlu diingat" },
      "Rambu batas kecepatan, rambu berhenti, rambu prioritas unit besar, dan rambu zona pejalan kaki. Patuhi rambu sepanjang waktu, tidak hanya saat ada petugas.",
      "Jika menemukan rambu rusak atau hilang, laporkan melalui layanan Pemesanan rambu agar segera diganti."
    ] }
];

/* ---------- 6. Pustaka dokumen ---------- */
window.DOCS = [
  { id:"d1", title:"Kebijakan K3LH perusahaan",          type:"Kebijakan", fmt:"PDF",  date:"2026-09-12" },
  { id:"d2", title:"Prosedur izin kerja khusus",          type:"Panduan",   fmt:"PDF",  date:"2026-08-30" },
  { id:"d3", title:"Panduan penggunaan alat pelindung diri", type:"Panduan", fmt:"PDF", date:"2026-10-20" },
  { id:"d4", title:"Formulir laporan hazard",             type:"Formulir",  fmt:"DOCX", date:"2026-06-05" },
  { id:"d5", title:"Formulir permintaan APD",             type:"Formulir",  fmt:"XLSX", date:"2026-05-22" },
  { id:"d6", title:"Panduan tanggap darurat kebakaran",   type:"Panduan",   fmt:"PDF",  date:"2026-07-18" },
  { id:"d7", title:"Kebijakan perjalanan dan berkendara aman", type:"Kebijakan", fmt:"PDF", date:"2026-04-10" },
  { id:"d8", title:"Formulir pengajuan komisioning unit", type:"Formulir",  fmt:"DOCX", date:"2026-03-18" }
];

/* ---------- 7. FAQ ---------- */
window.FAQ = [
  { q:"Apa itu SHEDINO?", a:"SHEDINO (Digital Information SHE) adalah portal digital Safety, Health & Environment. Portal ini menyatukan layanan, prosedur, kabar, edukasi, dan data kinerja SHE dalam satu tempat." },
  { q:"Siapa saja yang dapat menggunakan SHEDINO?", a:"Siapa saja dapat membuka informasi umum seperti kabar, edukasi, dan sebagian layanan. Layanan dan data tertentu hanya dapat dibuka oleh akun yang sudah disetujui admin sesuai perannya." },
  { q:"Bagaimana cara mendapatkan akun?", a:"Klik Masuk lalu Daftar, isi data Anda dengan email kantor. Akun aktif setelah disetujui admin SHE." },
  { q:"Apakah status pengajuan di portal sesuai kondisi sebenarnya?", a:"Ya. Untuk layanan yang sudah terhubung, status diperbarui langsung oleh admin atau penanggung jawab layanan, sehingga dapat dijadikan acuan utama." },
  { q:"Siapa yang dihubungi jika mengalami kendala?", a:"Hubungi admin lewat WhatsApp atau formulir kontak di bagian bawah halaman, atau datang langsung ke kantor SHE pada jam layanan." }
];

/* ---------- 8. Salinan isi bawaan ----------
   Dipakai tombol "Impor data contoh" di panel Admin. Jangan diubah. */
window.DEFAULTS = JSON.parse(JSON.stringify({
  CONFIG: window.CONFIG, STATUS: window.STATUS, GROUPS: window.GROUPS, SERVICES: window.SERVICES,
  MEDIA: window.MEDIA, DOCS: window.DOCS, FAQ: window.FAQ, CATEGORIES: window.CATEGORIES
}));
