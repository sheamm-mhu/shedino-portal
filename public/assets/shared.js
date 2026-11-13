/* SHEDINO - skrip bersama untuk beranda, layanan, kabar/edukasi, dan artikel.
   Memerlukan (berurutan): vendor/supabase.js, config.js, auth.js, data.js */
(function () {
  "use strict";
  const C = window.CONFIG;

  /* ---------- Helper ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = iso => new Date(iso + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const pageName = (location.pathname.split("/").pop() || "index").replace(/\.html$/, "") || "index";

  /* Ikon (path SVG 24x24) */
  const I = {
    users:"M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1",
    cal:"M5 5h14v15H5zM5 9h14M9 3v4M15 3v4",
    monitor:"M3 5h18v11H3zM8 20h8M12 16v4",
    truck:"M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19h.01M17 19h.01",
    doc:"M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
    book:"M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14",
    flag:"M5 21V4M5 4h11l-2 4 2 4H5",
    search:"M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
    news:"M5 4h14v16H5zM9 9h6M9 13h6M9 17h3",
    file:"M6 3h9l4 4v14H6zM14 3v5h5",
    shield:"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    pulse:"M3 12h4l2-5 4 10 2-5h6",
    leaf:"M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l8-8",
    alert:"M12 4l9 16H3zM12 10v4M12 17h.01",
    lock:"M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3",
    chart:"M4 20V10M10 20V4M16 20v-8M22 20H2",
    clip:"M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h6",
    idcard:"M3 6h18v12H3zM8 11a2 2 0 1 0 .01 0M14 10h4M14 14h4",
    helmet:"M4 16a8 8 0 0 1 16 0zM2 16h20M12 8V5",
    stop:"M8 3h8l5 5v8l-5 5H8l-5-5V8zM8 12h8",
    sign:"M12 3v18M6 6h12v6H6z",
    chat:"M4 5h16v11H9l-5 4z",
    mail:"M3 6h18v12H3zM3 7l9 7 9-7",
    clock:"M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    pin:"M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 12a2 2 0 1 0 .01 0",
    check:"M5 12l4 4 10-10",
    link:"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
  };
  /* Pencarian aman: hanya kunci milik sendiri (bukan constructor, __proto__, dan sejenisnya) */
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const TONES = ["blue", "teal", "amber", "red", "gray"];
  const safeTone = t => TONES.indexOf(t) >= 0 ? t : "gray";
  const icon = d => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  /* Logo WhatsApp (Simple Icons, CC0) */
  const playIcon = `<svg class="ico ico-fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>`;
  const waIcon = `<svg class="ico ico-fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>`;

  /* ---------- Tab layanan dan kartu layanan ---------- */
  const groupList = () => (window.GROUPS || []).slice();
  const groupByName = n => groupList().find(g => g.name === n) || { id: "", name: n, icon: "file", tone: "gray", url: "", note: "" };
  /* Layanan yang kelompoknya tidak ada di daftar tab dikumpulkan sebagai kelompok tambahan */
  function allGroups() {
    const base = groupList().filter(g => !g.url);
    const names = new Set(base.map(g => g.name));
    const extra = [];
    (window.SERVICES || []).forEach(s => { if (s.group && !names.has(s.group)) { names.add(s.group); extra.push(groupByName(s.group)); } });
    return base.concat(extra);
  }
  const safe = u => (window.safeUrl ? window.safeUrl(u) : u);
  function serviceCardHTML(s) {
    const g = groupByName(s.group);
    return `<article class="scard" id="${esc(s.id)}">
      <span class="sic t-${safeTone(g.tone)}">${icon(iconOf(s.icon))}</span>
      <span class="badge ${s.login ? "lock" : "open"}">${s.login ? icon(I.lock) + " Perlu login" : "Terbuka"}</span>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.desc)}</p>
      <button class="sbtn" type="button" data-svc="${esc(s.id)}">${esc(s.btnLabel || "Buka layanan")}</button>
    </article>`;
  }
  /* Tab pil: tab biasa menyaring layanan, tab dengan "url" menjadi tautan ke halaman lain */
  function groupTabsHTML(active, withAll) {
    const out = [];
    if (withAll) out.push(`<button class="gtab" type="button" data-g="Semua" aria-pressed="${active === "Semua"}"><i class="dot"></i>Semua</button>`);
    groupList().forEach(g => {
      const ic = icon(iconOf(g.icon));
      if (g.url) {
        const u = safe(g.url), ext = /^https?:/i.test(u);
        if (u) out.push(`<a class="gtab" href="${esc(u)}"${ext ? ' target="_blank" rel="noopener"' : ""}><i class="dot"></i>${ic}${esc(g.name)}<span class="ext" aria-hidden="true">&nearr;</span></a>`);
      } else {
        out.push(`<button class="gtab" type="button" data-g="${esc(g.name)}" aria-pressed="${g.name === active}"><i class="dot"></i>${ic}${esc(g.name)}</button>`);
      }
    });
    return out.join("");
  }
  /* Teks halaman: {nama}, {tagline}, {perusahaan} diganti dengan pengaturan situs */
  const tx = str => String(str == null ? "" : str).replace(/\{nama\}/g, C.name).replace(/\{tagline\}/g, C.tagline).replace(/\{perusahaan\}/g, C.company);
  const CAT_META = {
    "Keselamatan Kerja": { tone: "blue", icon: "shield" },
    "Kesehatan Kerja": { tone: "teal", icon: "pulse" },
    "Lingkungan Hidup": { tone: "teal", icon: "leaf" },
    "Prosedur Kerja": { tone: "gray", icon: "file" },
    "Tanggap Darurat": { tone: "red", icon: "alert" },
    "Pengoperasian Unit": { tone: "amber", icon: "truck" },
    "Organisasi & Sistem Manajemen": { tone: "gray", icon: "users" }
  };
  const catMeta = c => own(CAT_META, c) ? CAT_META[c] : { tone: "gray", icon: "news" };
  const catTone = c => catMeta(c).tone;
  const iconOf = (name, fb) => own(I, name) ? I[name] : (fb || I.file);

  function cover(m) {
    const meta = catMeta(m.category);
    const play = m.videoUrl ? `<span class="playbadge" aria-hidden="true">${playIcon}</span>` : "";
    const img = m.image ? `<img src="${esc(m.image)}" alt="" loading="lazy" onerror="this.remove()" onload="coverFit(this)">` : "";
    return `<div class="cover t-${meta.tone}">${icon(iconOf(meta.icon, I.news))}${img}${play}</div>`;
  }
  function cardHTML(m, lvl) {
    lvl = lvl === 2 || lvl === 4 ? lvl : 3;   // hanya h2, h3, atau h4 (jangan terpengaruh indeks dari map)
    return `<a class="card" href="artikel.html?id=${encodeURIComponent(m.id)}">
      ${cover(m)}
      <div class="cb">
        <div class="meta"><span class="cat t-${catTone(m.category)}">${esc(m.category)}</span><time datetime="${esc(m.date)}">${fmtDate(m.date)}</time></div>
        <h${lvl}>${esc(m.title)}</h${lvl}>
        <p>${esc(m.excerpt)}</p>
        <div class="tags">${m.videoUrl ? '<span class="tag">Video</span>' : ""}${m.fileUrl ? '<span class="tag">Ada lampiran</span>' : ""}${(m.tags || []).slice(0, 3).map(t => `<span class="tag">#${esc(t)}</span>`).join("")}</div>
      </div></a>`;
  }

  /* Sampul kartu mengisi penuh tanpa sisi kosong. Bentuk kotak mengikuti bentuk gambar (antara 4:5 dan 16:9);
     gambar yang lebih ekstrem dipotong sedikit. Gambar utuh tanpa potongan tampil di halaman artikel. */
  window.coverFit = function (img) {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return;
    img.parentElement.style.aspectRatio = String(Math.min(1.78, Math.max(0.8, w / h)));
  };

  /* Baris yang bisa digeser ke samping: tombol panah, usap (layar sentuh), roda/trackpad, dan seret dengan mouse */
  function carousel(row, ctl) {
    const wrap = row.parentElement;
    const prev = ctl && ctl.querySelector('[data-dir="-1"]'), next = ctl && ctl.querySelector('[data-dir="1"]');
    const update = () => {
      const max = row.scrollWidth - row.clientWidth, x = row.scrollLeft;
      if (prev) prev.disabled = !(x > 4);
      if (next) next.disabled = !(x < max - 4);
      if (ctl) ctl.hidden = max <= 4;
      wrap.classList.toggle("has-prev", x > 4);
      wrap.classList.toggle("has-next", x < max - 4);
    };
    if (!row._hs) {
      row._hs = true;
      row.addEventListener("scroll", () => { if (!row._raf) row._raf = requestAnimationFrame(() => { row._raf = 0; update(); }); }, { passive: true });
      window.addEventListener("resize", update);
      if (ctl) ctl.addEventListener("click", e => {
        const b = e.target.closest("[data-dir]"); if (!b) return;
        const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
        row.scrollBy({ left: (+b.dataset.dir) * Math.max(row.clientWidth * 0.85, 280), behavior: reduce ? "auto" : "smooth" });
      });
      let sx = 0, sl = 0, down = false, moved = false;
      row.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse" || e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = row.scrollLeft; });
      row.addEventListener("pointermove", e => {
        if (!down) return;
        const dx = e.clientX - sx;
        if (!moved && Math.abs(dx) > 6) { moved = true; row.classList.add("dragging"); try { row.setPointerCapture(e.pointerId); } catch (err) { /* abaikan */ } }
        if (moved) row.scrollLeft = sl - dx;
      });
      const end = () => { if (!down) return; down = false; if (moved) { row.classList.remove("dragging"); row._noclick = true; setTimeout(() => { row._noclick = false; }, 0); } };
      row.addEventListener("pointerup", end); row.addEventListener("pointercancel", end); row.addEventListener("lostpointercapture", end);
      row.addEventListener("click", e => { if (row._noclick) { e.preventDefault(); e.stopPropagation(); } }, true);
      row.addEventListener("dragstart", e => e.preventDefault());
    }
    row.scrollLeft = 0;
    update();
    setTimeout(update, 300);
  }

  /* ---------- Bagikan ke WhatsApp ---------- */
  const longDate = iso => { const d = new Date(iso + "T00:00:00"); return isNaN(d) ? "" : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }); };
  /* Tautan untuk dibagikan: alamat /s/<id> agar WhatsApp dan sejenisnya menampilkan pratinjau (judul, ringkasan, gambar) artikel ini */
  function shareLink(m) {
    const C = window.CONFIG || {};
    if (C.sharePreview !== false && /^https?:$/.test(location.protocol)) return location.origin + "/s/" + encodeURIComponent(m.id);
    return location.href.split("#")[0];
  }
  /* Teks keterangan seperti kiriman di Saluran WhatsApp: judul tebal, tanggal, kutipan, tagar, lalu tautan */
  function shareCaption(m, link) {
    const lines = ["*" + String(m.title || "").replace(/\*/g, "") + "*"];
    const d = longDate(m.date);
    if (d) lines.push("Tanggal Publish : " + d);
    let ex = String(m.excerpt || "").trim();
    if (ex.length > 600) ex = ex.slice(0, 597).trimEnd() + "...";
    if (ex) lines.push("", ex);
    const tags = (m.tags || []).map(t => "#" + String(t).replace(/^#/, "").replace(/\s+/g, "")).filter(t => t.length > 1);
    if (tags.length) lines.push("", tags.join("\n"));
    lines.push("", link);
    return lines.join("\n");
  }
  /* Ambil gambar sampul sebagai berkas agar bisa dikirim langsung lewat menu bagikan (perlu server gambar mengizinkan CORS) */
  async function shareFile(m) {
    if (!m.image) return null;
    try {
      const r = await fetch(m.image, { mode: "cors" });
      if (!r.ok) return null;
      const b = await r.blob();
      if (!/^image\//.test(b.type) || b.size > 8 * 1024 * 1024) return null;
      const ext = /png/.test(b.type) ? "png" : /webp/.test(b.type) ? "webp" : "jpg";
      return new File([b], String(m.id || "gambar").replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 60) + "." + ext, { type: b.type });
    } catch (e) { return null; }
  }

  /* ---------- Video: tautan YouTube, Vimeo, Google Drive, atau file video langsung ---------- */
  function videoEmbed(u) {
    u = safe(String(u || "").trim());
    if (!u) return null;
    let m;
    if ((m = u.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/|v\/)|youtube-nocookie\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/i)))
      return { kind: "iframe", src: "https://www.youtube-nocookie.com/embed/" + m[1] + "?rel=0" };
    if ((m = u.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(?:[^?#]*\/)?(\d{6,12})(?:[/?#].*)?$/i)))
      return { kind: "iframe", src: "https://player.vimeo.com/video/" + m[1] };
    if ((m = u.match(/^https?:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/i)))
      return { kind: "iframe", src: "https://drive.google.com/file/d/" + m[1] + "/preview" };
    if (/\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i.test(u) || /\/storage\/v1\/object\/public\//.test(u)) return { kind: "file", src: u };
    return { kind: "link", src: u };
  }
  const videoMime = src => /\.webm(\?|$)/i.test(src) ? "video/webm" : /\.mov(\?|$)/i.test(src) ? "video/quicktime" : "video/mp4";

  /* ---------- Jenis konten ---------- */
  const mediaTypes = () => (window.MEDIA_TYPES || []).slice();
  const typeLabel = id => (mediaTypes().find(t => t.id === id) || { label: id }).label;

  /* ---------- Papan Informasi KPLH (replika papan di lapangan) ---------- */
  /* Tampilan papan untuk layar ponsel: tiap indikator menjadi satu blok (tabel asli sulit dibaca di layar sempit) */
  function mlist(K, rows, info) {
    const cell = (l, v) => `<div><small>${l}</small><b>${esc(v)}</b></div>`;
    return `<div class="kplh-mlist">${rows.map(r => `<div class="kplh-mrow"><div class="kplh-mlabel">${esc(r.label)}</div><div class="kplh-mvals">${cell("OBJECTIVE", r.objective)}${cell("MTD", r.mtd)}${cell("YTD", r.ytd)}${cell("PTD", r.ptd)}</div></div>`).join("")}
      ${info ? `<div class="kplh-minfo"><div class="kplh-mhead">SHE INFORMATION</div><div class="kplh-mbody">${info}</div></div>` : ""}</div>`;
  }
  function kplhHTML(K) {
    const rows = Array.isArray(K.rows) ? K.rows : [];
    const n = Math.max(rows.length, 1);
    const img = K.infoImage ? `<img class="kplh-infoimg" src="${esc(safe(K.infoImage))}" alt="Informasi SHE" onerror="this.remove()">` : "";
    const info = img + (K.infoText ? `<div>${esc(K.infoText)}</div>` : "");
    let body = rows.map((r, i) => `<tr><th scope="row">${esc(r.label)}</th><td>${esc(r.objective)}</td><td>${esc(r.mtd)}</td><td>${esc(r.ytd)}</td><td>${esc(r.ptd)}</td>${i === 0 ? `<td class="kplh-info" rowspan="${n}">${info}</td>` : ""}</tr>`).join("");
    if (!rows.length) body = `<tr><th scope="row"></th><td></td><td></td><td></td><td></td><td class="kplh-info">${info}</td></tr>`;
    return `<div class="kplh-bar">${esc(K.title1)}</div>
      <div class="kplh-bar">${esc(K.title2)}</div>
      <div class="kplh-top">
        <div class="kplh-period"><div>BULAN : ${esc(String(K.bulan || "").toUpperCase())}</div><div>TAHUN : ${esc(K.tahun)}</div></div>
        <span></span>
        <div class="kplh-logo"><img src="assets/logo-192.png" alt=""><span>${esc(K.logoText)}</span></div>
      </div>
      <table class="kplh-table">
        <colgroup><col style="width:41%"><col style="width:8.9%"><col style="width:10.7%"><col style="width:10.7%"><col style="width:13.4%"><col style="width:15.3%"></colgroup>
        <thead><tr><th scope="col">STATISTIC</th><th scope="col">OBJECTIVE</th><th scope="col">MTD</th><th scope="col">YTD</th><th scope="col">PTD</th><th scope="col">SHE INFORMATION</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      ${mlist(K, rows, info)}`;
  }

  function waLink() {
    const t = `Halo Admin ${C.name},\n\nMohon bantuannya terkait informasi berikut:\n\nNama :\nNRP :\nPerusahaan :\nPertanyaan :\n\nTerima kasih.\n\n> Dikirim melalui ${C.name}`;
    return "https://wa.me/" + String(C.whatsapp == null ? "" : C.whatsapp).replace(/\D/g, "") + "?text=" + encodeURIComponent(t);
  }

  /* ---------- Header, footer, tombol WhatsApp, dialog ---------- */
  /* Menu: "Media" berisi semua jenis konten (Kabar SHE, Edukasi, Hari Besar, Buletin, Kampanye, ...) */
  function navItems() {
    return [
      { k: "layanan", t: "Layanan", h: "layanan.html" },
      { k: "media", t: "Media", children: mediaTypes().map(t => ({ k: t.id, t: t.label, h: "media.html?tab=" + encodeURIComponent(t.id) })) },
      { k: "shegames", t: "SHEGAMES", h: "shegames.html" },
      { k: "dokumen", t: "Dokumen", h: "index.html#dokumen" },
      { k: "tentang", t: "Tentang", h: "index.html#tentang" },
      { k: "faq", t: "FAQ", h: "index.html#faq" },
      { k: "kontak", t: "Kontak", h: "index.html#kontak" }
    ];
  }
  function navHTML() {
    return navItems().map(n => n.children
      ? `<div class="dd"><span class="dd-label">${n.t}</span><button class="dd-btn" type="button" aria-expanded="false" aria-haspopup="true">${n.t} <span aria-hidden="true">&#9662;</span></button>
          <div class="dd-menu">${n.children.map(c => `<a href="${c.h}" data-k="${esc(c.k)}">${esc(c.t)}</a>`).join("")}<a href="media.html" data-k="_semua">Semua kabar &amp; media</a></div></div>`
      : `<a href="${n.h}" data-k="${n.k}">${n.t}</a>`).join("");
  }
  function footerLinks() {
    const out = [];
    navItems().forEach(n => n.children ? n.children.forEach(c => out.push(c)) : out.push(n));
    return out;
  }
  let navCurrent = null;
  function renderNav() {
    const box = $("#nav-links");
    if (box) box.innerHTML = navHTML();
    setNavCurrent(navCurrent);
  }

  function buildChrome() {
    const h = $("#site-header");
    if (h) {
      h.className = "top";
      h.innerHTML = `<div class="wrap">
        <a class="brand" href="index.html">
          <img class="brand-mark" src="assets/logo-192.png" width="40" height="40" alt="">
          <span class="brand-txt"><span>${esc(C.name)}</span><small>${esc(C.tagline)}</small></span>
        </a>
        <button class="burger" id="burger" aria-expanded="false" aria-controls="nav">Menu</button>
        <nav class="nav" id="nav" aria-label="Navigasi utama">
          <span id="nav-links" style="display:contents">${navHTML()}</span>
          <span class="who" id="who" hidden></span>
          <a href="admin.html" id="admin-link" hidden>Admin</a>
          <a href="masuk.html" class="login" id="auth-link">Masuk</a>
        </nav></div>`;
      const burger = $("#burger"), nav = $("#nav");
      burger.addEventListener("click", () => { const o = nav.classList.toggle("open"); burger.setAttribute("aria-expanded", o); });
      nav.addEventListener("click", e => {
        const dd = e.target.closest(".dd-btn");
        if (dd) { const box = dd.closest(".dd"), o = box.classList.toggle("open"); dd.setAttribute("aria-expanded", o); return; }
        if (e.target.closest("a")) { nav.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); }
      });
      document.addEventListener("click", e => { if (!e.target.closest(".dd")) $$(".dd.open").forEach(d => { d.classList.remove("open"); $(".dd-btn", d).setAttribute("aria-expanded", "false"); }); });
      document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".dd.open").forEach(d => { d.classList.remove("open"); $(".dd-btn", d).setAttribute("aria-expanded", "false"); }); });
    }

    buildDialog();
  }

  /* Footer dan tombol WhatsApp dibuat setelah konten dari database termuat,
     supaya alamat, email, dan nomor WhatsApp yang tampil sudah yang terbaru. */
  function buildFooterAndWA() {
    const f = $("#site-footer");
    if (f) {
      f.innerHTML = `<div class="wrap">
        <div class="foot-grid">
          <div>
            <a class="brand" href="index.html"><img class="brand-mark" src="assets/logo-192.png" width="40" height="40" alt=""><span class="brand-txt"><span>${esc(C.name)}</span><small>${esc(C.tagline)}</small></span></a>
            <p>Portal informasi digital Safety, Health &amp; Environment ${esc(C.company)}.</p>
          </div>
          <div>
            <h3>Menu</h3>
            <ul>${footerLinks().map(n => `<li><a href="${n.h}">${esc(n.t)}</a></li>`).join("")}</ul>
          </div>
          <div>
            <h3>Hubungi kami</h3>
            <ul>
              <li>${esc(C.address)}${C.mapsUrl ? ` <a href="${esc(C.mapsUrl)}" target="_blank" rel="noopener">(peta)</a>` : ""}</li>
              <li><a href="${esc(waLink())}" target="_blank" rel="noopener">WhatsApp ${esc(C.whatsappLabel)}</a></li>
              <li><a href="mailto:${esc(C.email)}">${esc(C.email)}</a></li>
              <li>${esc(C.hours)}</li>
            </ul>
          </div>
        </div>
        <div class="foot-bottom">
          <p class="copy">&copy; ${new Date().getFullYear()} ${esc(C.company)}. Hak cipta dilindungi.</p>
          ${C.credit ? `<p class="credit">${esc(C.credit)}</p>` : ""}
        </div>
      </div>`;
    }

    const wa = document.createElement("a");
    wa.className = "wa";
    wa.href = waLink();
    wa.target = "_blank";
    wa.rel = "noopener";
    wa.setAttribute("aria-label", "Chat Admin lewat WhatsApp");
    wa.innerHTML = waIcon + "<span>Chat Admin</span>";
    const aside = document.createElement("aside");
    aside.className = "wa-wrap";
    aside.setAttribute("aria-label", "Bantuan");
    aside.appendChild(wa);
    document.body.appendChild(aside);
  }

  function buildDialog() {
    const dlg = document.createElement("dialog");
    dlg.id = "dlg";
    dlg.setAttribute("aria-labelledby", "dlg-t");
    dlg.innerHTML = `<h3 id="dlg-t"></h3><p id="dlg-p"></p>
      <div class="row"><button class="btn" id="dlg-go" type="button"></button><button class="btn ghost" id="dlg-x" type="button">Tutup</button></div>`;
    document.body.appendChild(dlg);
    $("#dlg-x").addEventListener("click", () => dlgClose(dlg));
    $("#dlg-go").addEventListener("click", () => { dlgClose(dlg); if (dlgAction) dlgAction(); });
    dlg.addEventListener("click", e => { if (e.target === dlg) dlgClose(dlg); });
  }
  /* <dialog> baru didukung iOS 15.4 ke atas: untuk perangkat lama dipakai cadangan agar tidak error */
  const dlgOpen = d => { if (typeof d.showModal === "function") d.showModal(); else { d.classList.add("polyfill"); d.setAttribute("open", ""); } };
  const dlgClose = d => { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); };
  let dlgAction = null;
  function openDialog(title, text, btn, action) {
    $("#dlg-t").textContent = title;
    $("#dlg-p").textContent = text;
    $("#dlg-go").textContent = btn || "Tutup";
    dlgAction = action || null;
    dlgOpen($("#dlg"));
  }
  function setNavCurrent(k) {
    navCurrent = k;
    $$("#nav a[data-k]").forEach(a => { if (k && a.dataset.k === k) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    $$("#nav .dd").forEach(d => {
      const b = $(".dd-btn", d);
      if ($('a[aria-current="true"]', d)) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    });
  }
  function initNavCurrent() {
    const p = new URLSearchParams(location.search);
    if (pageName === "layanan") setNavCurrent("layanan");
    else if (pageName === "media") { const t = p.get("tab"); setNavCurrent(t && mediaTypes().some(x => x.id === t) ? t : null); }
  }
  function spy(ids) {
    const links = new Map($$("#nav a[data-k]").map(a => [a.dataset.k, a]));
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting && links.has(en.target.id)) setNavCurrent(en.target.id);
      });
    }, { rootMargin: "-35% 0px -55% 0px" });
    ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
  }

  /* ---------- Akun ---------- */
  window.AUTH = null;
  function paintUser() {
    const A = window.AUTH;
    if (!A) return;
    const p = A.profile;
    const who = $("#who");
    const name = (p && p.full_name) || A.session.user.email;
    const st = p ? p.status : "none";
    const label = st === "approved" ? (p.role === "admin" ? "Admin" : "Aktif") : st === "pending" ? "Menunggu persetujuan" : "Akses nonaktif";
    const cls = st === "approved" ? "ok" : st === "pending" ? "" : "no";
    who.innerHTML = `<b>${esc(name)}</b><span class="pill ${cls}">${label}</span>`;
    who.hidden = false;
    if (Auth.isAdmin(A)) $("#admin-link").hidden = false;
    const link = $("#auth-link");
    link.textContent = "Keluar";
    link.href = "#";
    link.addEventListener("click", async e => { e.preventDefault(); await Auth.signOut(); location.reload(); });
  }

  const loginUrl = () => "masuk.html?next=" + (pageName === "layanan" ? "layanan.html" : "index.html");

  /* Mengembalikan true bila pengguna boleh melihat konten khusus akun; selain itu menampilkan dialog */
  function ensureAccess(title) {
    if (!Auth.configured) { openDialog(title, "Fitur akun belum dikonfigurasi. Isi public/config.js (lihat PANDUAN-AKUN.md).", "Tutup"); return false; }
    const A = window.AUTH;
    if (!A) { openDialog(title, "Bagian ini hanya untuk akun karyawan. Silakan masuk atau daftar terlebih dahulu.", "Masuk / Daftar", () => { location.href = loginUrl(); }); return false; }
    const st = A.profile && A.profile.status;
    if (st === "pending") { openDialog(title, "Akun Anda masih menunggu persetujuan admin. Bagian ini akan terbuka setelah akun disetujui.", "Hubungi admin", () => { location.href = "index.html#kontak"; }); return false; }
    if (st !== "approved") { openDialog(title, "Akses akun Anda tidak aktif. Hubungi admin untuk informasi lebih lanjut.", "Hubungi admin", () => { location.href = "index.html#kontak"; }); return false; }
    return true;
  }

  function openService(id) {
    const s = window.SERVICES.find(x => x.id === id);
    if (!s) return;
    if (s.login && !ensureAccess(s.title)) return;
    const url = window.safeUrl ? window.safeUrl(s.url) : s.url;
    if (url) {
      if (/^https?:/i.test(url)) window.open(url, "_blank", "noopener");
      else location.href = url;
      return;
    }
    openDialog(s.title, "Alamat layanan ini belum diatur. Isi bidang url pada data layanan di assets/data.js.", "Tutup");
  }

  function flashHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    const el = document.getElementById(h);
    if (el && el.matches(".scard, tr, .card, .stat-card")) {
      el.scrollIntoView({ block: "center" });
      el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    }
  }

  /* ---------- Animasi: masuk saat digulir dan perpindahan halaman ---------- */
  const REVEAL = [
    [".sec-head, .grp-head, .grp-note, .hero-stats-title", "up"],
    [".gtabs-wrap, .toolbar, .doc-tools, .tagcloud, .result-info", "up"],
    [".card, .scard, .stat-card, .pillar", "pop"],
    [".kplh-scroll, .kplh-hint", "up"],
    [".table-wrap tbody tr", "up"],
    ["#faq-list details", "up"],
    [".about-top > *, .contact > *", "up"],
    [".art > *:not(.cards)", "up"],
    [".foot-grid > *, .foot-bottom", "up"]
  ];
  function initMotion() {
    const reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

    /* Perpindahan halaman (sama di semua peramban): isi halaman memudar keluar saat tautan diklik,
       lalu halaman tujuan masuk dengan animasi. Header dan tombol WhatsApp tetap diam. */
    document.documentElement.classList.add("pt");
    if (!reduce) {
      document.addEventListener("click", e => {
        const a = e.target.closest && e.target.closest("a[href]");
        if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
        let u; try { u = new URL(a.href, location.href); } catch (err) { return; }
        if (u.origin !== location.origin) return;
        const clean = p => p.replace(/\.html$/, "").replace(/\/index$/, "/");
        if (clean(u.pathname) === clean(location.pathname) && u.search === location.search) return;   // hanya pindah bagian di halaman yang sama
        e.preventDefault();
        document.body.classList.add("leaving");
        setTimeout(() => { location.href = a.href; }, 190);
      });
      window.addEventListener("pageshow", ev => { if (ev.persisted) document.body.classList.remove("leaving"); });
    }

    /* Animasi masuk: elemen muncul setiap kali masuk ke layar, dan diputar ulang saat digulir kembali */
    if (reduce || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        const el = en.target;
        if (en.isIntersecting) el.classList.add("in");
        else { const r = en.boundingClientRect; if (r.bottom < 0 || r.top > innerHeight) el.classList.remove("in"); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });
    const seen = new WeakSet();
    const scan = () => {
      REVEAL.forEach(([sel, kind]) => {
        document.body.querySelectorAll(sel).forEach(el => {
          if (el.closest("dialog, header.top")) return;
          if (seen.has(el) || !el.parentElement) return;
          seen.add(el);
          const sibs = Array.from(el.parentElement.children).filter(c => c.matches(sel));
          let i = sibs.indexOf(el);
          if (el.closest(".hscroll")) i = 0;
          el.style.setProperty("--d", Math.min(i, 6) * 70 + "ms");
          el.classList.add("rv");
          if (kind === "pop") el.classList.add("rv-pop");
          io.observe(el);
        });
      });
    };
    scan();
    if ("MutationObserver" in window) {
      const mo = new MutationObserver(scan);
      ["main", "#site-footer"].forEach(sel => { const n = document.querySelector(sel); if (n) mo.observe(n, { childList: true, subtree: true }); });
    }
  }

  /* ---------- Mulai ---------- */
  buildChrome();
  initNavCurrent();
  initMotion();
  Promise.resolve(window.contentReady).then(() => { renderNav(); initNavCurrent(); buildFooterAndWA(); });
  window.authReady = (async () => {
    if (!Auth.configured) return null;
    try { window.AUTH = await Auth.getState(); } catch (e) { window.AUTH = null; }
    paintUser();
    return window.AUTH;
  })();

  window.SH = { $, $$, esc, I, icon, iconOf, carousel, shareLink, shareCaption, shareFile, waIcon, videoEmbed, videoMime, dlgOpen, dlgClose, fmtDate, pageName, safe, groupList, groupByName, allGroups, serviceCardHTML, groupTabsHTML, tx, mediaTypes, typeLabel, kplhHTML, CAT_META, catTone, cover, cardHTML, waLink,
    openDialog, openService, ensureAccess, setNavCurrent, spy, flashHash, loginUrl };
})();
