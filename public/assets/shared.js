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
  const icon = d => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

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
      <span class="sic t-${g.tone || "gray"}">${icon(I[s.icon] || I.file)}</span>
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
      const ic = icon(I[g.icon] || I.file);
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
  const catTone = c => (CAT_META[c] || { tone: "gray" }).tone;

  function cover(m) {
    const meta = CAT_META[m.category] || { tone: "gray", icon: "news" };
    const img = m.image ? `<img src="${esc(m.image)}" alt="" loading="lazy" onerror="this.remove()">` : "";
    return `<div class="cover t-${meta.tone}">${icon(I[meta.icon])}${img}</div>`;
  }
  function cardHTML(m) {
    return `<a class="card" href="artikel.html?id=${encodeURIComponent(m.id)}">
      ${cover(m)}
      <div class="cb">
        <div class="meta"><span class="cat t-${catTone(m.category)}">${esc(m.category)}</span><time datetime="${m.date}">${fmtDate(m.date)}</time></div>
        <h3>${esc(m.title)}</h3>
        <p>${esc(m.excerpt)}</p>
        <div class="tags">${(m.tags || []).slice(0, 3).map(t => `<span class="tag">#${esc(t)}</span>`).join("")}</div>
      </div></a>`;
  }

  function waLink() {
    const t = `Halo Admin ${C.name},\n\nMohon bantuannya terkait informasi berikut:\n\nNama :\nNRP :\nPerusahaan :\nPertanyaan :\n\nTerima kasih.\n\n> Dikirim melalui ${C.name}`;
    return "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(t);
  }

  /* ---------- Header, footer, tombol WhatsApp, dialog ---------- */
  const NAV = [
    { k: "layanan", t: "Layanan", h: "layanan.html" },
    { k: "kabar", t: "Kabar SHE", h: "media.html?tab=kabar" },
    { k: "edukasi", t: "Edukasi", h: "media.html?tab=edukasi" },
    { k: "dokumen", t: "Dokumen", h: "index.html#dokumen" },
    { k: "tentang", t: "Tentang", h: "index.html#tentang" },
    { k: "faq", t: "FAQ", h: "index.html#faq" },
    { k: "kontak", t: "Kontak", h: "index.html#kontak" }
  ];

  function buildChrome() {
    const h = $("#site-header");
    if (h) {
      h.className = "top";
      h.innerHTML = `<div class="wrap">
        <a class="brand" href="index.html" aria-label="${esc(C.name)}, ke beranda">
          <img class="brand-mark" src="assets/logo-192.png" width="40" height="40" alt="">
          <span class="brand-txt"><span>${esc(C.name)}</span><small>${esc(C.tagline)}</small></span>
        </a>
        <button class="burger" id="burger" aria-expanded="false" aria-controls="nav">Menu</button>
        <nav class="nav" id="nav" aria-label="Navigasi utama">
          ${NAV.map(n => `<a href="${n.h}" data-k="${n.k}">${n.t}</a>`).join("")}
          <span class="who" id="who" hidden></span>
          <a href="admin.html" id="admin-link" hidden>Admin</a>
          <a href="masuk.html" class="login" id="auth-link">Masuk</a>
        </nav></div>`;
      const burger = $("#burger"), nav = $("#nav");
      burger.addEventListener("click", () => { const o = nav.classList.toggle("open"); burger.setAttribute("aria-expanded", o); });
      nav.addEventListener("click", e => { if (e.target.closest("a")) { nav.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); } });
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
            <h4>Menu</h4>
            <ul>${NAV.map(n => `<li><a href="${n.h}">${n.t}</a></li>`).join("")}</ul>
          </div>
          <div>
            <h4>Hubungi kami</h4>
            <ul>
              <li>${esc(C.address)}${C.mapsUrl ? ` <a href="${esc(C.mapsUrl)}" target="_blank" rel="noopener">(peta)</a>` : ""}</li>
              <li><a href="${waLink()}" target="_blank" rel="noopener">WhatsApp ${esc(C.whatsappLabel)}</a></li>
              <li><a href="mailto:${esc(C.email)}">${esc(C.email)}</a></li>
              <li>${esc(C.hours)}</li>
            </ul>
          </div>
        </div>
        <p class="copy">&copy; ${new Date().getFullYear()} ${esc(C.company)}. Hak cipta dilindungi.</p>
      </div>`;
    }

    const wa = document.createElement("a");
    wa.className = "wa";
    wa.href = waLink();
    wa.target = "_blank";
    wa.rel = "noopener";
    wa.setAttribute("aria-label", "Chat dengan admin lewat WhatsApp");
    wa.innerHTML = icon(I.chat) + "<span>Chat Admin</span>";
    document.body.appendChild(wa);
  }

  function buildDialog() {
    const dlg = document.createElement("dialog");
    dlg.id = "dlg";
    dlg.setAttribute("aria-labelledby", "dlg-t");
    dlg.innerHTML = `<h3 id="dlg-t"></h3><p id="dlg-p"></p>
      <div class="row"><button class="btn" id="dlg-go" type="button"></button><button class="btn ghost" id="dlg-x" type="button">Tutup</button></div>`;
    document.body.appendChild(dlg);
    $("#dlg-x").addEventListener("click", () => dlg.close());
    $("#dlg-go").addEventListener("click", () => { dlg.close(); if (dlgAction) dlgAction(); });
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  }
  let dlgAction = null;
  function openDialog(title, text, btn, action) {
    $("#dlg-t").textContent = title;
    $("#dlg-p").textContent = text;
    $("#dlg-go").textContent = btn || "Tutup";
    dlgAction = action || null;
    $("#dlg").showModal();
  }
  function setNavCurrent(k) {
    $$("#nav a[data-k]").forEach(a => { if (a.dataset.k === k) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
  }
  function initNavCurrent() {
    const p = new URLSearchParams(location.search);
    if (pageName === "layanan") setNavCurrent("layanan");
    else if (pageName === "media") setNavCurrent(p.get("tab") === "edukasi" ? "edukasi" : p.get("tab") === "kabar" ? "kabar" : null);
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

  /* ---------- Mulai ---------- */
  buildChrome();
  initNavCurrent();
  Promise.resolve(window.contentReady).then(buildFooterAndWA);
  window.authReady = (async () => {
    if (!Auth.configured) return null;
    try { window.AUTH = await Auth.getState(); } catch (e) { window.AUTH = null; }
    paintUser();
    return window.AUTH;
  })();

  window.SH = { $, $$, esc, I, icon, fmtDate, pageName, groupList, groupByName, allGroups, serviceCardHTML, groupTabsHTML, tx, CAT_META, catTone, cover, cardHTML, waLink,
    openDialog, openService, ensureAccess, setNavCurrent, spy, flashHash, loginUrl };
})();
