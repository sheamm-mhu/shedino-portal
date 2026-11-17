/* Daily Quotes: pembuat poster (unggah foto, hapus latar, isi teks, unduh atau kirim) dan galeri karya yang disetujui. */
(async function () {
  "use strict";
  await window.contentReady;
  const { $, $$, esc, dlgOpen, dlgClose } = window.SH, DQ = window.DQ;
  window.SH.setNavCurrent && window.SH.setNavCurrent("media");
  const app = $("#dq-app");
  Object.defineProperty(window, "__dq", { value: { get photo() { return photo; }, get cutOK() { return cutOK; } } });   // pembantu pengujian (hanya baca)
  let SET = null, TPLS = [], cur = null, view = location.hash === "#galeri" ? "galeri" : "buat";
  const ASSETS = {}; let orig = null, photo = null, cutOK = false, autoCut = true, person = { zoom: 1, dx: 0, dy: 0, fade: 35 }, texts = {}, tool = (window.matchMedia && matchMedia("(pointer: coarse)").matches) ? "none" : "move", brushPx = 26, edgeV = 0, raf = 0, busy = false;
  const MAXLEN = { name: 80, job: 100, quote: 400, date: 30 };

  function msg(kind, text) { const m = $("#dq-msg"); if (!m) return; if (!text) { m.className = "dq-msg"; m.textContent = ""; return; } m.className = "dq-msg show " + kind; m.textContent = text; }
  function friendly(e) {
    const m = String((e && e.message) || e || "");
    if (/does not exist|schema cache|PGRST20|42P01|Could not find the (function|table)/i.test(m)) return "Fitur Daily Quotes belum dipasang di database. Minta admin menjalankan supabase/daily-quotes.sql di Supabase.";
    if (/row-level|permission denied|not authorized|violates/i.test(m)) return "Pengiriman ditolak oleh server. Muat ulang halaman lalu coba lagi.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "Gagal terhubung ke server. Periksa koneksi internet Anda.";
    if (/exceeded|too large|payload/i.test(m)) return "Ukuran gambar melebihi batas. Coba lagi.";
    return m.replace(/^.*?(?:ERROR:|exception:)\s*/i, "") || "Terjadi kesalahan. Coba lagi.";
  }
  const slug = s => String(s || "poster").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "poster";
  function token() {
    try { let t = localStorage.getItem("dq.token"); if (t && /^[A-Za-z0-9_-]{16,64}$/.test(t)) return t; t = rand(32); localStorage.setItem("dq.token", t); return t; } catch (e) { return window.__dqTok || (window.__dqTok = rand(32)); }
  }
  function rand(n) { const a = new Uint8Array(n), s = "abcdefghijklmnopqrstuvwxyz0123456789"; (crypto || window.msCrypto).getRandomValues(a); return Array.from(a, v => s[v % s.length]).join(""); }

  /* ---------- Data ---------- */
  async function load() {
    const [s, t] = await Promise.all([
      Auth.client.from("dq_settings").select("*").eq("id", 1).maybeSingle(),
      Auth.client.from("dq_templates").select("*").eq("active", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true })
    ]);
    if (s.error) throw s.error; if (t.error) throw t.error;
    SET = s.data || { enabled: true, require_login: false, notice: "" }; TPLS = t.data || [];
  }
  async function assetsFor(t) {
    if (ASSETS[t.id]) return ASSETS[t.id];
    const [back, front] = await Promise.all([DQ.loadImage(t.back_image), t.front_image ? DQ.loadImage(t.front_image).catch(() => null) : Promise.resolve(null)]);
    return (ASSETS[t.id] = { back, front });
  }

  /* ---------- Tab ---------- */
  function setView(v) {
    view = v; history.replaceState(null, "", "#" + v);
    $$(".dq-tabs [data-v]").forEach(b => b.setAttribute("aria-selected", b.dataset.v === v)); msg();
    (v === "galeri" ? gallery() : creator()).catch(e => { app.innerHTML = ""; msg("err", friendly(e)); });
  }
  $(".dq-tabs").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) setView(b.dataset.v); });

  /* ---------- Pembuat poster ---------- */
  async function creator() {
    if (!SET) await load();
    if (!SET.enabled) { app.innerHTML = '<p class="dq-empty">Fitur Daily Quotes sedang dinonaktifkan oleh admin.</p>'; return; }
    if (!TPLS.length) { app.innerHTML = '<p class="dq-empty">Belum ada templat yang tersedia. Admin dapat menambahkannya di Panel Admin, tab Daily Quotes.</p>'; return; }
    if (!cur || !TPLS.find(t => t.id === cur.id)) { cur = TPLS[0]; texts = {}; }
    const t = cur;
    t.fields.forEach(f => { if (texts[f.key] == null) texts[f.key] = f.key === "date" ? DQ.todayText() : ""; });
    app.innerHTML = `<div class="dq-create">
      <div class="dq-stage${toolCls()}" id="dq-stage"><canvas id="dq-cv" width="540" height="${Math.round(540 * t.h / t.w)}" role="img" aria-label="Pratinjau poster Daily Quotes"></canvas><div class="dq-ring" id="dq-ring" hidden></div>
        <p class="dq-note" id="dq-pnote">Teks contoh akan hilang bila kolomnya tidak diisi.</p></div>
      <ol class="dq-steps">
        ${TPLS.length > 1 ? `<li class="dq-step"><h2>Pilih templat</h2><div class="dq-tpls">${TPLS.map(x => `<button type="button" class="dq-tpl" data-t="${esc(x.id)}" aria-pressed="${x.id === t.id}"><img src="${esc(x.back_image)}" alt="" loading="lazy"><span>${esc(x.name)}</span></button>`).join("")}</div></li>` : ""}
        <li class="dq-step"><h2>Unggah foto</h2>
          <label class="btn dq-file"><span id="dq-file-t">${photo ? "Ganti foto" : "Pilih atau ambil foto"}</span><input type="file" id="dq-file" accept="image/*"></label>
          <label class="dq-chk"><input type="checkbox" id="dq-cut"${autoCut ? " checked" : ""}> Hapus latar foto otomatis</label>
          <p class="dq-status" id="dq-st" role="status" aria-live="polite">${photo ? "" : "Gunakan foto yang menampakkan wajah dan badan dengan jelas. Foto diproses di perangkat Anda dan tidak dikirim ke mana pun kecuali Anda memilih Kirim."}</p>
          <div class="dq-ctl" id="dq-ctl"${photo ? "" : " hidden"}>
            <div class="dq-zoom"><label for="dq-zoom" style="margin:0">Ukuran</label><input type="range" id="dq-zoom" min="0.5" max="2.5" step="0.05" value="${person.zoom}"></div>
            <div class="dq-zoom"><label for="dq-fade" style="margin:0">Haluskan bagian bawah</label><input type="range" id="dq-fade" min="0" max="100" step="5" value="${person.fade}" aria-describedby="dq-fade-h"></div>
            <p class="dq-status" id="dq-fade-h">Membuat bagian bawah orang memudar halus, supaya tidak ada garis potong yang kasar di atas kotak keterangan.</p>
            <div class="dq-mv" role="group" aria-label="Geser foto"><button type="button" data-mv="l" aria-label="Geser ke kiri">&larr;</button><button type="button" data-mv="u" aria-label="Geser ke atas">&uarr;</button><button type="button" data-mv="d" aria-label="Geser ke bawah">&darr;</button><button type="button" data-mv="r" aria-label="Geser ke kanan">&rarr;</button><button type="button" id="dq-center" class="dq-btn2">Pusatkan</button></div>
            <div class="dq-tools" id="dq-tools"${photo && photo.dq && cutOK ? "" : " hidden"}>
              <div class="dq-zoom"><label for="dq-edge" style="margin:0">Rapikan tepi</label><input type="range" id="dq-edge" min="-3" max="3" step="0.5" value="${edgeV}" aria-describedby="dq-edge-h"></div>
              <p class="dq-status" id="dq-edge-h">Geser ke kanan bila masih ada sisa latar di pinggir orang, ke kiri bila bagian orang ikut terpotong.</p>
              <div class="dq-mv" role="group" aria-label="Alat">${[["move", "Geser foto"], ["erase", "Hapus sisa"], ["restore", "Pulihkan"]].map(t => `<button type="button" class="dq-btn2" data-tool="${t[0]}" aria-pressed="${tool === t[0]}">${t[1]}</button>`).join("")}<button type="button" class="dq-btn2" id="dq-undo">Batalkan coretan</button></div>
              <div class="dq-zoom"><label for="dq-brush" style="margin:0">Ukuran kuas</label><input type="range" id="dq-brush" min="8" max="90" step="2" value="${brushPx}"></div>
              <p class="dq-status">Hapus sisa: gosok bagian latar yang masih tersisa pada pratinjau. Pulihkan: gosok bagian orang yang ikut terhapus. Di ponsel, pilih alatnya dulu agar layar tidak ikut bergeser.</p>
            </div>
          </div></li>
        <li class="dq-step"><h2>Isi teks</h2>${t.fields.map(f => { const mx = MAXLEN[f.key] || 120, multi = f.maxlines > 1, v = esc(texts[f.key] || ""), ph = esc(f.sample || ""); return `<label>${esc(f.label)}${multi ? `<textarea data-k="${esc(f.key)}" maxlength="${mx}" rows="3" placeholder="${ph}">${v}</textarea>` : `<input type="text" data-k="${esc(f.key)}" maxlength="${mx}" value="${v}" placeholder="${ph}" autocomplete="off">`}<span class="dq-count" data-c="${esc(f.key)}"></span></label>`; }).join("")}</li>
        <li class="dq-step"><h2>Selesai</h2><div class="dq-acts"><button type="button" class="btn" id="dq-dl">Unduh gambar</button><button type="button" class="btn teal" id="dq-send">Kirim agar tayang di galeri</button></div>
          <p class="dq-status">${esc(SET.notice || "")}</p></li>
      </ol></div>`;
    wireCreator(); await redraw();
  }
  const toolCls = () => tool === "move" ? " drag" : (tool === "erase" || tool === "restore") ? " paint" : "";
  function counts() { cur.fields.forEach(f => { const c = $(`[data-c="${f.key}"]`); if (c) c.textContent = `${(texts[f.key] || "").length}/${MAXLEN[f.key] || 120}`; }); }
  async function redraw() {
    const cv = $("#dq-cv"); if (!cv) return; const t = cur;
    try { const a = await assetsFor(t); await DQ.ensureFonts(); if (cv !== $("#dq-cv")) return;
      const r = DQ.render(cv, t, a, { person: photo ? { src: photo, cut: cutOK, zoom: person.zoom, dx: person.dx, dy: person.dy, fade: person.fade } : null, texts }, { width: Math.min(t.w, 720), placeholder: true, samples: true });
      const nt = $("#dq-pnote"); if (nt) nt.textContent = r.cut.length ? "Teks terlalu panjang dan dipotong. Perpendek agar semua terbaca." : "Teks contoh akan hilang bila kolomnya tidak diisi.";
    } catch (e) { msg("err", "Templat tidak dapat ditampilkan: " + friendly(e)); }
  }
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(redraw); };
  function wireCreator() {
    $$(".dq-tpl").forEach(b => b.addEventListener("click", () => { const x = TPLS.find(z => z.id === b.dataset.t); if (x && x.id !== cur.id) { cur = x; texts = {}; creator(); } }));
    $("#dq-file").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) onFile(f); });
    $("#dq-cut").addEventListener("change", e => { autoCut = e.target.checked; if (orig) onFile(null); });
    $("#dq-zoom").addEventListener("input", e => { person.zoom = +e.target.value; schedule(); });
    $(".dq-mv").addEventListener("click", e => { const b = e.target.closest("[data-mv]"); if (!b) return; const s = 0.03; ({ l: () => person.dx -= s, r: () => person.dx += s, u: () => person.dy -= s, d: () => person.dy += s })[b.dataset.mv](); schedule(); });
    $("#dq-fade").addEventListener("input", e => { person.fade = +e.target.value; schedule(); });
    $("#dq-center").addEventListener("click", () => { person = { zoom: 1, dx: 0, dy: 0, fade: person.fade }; $("#dq-zoom").value = 1; schedule(); });
    $$("[data-tool]").forEach(b => b.addEventListener("click", () => { tool = tool === b.dataset.tool ? "none" : b.dataset.tool; $$("[data-tool]").forEach(x => x.setAttribute("aria-pressed", x.dataset.tool === tool)); $("#dq-stage").className = "dq-stage" + toolCls(); }));
    $("#dq-edge").addEventListener("input", e => { edgeV = +e.target.value; if (photo && photo.dq) { DQ.setEdge(photo, edgeV); schedule(); } });
    $("#dq-brush").addEventListener("input", e => { brushPx = +e.target.value; });
    $("#dq-undo").addEventListener("click", () => { if (photo && photo.dq) { DQ.resetBrush(photo); schedule(); } });
    $$("#dq-app [data-k]").forEach(el => el.addEventListener("input", () => { texts[el.dataset.k] = el.value; counts(); schedule(); })); counts();
    const cv = $("#dq-cv"), ring = $("#dq-ring"); let drag = null, last = null;
    const paintTool = () => (tool === "erase" || tool === "restore") && photo && photo.dq && cutOK;
    const sp = e => { const r = cv.getBoundingClientRect(), k = cv.width / r.width; return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k, r }; };
    const stroke = (a, b) => {
      const m = DQ.personMap(cur, { src: photo, zoom: person.zoom, dx: person.dx, dy: person.dy, fade: person.fade }, cv.width, cv.height), rad = Math.max(2, brushPx * a.k / m.s), dist = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(dist / Math.max(1, brushPx * a.k / 3)));
      for (let i = 0; i <= n; i++) DQ.paint(photo, m.px(a.x + (b.x - a.x) * i / n), m.py(a.y + (b.y - a.y) * i / n), rad, tool);
      schedule();
    };
    cv.addEventListener("pointerdown", e => {
      if (paintTool()) { last = sp(e); stroke(last, last); drag = { paint: true }; cv.setPointerCapture(e.pointerId); return; }
      if (tool !== "move" || !photo) return; drag = { x: e.clientX, y: e.clientY, dx: person.dx, dy: person.dy }; cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", e => {
      if (paintTool()) { const q = sp(e), r = q.r; ring.hidden = false; ring.style.width = ring.style.height = brushPx * 2 + "px"; ring.style.left = (e.clientX - r.left - brushPx) + "px"; ring.style.top = (e.clientY - r.top - brushPx) + "px"; if (drag && drag.paint) { stroke(last, q); last = q; } return; }
      if (!drag || drag.paint) return; const r = cv.getBoundingClientRect(), sw = cur.photo.w / 100 * r.width, sh = cur.photo.h / 100 * r.height; person.dx = DQ.clamp(drag.dx + (e.clientX - drag.x) / sw, -2, 2); person.dy = DQ.clamp(drag.dy + (e.clientY - drag.y) / sh, -2, 2); schedule();
    });
    cv.addEventListener("pointerleave", () => { ring.hidden = true; });
    const end = () => { drag = null; last = null; }; cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    $("#dq-dl").addEventListener("click", download); $("#dq-send").addEventListener("click", openSend);
  }
  const status = t => { const s = $("#dq-st"); if (s) s.textContent = t; };
  async function onFile(file) {
    if (busy) return; busy = true; msg();
    try {
      if (file) { status("Membaca foto..."); orig = await DQ.prepPhoto(file); person = { zoom: 1, dx: 0, dy: 0, fade: person.fade }; const z = $("#dq-zoom"); if (z) z.value = 1; }
      cutOK = false; photo = orig;
      if (DQ.hasTransparency(orig)) { if (!orig.dq) DQ.wrapTransparent(orig); cutOK = true; status("Foto sudah tanpa latar, dipakai apa adanya. Alat Rapikan tepi dan kuas tetap bisa dipakai."); }
      else if (autoCut) {
        status("Menghapus latar... Pertama kali agak lama karena memuat mesinnya (sekitar 6 MB), berikutnya cepat.");
        try { photo = await DQ.cutout(orig); cutOK = true; edgeV = 0; status("Latar dihapus. Bila masih ada sisa, pakai Rapikan tepi atau kuas Hapus sisa di bawah."); }
        catch (e) { photo = orig; cutOK = false; status(""); msg("warn", "Latar tidak bisa dihapus otomatis (" + friendly(e) + ") Foto dipakai utuh di dalam bingkai. Anda juga bisa mengunggah foto PNG tanpa latar."); }
      } else status("Foto dipakai utuh di dalam bingkai.");
      const c = $("#dq-ctl"); if (c) c.hidden = false; const tl = $("#dq-tools"); if (tl) tl.hidden = !(photo && photo.dq && cutOK); const ed = $("#dq-edge"); if (ed) { ed.value = photo && photo.dq ? photo.dq.edge : 0; edgeV = +ed.value; } const ft = $("#dq-file-t"); if (ft) ft.textContent = "Ganti foto";
      await redraw();
    } catch (e) { msg("err", friendly(e)); status(""); }
    busy = false;
  }
  function need() {
    if (!photo) { msg("err", "Unggah foto terlebih dulu."); $("#dq-file").focus(); return false; }
    const names = cur.fields.filter(f => f.key === "name" || f.key === "quote");
    for (const f of (names.length ? names : cur.fields.slice(0, 1))) if (!String(texts[f.key] || "").trim()) { msg("err", `Isi kolom "${f.label}" terlebih dulu.`); const el = $(`[data-k="${f.key}"]`); if (el) el.focus(); return false; }
    return true;
  }
  async function finalBlob(maxBytes) {
    await DQ.ensureFonts(); const a = await assetsFor(cur), cv = document.createElement("canvas");
    DQ.render(cv, cur, a, { person: { src: photo, cut: cutOK, zoom: person.zoom, dx: person.dx, dy: person.dy, fade: person.fade }, texts }, { width: Math.min(cur.w, 1350) });
    return DQ.toJpegBlob(cv, maxBytes);
  }
  async function download() {
    if (busy || !need()) return; busy = true; msg("info", "Menyiapkan gambar...");
    try {
      const b = await finalBlob(3 * 1024 * 1024), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `daily-quotes-${slug(texts.name)}.jpg`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); msg("ok", "Gambar diunduh. Anda juga bisa mengirimnya agar tayang di galeri.");
    } catch (e) { msg("err", friendly(e)); }
    busy = false;
  }

  /* ---------- Kirim ---------- */
  function openSend() {
    if (!need()) return;
    let d = $("#dq-send-dlg"); if (!d) { d = document.createElement("dialog"); d.id = "dq-send-dlg"; d.className = "dq-dlg"; d.setAttribute("aria-label", "Kirim poster"); document.body.appendChild(d); }
    d.innerHTML = `<form id="dq-sf" novalidate><h3>Kirim ke galeri</h3><p>${esc(SET.notice || "Karya Anda akan tampil di galeri setelah disetujui admin.")}</p>
      <label>Nama pengirim (opsional)<input type="text" id="dq-sender" maxlength="80" autocomplete="name"></label>
      <label class="dq-chk"><input type="checkbox" id="dq-consent"> Saya sudah mendapat izin dari orang yang ada pada foto untuk menayangkannya di SHEDINO.</label>
      <div class="dq-hp" aria-hidden="true"><label>Situs web<input type="text" id="dq-hp" tabindex="-1" autocomplete="off"></label></div>
      <p class="dq-msg" id="dq-sm" role="alert"></p>
      <div class="row"><button type="submit" class="btn" id="dq-sgo">Kirim</button><button type="button" class="btn ghost" id="dq-sx">Batal</button></div></form>`;
    $("#dq-sx").addEventListener("click", () => dlgClose(d));
    $("#dq-sf").addEventListener("submit", async e => {
      e.preventDefault(); const m = $("#dq-sm"), go = $("#dq-sgo"), err = t => { m.className = "dq-msg show err"; m.textContent = t; };
      if (!$("#dq-consent").checked) return err("Centang pernyataan izin terlebih dulu.");
      if (busy) return; busy = true; go.disabled = true; m.className = "dq-msg show info"; m.textContent = "Menyiapkan dan mengunggah...";
      try {
        const blob = await finalBlob(950 * 1024), d0 = new Date(), yymmdd = String(d0.getFullYear()).slice(2) + String(d0.getMonth() + 1).padStart(2, "0") + String(d0.getDate()).padStart(2, "0");
        const path = `p/${yymmdd}/${rand(20)}.jpg`, up = await Auth.client.storage.from("dq-submissions").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
        if (up.error) throw new Error(/bucket not found/i.test(up.error.message) ? "Penyimpanan Daily Quotes belum dibuat. Minta admin menjalankan supabase/daily-quotes.sql." : up.error.message);
        const url = Auth.client.storage.from("dq-submissions").getPublicUrl(path).data.publicUrl;
        const r = await Auth.client.rpc("dq_submit", { p_template: cur.id, p_image: url, p_name: texts.name || "", p_job: texts.job || "", p_quote: texts.quote || "", p_date: texts.date || "", p_sender: $("#dq-sender").value, p_token: token(), p_hp: $("#dq-hp").value });
        if (r.error) throw r.error;
        d.innerHTML = `<h3>Terkirim</h3><p>${esc(SET.notice || "Karya Anda akan tampil di galeri setelah disetujui admin.")}</p><div class="row"><button type="button" class="btn" id="dq-sdone">Selesai</button></div>`;
        $("#dq-sdone").addEventListener("click", () => dlgClose(d)); $("#dq-sdone").focus(); msg("ok", "Poster terkirim dan menunggu persetujuan admin.");
      } catch (ex) {
        let t = friendly(ex); if (/masuk/i.test(t) && window.SH.loginUrl) t += " Buka halaman Masuk, lalu kembali ke sini.";
        err(t); go.disabled = false;
      }
      busy = false;
    });
    dlgOpen(d); setTimeout(() => { const c = $("#dq-sender"); if (c) c.focus(); }, 40);
  }

  /* ---------- Galeri ---------- */
  let gPage = 0; const PER = 24;
  async function gallery() {
    gPage = 0; app.innerHTML = '<div class="dq-grid" id="dq-g" aria-live="polite"></div><button type="button" class="btn ghost dq-more" id="dq-more" hidden>Muat lebih banyak</button><p class="dq-empty" id="dq-gs">Memuat galeri...</p>';
    $("#dq-more").addEventListener("click", () => more());
    $("#dq-g").addEventListener("click", e => { const c = e.target.closest("[data-i]"); if (c) openCard(ROWS.find(r => r.id === c.dataset.i)); });
    ROWS = []; await more();
  }
  let ROWS = [];
  async function more() {
    const r = await Auth.client.from("dq_submissions").select("id,image,name,job,quote,date_text,created_at").eq("status", "approved").order("created_at", { ascending: false }).range(gPage * PER, gPage * PER + PER - 1);
    if (r.error) throw r.error; const rows = r.data || []; gPage++; ROWS = ROWS.concat(rows);
    $("#dq-g").insertAdjacentHTML("beforeend", rows.map(x => `<button type="button" class="dq-card" data-i="${esc(x.id)}"><img src="${esc(x.image)}" alt="Poster Daily Quotes: ${esc(x.name)}" loading="lazy"><div><strong>${esc(x.name)}</strong><small>${esc(x.job || x.quote)}</small></div></button>`).join(""));
    $("#dq-more").hidden = rows.length < PER; $("#dq-gs").textContent = ROWS.length ? "" : "Belum ada karya di galeri. Jadilah yang pertama: buat poster lalu kirim.";
    const tab = $("#dq-tab-galeri"); tab.textContent = "Galeri";
  }
  function openCard(x) {
    if (!x) return; let d = $("#dq-view"); if (!d) { d = document.createElement("dialog"); d.id = "dq-view"; d.className = "dq-dlg"; d.setAttribute("aria-label", "Poster Daily Quotes"); document.body.appendChild(d); }
    const wa = "https://wa.me/?text=" + encodeURIComponent(`${x.name}${x.job ? " (" + x.job + ")" : ""}: "${x.quote}"\n${location.origin}${location.pathname.replace(/[^/]*$/, "")}daily-quotes.html#galeri`);
    d.innerHTML = `<img src="${esc(x.image)}" alt="Poster Daily Quotes: ${esc(x.name)}"><h3>${esc(x.name)}</h3><p>${esc(x.job || "")}</p><p>&ldquo;${esc(x.quote)}&rdquo;</p>
      <div class="row"><button type="button" class="btn" id="dq-vdl">Unduh</button><a class="btn ghost" href="${esc(wa)}" target="_blank" rel="noopener">Bagikan ke WhatsApp</a><button type="button" class="btn ghost" id="dq-vx">Tutup</button></div>`;
    $("#dq-vx").addEventListener("click", () => dlgClose(d));
    $("#dq-vdl").addEventListener("click", async () => {
      try { const b = await (await fetch(x.image)).blob(), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `daily-quotes-${slug(x.name)}.jpg`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
      catch (e) { window.open(x.image, "_blank", "noopener"); }
    });
    dlgOpen(d);
  }

  window.addEventListener("hashchange", () => { const v = location.hash === "#galeri" ? "galeri" : "buat"; if (v !== view) setView(v); });
  try { await load(); } catch (e) { app.innerHTML = ""; msg("err", friendly(e)); return; }
  setView(view);
})();
