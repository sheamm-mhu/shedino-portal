/* SHEDINO - editor konten di panel Admin.
   Memerlukan: vendor/supabase.js, config.js, auth.js, data.js (untuk daftar kategori dan isi bawaan). */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const BUCKET = "site-media";
  const dlgOpen = d => { if (typeof d.showModal === "function") d.showModal(); else { d.classList.add("polyfill"); d.setAttribute("open", ""); } };
  const dlgClose = d => { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); };
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtD = iso => iso ? new Date(String(iso).slice(0, 10) + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-";
  const slugify = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " dan ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || ("item-" + Date.now().toString(36));
  const clone = o => JSON.parse(JSON.stringify(o));
  const CATS = () => (window.CATEGORIES || []);
  const typeLabelA = id => ((window.MEDIA_TYPES || []).find(t => t.id === id) || { label: id }).label;
  const yesNo = v => v ? '<span class="chip approved">Ya</span>' : '<span class="chip karyawan">Tidak</span>';
  const pubChip = v => v ? '<span class="chip approved">Tayang</span>' : '<span class="chip pending">Draf</span>';

  function toast(t) {
    const el = $("#toast"); if (!el) return;
    el.textContent = t; el.classList.remove("hidden");
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add("hidden"), 3200);
  }

  function dbError(err) {
    const m = String((err && (err.message || err.error_description)) || err || "");
    const code = err && err.code;
    if (code === "42P01" || /does not exist|could not find the table|schema cache/i.test(m)) return "Tabel konten belum dibuat. Jalankan ulang seluruh isi supabase/schema.sql di Supabase SQL Editor.";
    if (/row-level security|permission denied|not authorized|violates row/i.test(m)) return "Anda tidak punya izin untuk ini. Hanya Admin yang disetujui yang boleh mengubah konten.";
    if (/bucket not found/i.test(m)) return "Penyimpanan foto belum dibuat. Jalankan ulang seluruh isi supabase/schema.sql di Supabase SQL Editor.";
    if (/mime type|not supported/i.test(m)) return "Jenis file ini tidak diizinkan. Gunakan JPG, PNG, WebP, PDF, Word, Excel, atau PowerPoint.";
    if (/exceeded the maximum allowed size|too large|payload/i.test(m)) return "Ukuran file terlalu besar (maksimal 10 MB).";
    if (/duplicate key|already exists/i.test(m)) return "Data dengan ID yang sama sudah ada. Ubah judulnya lalu coba lagi.";
    return window.Auth ? Auth.friendly(err) : m;
  }

  /* ---------- Unggah foto / file ---------- */
  const MIME = {
    pdf: "application/pdf", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
    mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/quicktime"
  };
  const MAX_VIDEO = 50 * 1024 * 1024;
  const VIDEO_EXT = ["mp4", "m4v", "webm", "mov"];
  const mb = n => (n / 1048576).toFixed(1).replace(".", ",") + " MB";
  const extOf = name => (String(name).split(".").pop() || "").toLowerCase();

  async function compressImage(file, maxW, maxBytes) {
    if (file.type === "image/gif") return { blob: file, ext: "gif", type: "image/gif" };
    let bmp;
    try { bmp = await createImageBitmap(file); }
    catch (e) { throw new Error("Format gambar ini tidak dapat dibaca. Gunakan JPG, PNG, atau WebP."); }
    let scale = Math.min(1, maxW / bmp.width), q = 0.85, blob = null;
    const render = async () => {
      const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      blob = await new Promise(res => cv.toBlob(res, "image/jpeg", q));
      if (!blob) throw new Error("Gambar tidak dapat diproses.");
    };
    await render();
    // Batas ukuran (untuk gambar sampul artikel): WhatsApp sering tidak menampilkan pratinjau bila gambar terlalu besar.
    // Turunkan kualitas dulu, lalu ukuran, sampai di bawah batas.
    for (let i = 0; maxBytes && blob.size > maxBytes && i < 10; i++) {
      if (q > 0.56) q = Math.max(0.5, q - 0.08); else if (scale * bmp.width > 640) scale *= 0.85; else break;
      await render();
    }
    // pakai file asli bila sudah JPEG kecil dan lebih ringan dari hasil kompresi
    if (file.type === "image/jpeg" && file.size <= blob.size && file.size < 1024 * 1024 && (!maxBytes || file.size <= maxBytes)) return { blob: file, ext: "jpg", type: "image/jpeg" };
    return { blob, ext: "jpg", type: "image/jpeg" };
  }

  async function uploadTo(folder, blob, base, ext, type) {
    const path = `${folder}/${Date.now().toString(36)}-${slugify(base)}.${ext}`;
    // Tetapkan jenis file secara eksplisit: browser kadang memberi jenis kosong atau umum pada dokumen Office.
    const body = blob.type === type ? blob : new Blob([blob], { type });
    const { error } = await Auth.client.storage.from(BUCKET).upload(path, body, { contentType: type, cacheControl: "31536000", upsert: false });
    if (error) throw error;
    return Auth.client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /* Unggah video dengan bilah kemajuan (XMLHttpRequest), format sama dengan pustaka storage */
  function xhrUpload(path, blob, type, onProgress) {
    return new Promise(async (resolve, reject) => {
      try {
        const { data } = await Auth.client.auth.getSession();
        const token = data.session && data.session.access_token;
        if (!token) throw new Error("Sesi login berakhir. Masuk ulang lalu coba lagi.");
        const fd = new FormData();
        fd.append("cacheControl", "31536000");
        fd.append("", blob.type === type ? blob : new Blob([blob], { type }));
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${Auth.url}/storage/v1/object/${BUCKET}/${path}`);
        xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.setRequestHeader("apikey", Auth.key);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.min(99, Math.round(e.loaded / e.total * 100))); };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(); return; }
          let msg = "";
          try { msg = JSON.parse(xhr.responseText).message || ""; } catch (e) { /* abaikan */ }
          if (!msg) msg = xhr.status === 413 ? "The object exceeded the maximum allowed size" : xhr.status === 401 || xhr.status === 403 ? "new row violates row-level security policy" : "HTTP " + xhr.status;
          const err = new Error(msg); err.statusCode = String(xhr.status); reject(err);
        };
        xhr.onerror = () => reject(new Error("Gagal terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi."));
        xhr.onabort = () => reject(new Error("Unggahan dibatalkan."));
        xhr.send(fd);
      } catch (e) { reject(e); }
    });
  }

  /* ---------- Definisi koleksi ---------- */
  const ICONS = [["idcard", "Kartu identitas"], ["truck", "Kendaraan"], ["helmet", "Helm (APD)"], ["clip", "Papan izin"], ["alert", "Peringatan"], ["stop", "Berhenti"], ["sign", "Rambu"], ["flag", "Bendera"], ["search", "Pencarian"], ["book", "Buku"], ["news", "Berita"], ["shield", "Perisai"], ["file", "Dokumen"], ["chart", "Grafik"], ["pulse", "Denyut"], ["monitor", "Monitor"], ["users", "Orang"]];
  const TONE_OPTS = [["blue", "Biru"], ["teal", "Teal"], ["amber", "Oranye"], ["red", "Merah"], ["gray", "Abu-abu"]];
  const nextSort = rows => rows.reduce((m, r) => Math.max(m, r.sort_order || 0), 0) + 1;

  const COLS = {
    media: {
      table: "media_posts", label: "Kabar & Media", one: "artikel", pk: "id", order: ["pub_date", false], defKey: "MEDIA", idFrom: "title",
      list: [["title", "Judul"], ["tab", "Jenis", v => typeLabelA(v)], ["category", "Kategori"], ["pub_date", "Tanggal", fmtD], ["published", "Status", pubChip, true]],
      fields: [
        { k: "title", label: "Judul", type: "text", req: true },
        { row: [{ k: "tab", label: "Jenis", type: "select", opts: () => (window.MEDIA_TYPES || []).map(t => [t.id, t.label]) }, { k: "pub_date", label: "Tanggal", type: "date", req: true }] },
        { k: "category", label: "Kategori", type: "select", opts: () => CATS().map(c => [c, c]) },
        { k: "excerpt", label: "Ringkasan", type: "textarea", help: "Satu atau dua kalimat yang tampil di kartu." },
        { k: "image", label: "Foto sampul", type: "image", folder: "artikel", help: "Boleh dikosongkan. Situs akan membuat sampul berwarna otomatis." },
        { k: "video_url", label: "Video (opsional)", type: "video", folder: "video", help: "Unggah file video (maksimal 50 MB, format MP4 disarankan) atau tempel tautan YouTube, Vimeo, atau Google Drive. Untuk video besar atau yang ditonton banyak orang, tautan YouTube lebih hemat kuota." },
        { k: "file_url", label: "Lampiran (opsional)", type: "file", folder: "lampiran", help: "PDF buletin atau materi kampanye yang dapat diunduh pembaca. Maksimal 10 MB." },
        { k: "body", label: "Isi artikel", type: "body" },
        { k: "tags", label: "Tagar", type: "tags", help: "Pisahkan dengan koma, tanpa tanda #. Contoh: SafetyFirst, APAR" },
        { k: "published", label: "Tayangkan di situs", type: "check" }
      ],
      defaults: () => ({ tab: ((window.MEDIA_TYPES || [])[0] || { id: "kabar" }).id, pub_date: today(), category: CATS()[0] || "", excerpt: "", image: "", file_url: "", video_url: "", body: [], tags: [], published: true }),
      fromDefault: m => ({ id: m.id, tab: m.tab, title: m.title, excerpt: m.excerpt || "", category: m.category, pub_date: m.date, tags: m.tags || [], image: m.image || "", file_url: m.fileUrl || "", video_url: m.videoUrl || "", body: m.body || [], published: true })
    },
    groups: {
      table: "site_groups", label: "Tab Layanan", one: "tab", pk: "id", order: ["sort_order", true], defKey: "GROUPS", idFrom: "name",
      deleteWarn: "Layanan di tab ini tidak ikut terhapus, tetapi akan tampil sebagai kelompok tambahan sampai Anda memindahkannya ke tab lain.",
      list: [["name", "Nama tab"], ["tone", "Warna ikon kartu", v => (TONE_OPTS.find(o => o[0] === v) || [0, v])[1]], ["url", "Perilaku tab", v => v ? "Tautan ke " + v : "Menyaring layanan"], ["sort_order", "Urutan"]],
      fields: [
        { k: "name", label: "Nama tab", type: "text", req: true, help: "Jika nama diganti, layanan di tab ini ikut dipindahkan otomatis." },
        { row: [{ k: "icon", label: "Ikon tab", type: "select", opts: () => ICONS }, { k: "tone", label: "Warna ikon kartu", type: "select", opts: () => TONE_OPTS }] },
        { k: "note", label: "Keterangan singkat", type: "textarea", help: "Tampil di bawah judul kelompok pada halaman Layanan." },
        { k: "url", label: "Tautan tab (opsional)", type: "text", help: "Jika diisi, tab ini menjadi TAUTAN ke alamat itu (misalnya https://...), bukan penyaring layanan. Kosongkan untuk tab biasa." },
        { k: "sort_order", label: "Urutan tampil (angka kecil tampil lebih dulu)", type: "number" }
      ],
      defaults: rows => ({ icon: "file", tone: "blue", note: "", url: "", sort_order: nextSort(rows) }),
      fromDefault: (g, i) => ({ id: g.id, name: g.name, icon: g.icon, tone: g.tone, note: g.note || "", url: g.url || "", sort_order: i + 1 })
    },
    services: {
      table: "site_services", label: "Layanan", one: "layanan", pk: "id", order: ["sort_order", true], defKey: "SERVICES", idFrom: "title",
      list: [["title", "Layanan"], ["grp", "Tab"], ["btn_label", "Tulisan tombol"], ["login", "Akses", v => v ? "Perlu login" : "Terbuka"], ["featured", "Di beranda", yesNo, true], ["sort_order", "Urutan"]],
      fields: [
        { k: "title", label: "Nama layanan", type: "text", req: true },
        { row: [{ k: "grp", label: "Tab (kelompok)", type: "select", opts: () => (st.groupNames || []).map(n => [n, n]) }, { k: "icon", label: "Ikon", type: "select", opts: () => ICONS }] },
        { k: "descr", label: "Deskripsi singkat", type: "textarea" },
        { k: "btn_label", label: "Tulisan pada tombol", type: "text", help: "Contoh: Buka Layanan Visitor, Mulai Komisioning. Kosong = \"Buka layanan\"." },
        { k: "url", label: "Tautan tombol (alamat tujuan)", type: "text", help: "Alamat https://... yang dibuka saat tombol diklik. Kosongkan jika belum ada." },
        { row: [{ k: "login", label: "Hanya untuk akun yang disetujui", type: "check" }, { k: "featured", label: "Tampilkan di beranda", type: "check" }] },
        { k: "sort_order", label: "Urutan tampil (angka kecil tampil lebih dulu)", type: "number" }
      ],
      defaults: rows => ({ grp: (st.groupNames || [])[0] || "Layanan", icon: "file", login: true, featured: false, descr: "", url: "", btn_label: "", sort_order: nextSort(rows) }),
      fromDefault: (s, i) => ({ id: s.id, grp: s.group, icon: s.icon, login: !!s.login, featured: !!s.featured, title: s.title, descr: s.desc || "", url: s.url || "", btn_label: s.btnLabel || "", sort_order: i + 1 })
    },
    docs: {
      table: "site_docs", label: "Dokumen", one: "dokumen", pk: "id", order: ["doc_date", false], defKey: "DOCS", idFrom: "title",
      list: [["title", "Judul"], ["doc_type", "Jenis"], ["fmt", "Format"], ["doc_date", "Diperbarui", fmtD], ["published", "Status", pubChip, true]],
      fields: [
        { k: "title", label: "Judul dokumen", type: "text", req: true },
        { row: [{ k: "doc_type", label: "Jenis", type: "select", opts: () => [["Kebijakan", "Kebijakan"], ["Panduan", "Panduan"], ["Formulir", "Formulir"]] }, { k: "doc_date", label: "Tanggal pembaruan", type: "date", req: true }] },
        { k: "url", label: "File dokumen", type: "file", folder: "dokumen", fmtKey: "fmt", help: "PDF, Word, Excel, atau PowerPoint, maksimal 10 MB." },
        { k: "fmt", label: "Format", type: "select", opts: () => [["PDF", "PDF"], ["DOCX", "DOCX"], ["XLSX", "XLSX"], ["PPTX", "PPTX"]], help: "Terisi otomatis saat file diunggah." },
        { k: "published", label: "Tayangkan di situs", type: "check" }
      ],
      defaults: () => ({ doc_type: "Panduan", fmt: "PDF", doc_date: today(), url: "", published: true }),
      fromDefault: d => ({ id: d.id, title: d.title, doc_type: d.type, fmt: d.fmt, doc_date: d.date, url: d.url || "", published: true })
    },
    faq: {
      table: "site_faq", label: "Pertanyaan umum (FAQ)", one: "pertanyaan", pk: "id", order: ["sort_order", true], defKey: "FAQ", idFrom: null,
      list: [["q", "Pertanyaan"], ["sort_order", "Urutan"]],
      fields: [
        { k: "q", label: "Pertanyaan", type: "text", req: true },
        { k: "a", label: "Jawaban", type: "textarea", req: true },
        { k: "sort_order", label: "Urutan tampil (angka kecil tampil lebih dulu)", type: "number" }
      ],
      defaults: rows => ({ q: "", a: "", sort_order: nextSort(rows) }),
      fromDefault: (f, i) => ({ q: f.q, a: f.a, sort_order: i + 1 })
    }
  };

  const st = { key: null, rows: [], editing: null };

  /* ---------- Daftar ---------- */
  async function loadGroupNames() {
    const { data } = await Auth.client.from("site_groups").select("name,sort_order").order("sort_order", { ascending: true });
    let names = (data || []).map(r => r.name);
    if (!names.length) names = ((window.DEFAULTS && window.DEFAULTS.GROUPS) || []).map(g => g.name);
    st.groupNames = names;
  }
  async function loadTypes() {
    const { data } = await Auth.client.from("site_settings").select("value").eq("key", "mediaTypes").maybeSingle();
    const v = data && data.value;
    window.MEDIA_TYPES = Array.isArray(v) && v.length ? v : clone((window.DEFAULTS && window.DEFAULTS.MEDIA_TYPES) || []);
  }
  async function loadCats() {
    const { data } = await Auth.client.from("site_settings").select("value").eq("key", "categories").maybeSingle();
    const v = data && data.value;
    window.CATEGORIES = Array.isArray(v) && v.length ? v.map(String) : (((window.DEFAULTS && window.DEFAULTS.CATEGORIES) || []).slice());
  }

  async function show(key) {
    st.key = key;
    if (key === "services") await loadGroupNames();
    if (key === "media") { await loadCats(); await loadTypes(); }
    const C = COLS[key];
    $("#c-title").textContent = C.label;
    $("#c-add").textContent = "+ Tambah " + C.one;
    $("#c-list").innerHTML = '<tr><td class="empty">Memuat...</td></tr>';
    const { data, error } = await Auth.client.from(C.table).select("*").order(C.order[0], { ascending: C.order[1] });
    if (error) { $("#c-list").innerHTML = `<tr><td class="empty">${esc(dbError(error))}</td></tr>`; $("#c-import").classList.add("hidden"); return; }
    st.rows = data || [];
    renderList();
  }

  function renderList() {
    const C = COLS[st.key];
    $("#c-head").innerHTML = "<tr>" + C.list.map(c => `<th scope="col">${esc(c[1])}</th>`).join("") + '<th scope="col"><span class="sr">Aksi</span></th></tr>';
    if (!st.rows.length) {
      $("#c-list").innerHTML = `<tr><td colspan="${C.list.length + 1}" class="empty">Belum ada ${esc(C.one)} di database. Situs masih memakai isi contoh dari file data.js. Klik <b>Impor data contoh</b> untuk menyalinnya ke sini agar bisa Anda edit, atau klik <b>Tambah</b> untuk mulai dari nol.</td></tr>`;
    } else {
      $("#c-list").innerHTML = st.rows.map((r, i) => "<tr>" + C.list.map(c => {
        const raw = r[c[0]];
        const out = c[2] ? c[2](raw) : esc(raw);
        return `<td${c[2] === fmtD ? ' style="white-space:nowrap"' : ""}>${c[3] ? out : (c[2] ? esc(out) : out)}</td>`;
      }).join("") + `<td><button class="btn ghost sm" data-edit="${i}" type="button">Edit</button></td></tr>`).join("");
    }
    const hasDefaults = window.DEFAULTS && Array.isArray(window.DEFAULTS[C.defKey]) && window.DEFAULTS[C.defKey].length;
    $("#c-import").classList.toggle("hidden", !(hasDefaults && st.rows.length === 0));
  }

  async function importDefaults() {
    const C = COLS[st.key];
    const src = window.DEFAULTS[C.defKey];
    if (!confirm(`Salin ${src.length} data contoh ke database? Setelah ini situs memakai data dari database.`)) return;
    const rows = src.map(C.fromDefault);
    const { error } = await Auth.client.from(C.table).insert(rows);
    if (error) { toast("Gagal mengimpor: " + dbError(error)); return; }
    toast(src.length + " data berhasil diimpor.");
    await show(st.key);
  }

  /* ---------- Formulir ---------- */
  function videoPreviewHTML(u) {
    u = String(u || "").trim();
    if (!u) return "<span>Belum ada video</span>";
    if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) || /\/storage\/v1\/object\/public\//.test(u)) return `<video src="${esc(u)}" controls muted playsinline preload="metadata"></video>`;
    return `<span>Tautan video: ${esc(u)}</span>`;
  }

  function wireVideo(box) {
    const up = $(".up", box), rm = $(".rm", box), urlin = $(".urlin", box), stEl = $(".upst", box), prev = $(".imgprev", box), prog = $(".vprog", box);
    const refresh = () => { prev.innerHTML = videoPreviewHTML(urlin.value); };
    urlin.addEventListener("change", refresh);
    rm.addEventListener("click", () => { urlin.value = ""; up.value = ""; stEl.textContent = ""; prog.hidden = true; refresh(); });
    up.addEventListener("change", async () => {
      const file = up.files[0]; if (!file) return;
      stEl.className = "upst"; prog.hidden = true;
      try {
        const ext = extOf(file.name);
        if (!VIDEO_EXT.includes(ext)) throw new Error("Gunakan video berformat MP4 (disarankan), WebM, atau MOV.");
        if (file.size > MAX_VIDEO) throw new Error(`Ukuran video ${mb(file.size)} melebihi batas ${mb(MAX_VIDEO)}. Kecilkan videonya, atau unggah ke YouTube atau Google Drive lalu tempel tautannya di kolom di bawah.`);
        const type = MIME[ext];
        const path = `${box.dataset.folder}/${Date.now().toString(36)}-${slugify(file.name.replace(/\.[^.]+$/, ""))}.${ext === "m4v" ? "mp4" : ext}`;
        stEl.textContent = "Mengunggah 0%... jangan tutup halaman ini."; prog.hidden = false; prog.value = 0; up.disabled = true;
        await xhrUpload(path, file, type, pct => { prog.value = pct; stEl.textContent = `Mengunggah ${pct}%... jangan tutup halaman ini.`; });
        urlin.value = Auth.client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; refresh();
        stEl.className = "upst ok"; stEl.textContent = "Berhasil diunggah (" + mb(file.size) + "). Klik Simpan untuk menerapkan.";
      } catch (e) {
        stEl.className = "upst err"; stEl.textContent = e && e.message && !e.statusCode && !e.error ? e.message : dbError(e);
      }
      prog.hidden = true; up.disabled = false; up.value = "";
    });
  }

  function fieldHTML(f, data) {
    const v = data[f.k];
    const help = f.help ? `<span class="fhelp">${esc(f.help)}</span>` : "";
    const req = f.req ? " required" : "";
    switch (f.type) {
      case "text": return `<label>${esc(f.label)}<input data-k="${f.k}" value="${esc(v)}"${req}>${help}</label>`;
      case "number": return `<label>${esc(f.label)}<input data-k="${f.k}" type="number" step="1" value="${esc(v)}">${help}</label>`;
      case "date": return `<label>${esc(f.label)}<input data-k="${f.k}" type="date" value="${esc(String(v || "").slice(0, 10))}"${req}>${help}</label>`;
      case "textarea": return `<label>${esc(f.label)}<textarea data-k="${f.k}"${req}>${esc(v)}</textarea>${help}</label>`;
      case "select": {
        let opts = f.opts(); if (v && !opts.some(o => o[0] === v)) opts = [[v, v], ...opts];
        return `<label>${esc(f.label)}<select data-k="${f.k}">${opts.map(o => `<option value="${esc(o[0])}"${o[0] === v ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select>${help}</label>`;
      }
      case "check": return `<label class="fchk"><input type="checkbox" data-k="${f.k}"${v ? " checked" : ""}> ${esc(f.label)}</label>`;
      case "tags": return `<label>${esc(f.label)}<input data-k="${f.k}" value="${esc((v || []).join(", "))}">${help}</label>`;
      case "image": return `<div class="imgbox" data-k="${f.k}" data-folder="${f.folder}" data-kind="image">
          <strong>${esc(f.label)}</strong>
          <div class="imgprev">${v ? `<img src="${esc(v)}" alt="">` : "<span>Belum ada foto</span>"}</div>
          <div class="imgctl"><input type="file" accept="image/*" class="up" aria-label="Pilih foto"><button type="button" class="btn ghost sm rm">Hapus foto</button><span class="upst" role="status"></span></div>
          <label>Alamat gambar <input class="urlin" value="${esc(v)}" placeholder="Terisi otomatis setelah unggah"></label>${help}</div>`;
      case "video": return `<div class="imgbox" data-k="${f.k}" data-folder="${f.folder}" data-kind="video">
          <strong>${esc(f.label)}</strong>
          <div class="imgprev">${videoPreviewHTML(v)}</div>
          <div class="imgctl"><input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov" class="up" aria-label="Pilih file video"><button type="button" class="btn ghost sm rm">Hapus video</button><span class="upst" role="status"></span></div>
          <progress class="vprog" max="100" value="0" hidden aria-label="Kemajuan unggah"></progress>
          <label>Atau tempel tautan video <small>(YouTube, Vimeo, Google Drive)</small><input class="urlin" value="${esc(v)}" placeholder="https://www.youtube.com/watch?v=..."></label>${help}</div>`;
      case "file": return `<div class="imgbox" data-k="${f.k}" data-folder="${f.folder}" data-kind="file" data-fmtkey="${f.fmtKey || ""}">
          <strong>${esc(f.label)}</strong>
          <div class="imgctl"><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" class="up" aria-label="Pilih file dokumen"><button type="button" class="btn ghost sm rm">Hapus file</button><span class="upst" role="status"></span></div>
          <label>Alamat file <input class="urlin" value="${esc(v)}" placeholder="Terisi otomatis setelah unggah"></label>${help}</div>`;
      case "body": return `<div class="bodyed" data-k="${f.k}"><strong>${esc(f.label)}</strong><div class="blks">${(v || []).map(blockHTML).join("")}</div>
          <div class="bodyctl"><button type="button" class="btn ghost sm addp">+ Paragraf</button><button type="button" class="btn ghost sm addh">+ Subjudul</button></div></div>`;
    }
    return "";
  }

  function blockHTML(b) {
    const isH = b && typeof b === "object" && b.h !== undefined;
    const txt = isH ? b.h : b;
    return `<div class="blk" data-t="${isH ? "h" : "p"}"><div class="blkhead"><span class="chip ${isH ? "admin" : "karyawan"}">${isH ? "Subjudul" : "Paragraf"}</span>
      <span class="acts"><button type="button" class="btn ghost sm bup" aria-label="Pindah ke atas">&uarr;</button><button type="button" class="btn ghost sm bdn" aria-label="Pindah ke bawah">&darr;</button><button type="button" class="btn ghost sm bdel">Hapus</button></span></div>
      ${isH ? `<input value="${esc(txt)}" placeholder="Subjudul">` : `<textarea placeholder="Tulis paragraf di sini">${esc(txt)}</textarea>`}</div>`;
  }

  function openForm(row) {
    const C = COLS[st.key];
    st.editing = row || null;
    const data = row ? clone(row) : C.defaults(st.rows);
    const fieldsHTML = C.fields.map(f => f.row ? `<div class="frow">${f.row.map(x => fieldHTML(x, data)).join("")}</div>` : fieldHTML(f, data)).join("");
    $("#cform").innerHTML = `<h3>${row ? "Edit" : "Tambah"} ${esc(C.one)}</h3>${fieldsHTML}
      <div class="msg" id="cmsg" role="alert"></div>
      <div class="fact"><div class="l"><button class="btn" type="submit" id="csave">Simpan</button><button class="btn ghost" type="button" id="ccancel">Batal</button></div>
      ${row ? '<button class="btn danger" type="button" id="cdel">Hapus</button>' : ""}</div>`;
    dlgOpen($("#cdlg"));
    wireForm();
  }

  function setMsg(type, text) { const el = $("#cmsg"); if (!el) return; el.className = "msg show " + type; el.textContent = text; }

  function wireForm() {
    $("#ccancel").addEventListener("click", () => dlgClose($("#cdlg")));
    const del = $("#cdel");
    if (del) del.addEventListener("click", async () => {
      const C = COLS[st.key];
      if (!confirm("Hapus " + C.one + " ini? Tindakan ini tidak dapat dibatalkan." + (C.deleteWarn ? "\n\n" + C.deleteWarn : ""))) return;
      const { error } = await Auth.client.from(C.table).delete().eq(C.pk, st.editing[C.pk]);
      if (error) { setMsg("err", dbError(error)); return; }
      dlgClose($("#cdlg")); toast(C.one[0].toUpperCase() + C.one.slice(1) + " dihapus."); await show(st.key);
    });

    // unggah foto / file
    $$("#cform .imgbox").forEach(box => {
      if (box.dataset.kind === "video") { wireVideo(box); return; }
      const up = $(".up", box), rm = $(".rm", box), urlin = $(".urlin", box), stEl = $(".upst", box);
      const prev = $(".imgprev", box);
      const refreshPrev = () => { if (prev) prev.innerHTML = urlin.value ? `<img src="${esc(urlin.value)}" alt="" onerror="this.replaceWith(document.createTextNode('Foto tidak dapat ditampilkan'))">` : "<span>Belum ada foto</span>"; };
      urlin.addEventListener("change", refreshPrev);
      rm.addEventListener("click", () => { urlin.value = ""; up.value = ""; stEl.textContent = ""; refreshPrev(); });
      up.addEventListener("change", async () => {
        const file = up.files[0]; if (!file) return;
        stEl.className = "upst"; stEl.textContent = "Mengunggah...";
        try {
          let url;
          if (box.dataset.kind === "image") {
            if (!/^image\//.test(file.type)) throw new Error("Pilih file gambar (JPG, PNG, atau WebP).");
            const r = await compressImage(file, 1600, box.dataset.folder === "artikel" ? 300 * 1024 : 0);
            url = await uploadTo(box.dataset.folder, r.blob, file.name.replace(/\.[^.]+$/, ""), r.ext, r.type);
          } else {
            const ext = extOf(file.name);
            if (!MIME[ext] || ["jpg", "jpeg", "png", "webp", "gif", ...VIDEO_EXT].includes(ext)) throw new Error("Gunakan file PDF, Word, Excel, atau PowerPoint. Untuk video, gunakan kolom Video.");
            if (file.size > 10 * 1024 * 1024) throw new Error("Ukuran file maksimal 10 MB.");
            url = await uploadTo(box.dataset.folder, file, file.name.replace(/\.[^.]+$/, ""), ext, MIME[ext]);
            const fk = box.dataset.fmtkey, sel = fk && $(`#cform [data-k="${fk}"]`);
            const f = ext.startsWith("doc") ? "DOCX" : ext.startsWith("xls") ? "XLSX" : ext.startsWith("ppt") ? "PPTX" : "PDF";
            if (sel) { if (![...sel.options].some(o => o.value === f)) sel.add(new Option(f, f)); sel.value = f; }
          }
          urlin.value = url; refreshPrev();
          stEl.className = "upst ok"; stEl.textContent = "Berhasil diunggah. Klik Simpan untuk menerapkan.";
        } catch (e) {
          stEl.className = "upst err"; stEl.textContent = e && e.message && !e.statusCode && !e.error ? e.message : dbError(e);
        }
        up.value = "";
      });
    });

    // editor isi artikel
    const bodyed = $("#cform .bodyed");
    if (bodyed) {
      const blks = $(".blks", bodyed);
      const add = isH => { blks.insertAdjacentHTML("beforeend", blockHTML(isH ? { h: "" } : "")); const last = blks.lastElementChild; $("textarea,input", last).focus(); };
      $(".addp", bodyed).addEventListener("click", () => add(false));
      $(".addh", bodyed).addEventListener("click", () => add(true));
      blks.addEventListener("click", e => {
        const b = e.target.closest(".blk"); if (!b) return;
        if (e.target.closest(".bdel")) b.remove();
        else if (e.target.closest(".bup") && b.previousElementSibling) b.parentNode.insertBefore(b, b.previousElementSibling);
        else if (e.target.closest(".bdn") && b.nextElementSibling) b.parentNode.insertBefore(b.nextElementSibling, b);
      });
    }

    $("#cform").onsubmit = onSave;
  }

  function collect(C) {
    const out = {};
    const flat = C.fields.flatMap(f => f.row ? f.row : [f]);
    for (const f of flat) {
      const el = $(`#cform [data-k="${f.k}"]`);
      if (!el) continue;
      switch (f.type) {
        case "check": out[f.k] = el.checked; break;
        case "number": out[f.k] = el.value === "" ? 0 : parseInt(el.value, 10) || 0; break;
        case "tags": out[f.k] = el.value.split(",").map(t => t.replace(/[#\s]+/g, "")).filter(Boolean); break;
        case "image": case "file": case "video": out[f.k] = ($(".urlin", el).value || "").trim(); break;
        case "body": out[f.k] = $$(".blk", el).map(b => {
          const t = $("textarea,input", b).value.trim();
          return b.dataset.t === "h" ? (t ? { h: t } : null) : (t || null);
        }).filter(x => x !== null); break;
        default: out[f.k] = el.value.trim();
      }
    }
    return out;
  }

  async function onSave(e) {
    e.preventDefault();
    const C = COLS[st.key];
    const vals = collect(C);
    for (const f of C.fields.flatMap(f => f.row ? f.row : [f])) {
      if (f.req && !vals[f.k]) { setMsg("err", `Kolom "${f.label}" wajib diisi.`); return; }
    }
    const btn = $("#csave"); btn.disabled = true; btn.textContent = "Menyimpan...";
    vals.updated_at = new Date().toISOString();
    let error;
    if (st.editing) {
      ({ error } = await Auth.client.from(C.table).update(vals).eq(C.pk, st.editing[C.pk]));
    } else {
      if (C.idFrom) {
        const base = slugify(vals[C.idFrom]);
        let id = base, n = 2;
        const used = new Set(st.rows.map(r => r[C.pk]));
        while (used.has(id)) id = base + "-" + (n++);
        vals.id = id;
      }
      ({ error } = await Auth.client.from(C.table).insert(vals));
    }
    if (!error && st.key === "groups" && st.editing && st.editing.name !== vals.name) {
      const r2 = await Auth.client.from("site_services").update({ grp: vals.name }).eq("grp", st.editing.name);
      if (r2.error) toast("Tab tersimpan, tetapi layanan gagal dipindahkan: " + dbError(r2.error));
    }
    btn.disabled = false; btn.textContent = "Simpan";
    if (error) { setMsg("err", dbError(error)); return; }
    dlgClose($("#cdlg"));
    toast("Tersimpan. Perubahan langsung tampil di situs.");
    await show(st.key);
  }

  /* ---------- Pengaturan situs ---------- */
  const SET_FIELDS = [
    ["company", "Nama perusahaan"], ["address", "Alamat kantor"], ["mapsUrl", "Tautan peta (Google Maps, opsional)"],
    ["email", "Email"], ["whatsapp", "Nomor WhatsApp (format 62812xxxxxxx, tanpa tanda plus)"], ["whatsappLabel", "Nomor WhatsApp yang ditampilkan"], ["hours", "Jam layanan"], ["credit", "Tulisan kredit di bawah footer (kosongkan untuk menyembunyikan)"]
  ];
  const TEXT_KEYS = ["heroTitle", "heroLead", "servicesIntro", "aboutP1", "aboutP2"];
  function pillarRowHTML(p) {
    return `<div class="blk"><div class="blkhead"><span class="chip admin">Pilar</span><span class="acts"><button type="button" class="btn ghost sm prm">Hapus</button></span></div>
      <input class="pt" value="${esc(p.title)}" placeholder="Judul pilar" aria-label="Judul pilar"><textarea class="px" placeholder="Penjelasan singkat" aria-label="Penjelasan pilar">${esc(p.text)}</textarea></div>`;
  }

  function typeRowHTML(t) {
    return `<div class="blk" data-id="${esc(t.id || "")}"><div class="blkhead"><span class="chip admin">Jenis</span><span class="acts"><button type="button" class="btn ghost sm trm">Hapus</button></span></div>
      <input class="tl" value="${esc(t.label)}" placeholder="Nama jenis, misalnya Hari Besar" aria-label="Nama jenis">
      <input class="tld" value="${esc(t.lead || "")}" placeholder="Kalimat pembuka halaman (opsional)" aria-label="Kalimat pembuka"></div>`;
  }

  function imgBoxHTML(key, folder, label, value, maxW, help) {
    return `<div class="imgbox" data-k="${key}" data-folder="${folder}" data-kind="image" data-maxw="${maxW}">
      <strong>${esc(label)}</strong>
      <div class="imgprev">${value ? `<img src="${esc(value)}" alt="">` : "<span>Belum ada foto</span>"}</div>
      <div class="imgctl"><input type="file" accept="image/*" class="up" aria-label="Pilih foto"><button type="button" class="btn ghost sm rm">Hapus foto</button><span class="upst" role="status"></span></div>
      <label>Alamat gambar <input class="urlin" value="${esc(value)}" placeholder="Terisi otomatis setelah unggah"></label>${help ? `<span class="fhelp">${esc(help)}</span>` : ""}</div>`;
  }

  function wireBox(box) {
    const up = $(".up", box), rm = $(".rm", box), urlin = $(".urlin", box), stEl = $(".upst", box), prev = $(".imgprev", box);
    const folder = box.dataset.folder || "umum", maxW = parseInt(box.dataset.maxw, 10) || 1600;
    const refreshPrev = () => { prev.innerHTML = urlin.value ? `<img src="${esc(urlin.value)}" alt="" onerror="this.replaceWith(document.createTextNode('Foto tidak dapat ditampilkan'))">` : "<span>Belum ada foto</span>"; };
    urlin.addEventListener("change", refreshPrev);
    rm.addEventListener("click", () => { urlin.value = ""; up.value = ""; stEl.textContent = ""; refreshPrev(); });
    up.addEventListener("change", async () => {
      const file = up.files[0]; if (!file) return;
      stEl.className = "upst"; stEl.textContent = "Mengunggah...";
      try {
        if (!/^image\//.test(file.type)) throw new Error("Pilih file gambar (JPG, PNG, atau WebP).");
        const r = await compressImage(file, maxW);
        urlin.value = await uploadTo(folder, r.blob, file.name.replace(/\.[^.]+$/, ""), r.ext, r.type);
        refreshPrev(); stEl.className = "upst ok"; stEl.textContent = "Berhasil diunggah. Klik Simpan pengaturan untuk menerapkan.";
      } catch (e) { stEl.className = "upst err"; stEl.textContent = e && e.message && !e.statusCode && !e.error ? e.message : dbError(e); }
      up.value = "";
    });
  }

  async function showSettings() {
    const box = $("#settings-panel");
    box.innerHTML = '<p class="empty">Memuat...</p>';
    const { data, error } = await Auth.client.from("site_settings").select("key,value");
    if (error) { box.innerHTML = `<p class="empty">${esc(dbError(error))}</p>`; return; }
    const D = clone(window.DEFAULTS ? window.DEFAULTS.CONFIG : window.CONFIG);
    let types = clone((window.DEFAULTS && window.DEFAULTS.MEDIA_TYPES) || []);
    let cats = clone((window.DEFAULTS && window.DEFAULTS.CATEGORIES) || window.CATEGORIES || []);
    (data || []).forEach(r => {
      if (r.key === "pillars" && Array.isArray(r.value) && r.value.length) D.pillars = r.value;
      else if (r.key === "categories" && Array.isArray(r.value) && r.value.length) cats = r.value;
      else if (r.key === "mediaTypes" && Array.isArray(r.value) && r.value.length) types = r.value;
      else if (typeof r.value === "string") D[r.key] = r.value;
    });
    box.innerHTML = `<div class="chead"><h2>Pengaturan situs</h2></div>
      <p class="note2">Perubahan di sini tampil langsung di beranda dan footer. Nama dan logo situs diubah lewat file, bukan di sini.</p>
      <form id="sform" class="setgrid" novalidate>
        <h3>Informasi perusahaan dan kontak</h3>
        ${SET_FIELDS.map(([k, l]) => `<label>${esc(l)}<input data-s="${k}" value="${esc(D[k] || "")}"></label>`).join("")}
        <h3>Teks halaman depan</h3>
        <p class="fhelp">Gunakan {nama}, {tagline}, dan {perusahaan} untuk menyisipkan nilai otomatis dari pengaturan situs.</p>
        <label>Judul besar di beranda<input data-s="heroTitle" value="${esc(D.heroTitle || "")}"></label>
        <label>Kalimat di bawah judul<textarea data-s="heroLead">${esc(D.heroLead || "")}</textarea></label>
        <label>Pengantar bagian Layanan<textarea data-s="servicesIntro">${esc(D.servicesIntro || "")}</textarea></label>
        <label>Bagian Tentang, paragraf 1<textarea data-s="aboutP1">${esc(D.aboutP1 || "")}</textarea></label>
        <label>Bagian Tentang, paragraf 2<textarea data-s="aboutP2">${esc(D.aboutP2 || "")}</textarea></label>
        <h3>Pilar di bagian Tentang</h3>
        <div class="stl" id="pil">${(D.pillars || []).map(pillarRowHTML).join("")}</div>
        <div><button type="button" class="btn ghost sm" id="piladd">+ Tambah pilar</button></div>
        <h3>Daftar kategori artikel</h3>
        <label>Satu kategori per baris<textarea data-s="categories" style="min-height:140px">${esc(cats.join("\n"))}</textarea><span class="fhelp">Daftar ini muncul sebagai pilihan Kategori saat membuat artikel.</span></label>
        <h3>Jenis konten (tab pada halaman Kabar &amp; Media)</h3>
        <p class="fhelp">Jenis konten tampil sebagai tab dan di menu Media. Menghapus jenis tidak menghapus artikelnya, tetapi artikel itu hanya tampil di tab Semua.</p>
        <div class="stl" id="typ">${types.map(typeRowHTML).join("")}</div>
        <div><button type="button" class="btn ghost sm" id="typadd">+ Tambah jenis</button></div>
        <h3>Tampilan bagian atas beranda (hero)</h3>
        <label>Tata letak<select data-s="heroLayout">
          <option value="standar"${D.heroLayout !== "terpusat" ? " selected" : ""}>Standar: judul dan pencarian rata kiri</option>
          <option value="terpusat"${D.heroLayout === "terpusat" ? " selected" : ""}>Terpusat: judul, pencarian, dan kartu statistik berada di tengah</option>
        </select></label>
        ${imgBoxHTML("heroImage", "hero", "Foto latar", D.heroImage || "", 2000, "Pakai foto lebar (landscape), minimal 1600 piksel. Boleh dikosongkan untuk latar polos.")}
        <label>Gelapnya lapisan di atas foto: <output id="hov"></output>
          <input type="range" min="20" max="90" step="5" data-s="heroOverlay" value="${esc(D.heroOverlay || "65")}">
          <span class="fhelp">Makin gelap, makin mudah dibaca. Naikkan jika foto Anda terang atau ramai.</span></label>
        <h3>Foto tim (bagian Tentang)</h3>
        ${imgBoxHTML("teamPhoto", "tim", "Foto tim", D.teamPhoto || "", 1600, "")}
        <div class="msg" id="smsg" role="alert"></div>
        <div><button class="btn" type="submit" id="ssave">Simpan pengaturan</button></div>
      </form>`;
    wireSettings();
  }

  function wireSettings() {
    const form = $("#sform");
    $("#piladd").addEventListener("click", () => $("#pil").insertAdjacentHTML("beforeend", pillarRowHTML({ title: "", text: "" })));
    $("#pil").addEventListener("click", e => { const b = e.target.closest(".prm"); if (b) b.closest(".blk").remove(); });
    $("#typadd").addEventListener("click", () => $("#typ").insertAdjacentHTML("beforeend", typeRowHTML({ id: "", label: "", lead: "" })));
    $("#typ").addEventListener("click", e => { const b = e.target.closest(".trm"); if (b) b.closest(".blk").remove(); });
    $$(".imgbox", form).forEach(wireBox);
    const ov = $("[data-s=heroOverlay]", form), ovOut = $("#hov");
    const showOv = () => { ovOut.textContent = ov.value + "%"; };
    ov.addEventListener("input", showOv); showOv();

    form.onsubmit = async e => {
      e.preventDefault();
      const msg = $("#smsg");
      const rows = SET_FIELDS.map(([k]) => ({ key: k, value: $(`[data-s="${k}"]`, form).value.trim() }));
      rows.push({ key: "teamPhoto", value: $('.imgbox[data-k="teamPhoto"] .urlin', form).value.trim() });
      rows.push({ key: "heroImage", value: $('.imgbox[data-k="heroImage"] .urlin', form).value.trim() });
      rows.push({ key: "heroLayout", value: $("[data-s=heroLayout]", form).value });
      rows.push({ key: "heroOverlay", value: $("[data-s=heroOverlay]", form).value });
      TEXT_KEYS.forEach(k => rows.push({ key: k, value: $(`[data-s="${k}"]`, form).value.trim() }));
      rows.push({ key: "pillars", value: $$("#pil .blk", form).map(b => ({ title: $(".pt", b).value.trim(), text: $(".px", b).value.trim() })).filter(p => p.title || p.text) });
      rows.push({ key: "categories", value: $('[data-s="categories"]', form).value.split("\n").map(x => x.trim()).filter(Boolean) });
      const used = new Set();
      const typeRows = $$("#typ .blk", form).map(b => {
        const label = $(".tl", b).value.trim(); if (!label) return null;
        let id = b.dataset.id || slugify(label), base = id, n = 2;
        while (used.has(id)) id = base + "-" + (n++);
        used.add(id);
        return { id, label, lead: $(".tld", b).value.trim() };
      }).filter(Boolean);
      if (typeRows.length) rows.push({ key: "mediaTypes", value: typeRows });
      const btn = $("#ssave"); btn.disabled = true; btn.textContent = "Menyimpan...";
      const stamp = new Date().toISOString();
      const { error } = await Auth.client.from("site_settings").upsert(rows.map(r => ({ ...r, updated_at: stamp })), { onConflict: "key" });
      btn.disabled = false; btn.textContent = "Simpan pengaturan";
      if (error) { msg.className = "msg show err"; msg.textContent = dbError(error); return; }
      msg.className = "msg show ok"; msg.textContent = "Tersimpan. Perubahan langsung tampil di situs.";
      toast("Pengaturan tersimpan.");
    };
  }

  /* ---------- Papan Informasi KPLH ---------- */
  function krowHTML(r) {
    return `<div class="krow"><input class="kl" value="${esc(r.label)}" placeholder="Uraian" aria-label="Uraian"><input class="ko" value="${esc(r.objective)}" aria-label="Objective"><input class="km" value="${esc(r.mtd)}" aria-label="MTD"><input class="ky" value="${esc(r.ytd)}" aria-label="YTD"><input class="kp" value="${esc(r.ptd)}" aria-label="PTD">
      <span class="acts"><button type="button" class="btn ghost sm kup" aria-label="Pindah ke atas">&uarr;</button><button type="button" class="btn ghost sm kdn" aria-label="Pindah ke bawah">&darr;</button><button type="button" class="btn ghost sm kdl">Hapus</button></span></div>`;
  }

  async function showKplh() {
    const box = $("#kplh-panel");
    box.innerHTML = '<p class="empty">Memuat...</p>';
    const { data, error } = await Auth.client.from("site_settings").select("value").eq("key", "kplh").maybeSingle();
    if (error) { box.innerHTML = `<p class="empty">${esc(dbError(error))}</p>`; return; }
    const base = clone(window.DEFAULTS.KPLH);
    const v = data && data.value;
    const K = v && typeof v === "object" ? Object.assign(base, v) : base;
    if (!Array.isArray(K.rows)) K.rows = clone(window.DEFAULTS.KPLH.rows);
    box.innerHTML = `<div class="chead"><h2>Papan Informasi KPLH</h2></div>
      <p class="note2">Papan di beranda meniru papan informasi di lapangan. Ubah judul, periode, dan angka di sini, lalu klik Simpan. Perubahan langsung tampil di beranda dan bisa dicetak dari tombol Cetak papan.</p>
      <form id="kform" class="setgrid" novalidate>
        <h3>Judul dan periode</h3>
        <label>Judul baris 1<input data-kk="title1" value="${esc(K.title1)}"></label>
        <label>Judul baris 2 (perusahaan dan lokasi)<input data-kk="title2" value="${esc(K.title2)}"></label>
        <div class="frow"><label>Bulan<input data-kk="bulan" value="${esc(K.bulan)}" placeholder="OKTOBER"></label><label>Tahun<input data-kk="tahun" value="${esc(K.tahun)}" placeholder="2026"></label></div>
        <label>Teks di bawah logo<input data-kk="logoText" value="${esc(K.logoText)}"></label>
        <h3>Tabel statistik</h3>
        <p class="fhelp">Nilai boleh berisi angka atau tanda minus (-). Baris dapat ditambah, dihapus, dan dipindah urutannya.</p>
        <div class="ktab" id="ktab"><div class="krow khead"><span>Uraian (STATISTIC)</span><span>OBJECTIVE</span><span>MTD</span><span>YTD</span><span>PTD</span><span></span></div><div id="krows">${K.rows.map(krowHTML).join("")}</div></div>
        <div class="fact"><div class="l"><button type="button" class="btn ghost sm" id="kadd">+ Tambah baris</button><button type="button" class="btn ghost sm" id="kreset">Kembalikan ke isi contoh</button></div></div>
        <h3>Kolom SHE INFORMATION</h3>
        <label>Teks informasi<textarea data-kk="infoText" placeholder="Kosongkan jika kolom ini ingin dibiarkan kosong">${esc(K.infoText)}</textarea></label>
        ${imgBoxHTML("infoImage", "papan", "Gambar informasi (opsional, misalnya poster)", K.infoImage || "", 1200, "Tampil di dalam kolom SHE INFORMATION.")}
        <div class="msg" id="kmsg" role="alert"></div>
        <div><button class="btn" type="submit" id="ksave">Simpan papan</button></div>
      </form>`;
    const form = $("#kform");
    $$(".imgbox", form).forEach(wireBox);
    $("#kadd").addEventListener("click", () => { $("#krows").insertAdjacentHTML("beforeend", krowHTML({ label: "", objective: "", mtd: "", ytd: "", ptd: "" })); $$(".kl", form).pop().focus(); });
    $("#kreset").addEventListener("click", () => {
      if (!confirm("Ganti tabel dengan isi contoh? Perubahan baru tersimpan setelah Anda klik Simpan papan.")) return;
      $("#krows").innerHTML = window.DEFAULTS.KPLH.rows.map(krowHTML).join("");
    });
    $("#krows").addEventListener("click", e => {
      const r = e.target.closest(".krow"); if (!r) return;
      if (e.target.closest(".kdl")) r.remove();
      else if (e.target.closest(".kup") && r.previousElementSibling) r.parentNode.insertBefore(r, r.previousElementSibling);
      else if (e.target.closest(".kdn") && r.nextElementSibling) r.parentNode.insertBefore(r.nextElementSibling, r);
    });
    form.onsubmit = async e => {
      e.preventDefault();
      const msg = $("#kmsg");
      const g = k => $(`[data-kk="${k}"]`, form).value.trim();
      const rows = $$("#krows .krow", form).map(r => ({ label: $(".kl", r).value.trim(), objective: $(".ko", r).value.trim(), mtd: $(".km", r).value.trim(), ytd: $(".ky", r).value.trim(), ptd: $(".kp", r).value.trim() }))
        .filter(r => r.label || r.objective || r.mtd || r.ytd || r.ptd);
      const value = { title1: g("title1"), title2: g("title2"), bulan: g("bulan"), tahun: g("tahun"), logoText: g("logoText"), rows, infoText: g("infoText"), infoImage: $('.imgbox[data-k="infoImage"] .urlin', form).value.trim() };
      const btn = $("#ksave"); btn.disabled = true; btn.textContent = "Menyimpan...";
      const { error: err } = await Auth.client.from("site_settings").upsert([{ key: "kplh", value, updated_at: new Date().toISOString() }], { onConflict: "key" });
      btn.disabled = false; btn.textContent = "Simpan papan";
      if (err) { msg.className = "msg show err"; msg.textContent = dbError(err); return; }
      msg.className = "msg show ok"; msg.textContent = "Tersimpan. Papan di beranda langsung diperbarui.";
      toast("Papan KPLH tersimpan.");
    };
  }

  /* ---------- Sambungan ke halaman admin ---------- */
  let inited = false;
  function init() {
    if (inited || !$("#c-add")) return;
    inited = true;
    $("#c-add").addEventListener("click", () => openForm(null));
    $("#c-import").addEventListener("click", importDefaults);
    $("#c-list").addEventListener("click", e => {
      const b = e.target.closest("[data-edit]"); if (!b) return;
      openForm(st.rows[+b.dataset.edit]);
    });
    $("#cdlg").addEventListener("click", e => { if (e.target === $("#cdlg")) dlgClose($("#cdlg")); });
  }
  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  window.AdminContent = { show, showSettings, showKplh, COLS };
})();
