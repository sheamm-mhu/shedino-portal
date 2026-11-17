/* Daily Quotes di panel admin: persetujuan kiriman, pengelolaan templat (editor seret-lepas), dan pengaturan. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), r1 = v => Math.round(v * 10) / 10;
  const dOpen = d => { if (typeof d.showModal === "function") d.showModal(); else { d.classList.add("polyfill"); d.setAttribute("open", ""); } };
  const dClose = d => { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); };
  let panel = null, sub = "queue", FILTER = "pending", COUNTS = null, E = null, TPL = [], SET = null, MODAL = null;
  const KEYS = [["name", "Nama"], ["job", "Jabatan atau departemen"], ["quote", "Kata-kata"], ["date", "Tanggal"], ["custom", "Lainnya"]];

  function friendly(m) {
    m = String(m || "");
    if (/does not exist|schema cache|PGRST20|42P01|Could not find the (function|table)/i.test(m)) return "Fitur Daily Quotes di database belum dipasang. Jalankan seluruh isi supabase/daily-quotes.sql di Supabase (SQL Editor), lalu muat ulang halaman.";
    if (/violates check constraint.*shape|dq_templates_shape/i.test(m)) return "Bentuk templat tidak valid. Periksa angka posisi, ukuran, dan warna pada kotak teks.";
    if (/violates check constraint/i.test(m)) return "Ada nilai di luar batas yang diizinkan. Periksa lagi isian.";
    if (/permission denied|row-level security|not authorized/i.test(m)) return "Akun ini tidak punya izin. Pastikan Anda masuk sebagai admin.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "Gagal terhubung ke server. Periksa koneksi internet Anda.";
    return m || "Terjadi kesalahan. Coba lagi.";
  }
  function note(kind, text) { const m = $("#dq-a-msg"); if (!m) return; m.className = "msg show " + kind; m.textContent = text; if (kind === "ok") setTimeout(() => { if (m.textContent === text) m.className = "msg"; }, 6000); }
  const q = async p => { const r = await p; if (r.error) throw new Error(friendly(r.error.message)); return r.data; };
  const when = s => new Date(s).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const rnd = n => { const a = new Uint8Array(n), s = "abcdefghijklmnopqrstuvwxyz0123456789"; crypto.getRandomValues(a); return Array.from(a, v => s[v % s.length]).join(""); };

  async function badge() {
    try { const r = await Auth.client.rpc("dq_counts"); if (r.error) return null; COUNTS = r.data; const b = $("#atabs [data-tab=dq]"); if (b) b.textContent = "Daily Quotes" + (COUNTS.pending ? ` (${COUNTS.pending})` : ""); return COUNTS; } catch (e) { return null; }
  }

  async function show() {
    panel = $("#dq-panel"); E = null;
    panel.innerHTML = `<div class="ga dq-adm"><div class="ga-pub"><div><strong>Daily Quotes</strong><span class="ga-pend">Pengunjung membuat poster dari templat. Kiriman tayang di galeri setelah Anda setujui.</span></div>
      <div class="ga-pubact"><a class="btn ghost sm" href="daily-quotes.html" target="_blank" rel="noopener">Buka halaman publik</a></div></div>
      <div id="dq-a-msg" class="msg" role="status" aria-live="polite"></div>
      <div class="ga-tabs" role="tablist" aria-label="Bagian Daily Quotes"><button type="button" role="tab" data-s="queue">Persetujuan</button><button type="button" role="tab" data-s="tpl">Templat</button><button type="button" role="tab" data-s="set">Pengaturan</button></div>
      <div id="dq-a-body"></div></div>`;
    $(".ga-tabs", panel).addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (b) { sub = b.dataset.s; E = null; draw(); } });
    await draw();
  }
  async function draw() {
    $$(".ga-tabs [data-s]", panel).forEach(b => b.setAttribute("aria-selected", b.dataset.s === sub));
    const body = $("#dq-a-body"); body.innerHTML = '<p class="empty">Memuat...</p>';
    try { if (sub === "queue") await queue(body); else if (sub === "tpl") await templates(body); else await settings(body); }
    catch (e) { body.innerHTML = `<p class="warnbox">${esc(e.message)}</p>`; }
  }

  /* ===================== Persetujuan ===================== */
  async function queue(body) {
    const c = (await badge()) || { pending: 0, approved: 0, rejected: 0 };
    const rows = await q(Auth.client.from("dq_submissions").select("*").eq("status", FILTER).order("created_at", { ascending: false }).limit(60));
    const tp = new Map((await q(Auth.client.from("dq_templates").select("id,name"))).map(t => [t.id, t.name]));
    const lbl = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" };
    body.innerHTML = `<div class="ga-seg" role="group" aria-label="Filter kiriman">${["pending", "approved", "rejected"].map(k => `<button type="button" data-f="${k}" aria-pressed="${FILTER === k}">${lbl[k]} (${c[k] || 0})</button>`).join("")}</div>
      <p class="fhelp" style="margin-top:.6rem">${FILTER === "pending" ? "Periksa foto dan teks sebelum menyetujui. Yang disetujui langsung tampil di galeri publik." : FILTER === "approved" ? "Kiriman ini tampil di galeri publik." : "Kiriman ini tidak tampil. Anda bisa menyetujuinya kembali atau menghapusnya."}</p>
      <div class="ga-cards" id="dq-q-list">${rows.map(r => `<article class="ga-card" data-id="${esc(r.id)}"><img src="${esc(r.image)}" alt="Poster ${esc(r.name)}" loading="lazy" data-zoom="1">
        <div class="ga-cbody"><strong>${esc(r.name)}</strong> <span class="chip">${esc(tp.get(r.template_id) || "templat dihapus")}</span><p>${esc(r.job)}</p><p>&ldquo;${esc(r.quote)}&rdquo;</p>
        <p class="fhelp">${esc(when(r.created_at))}${r.sender ? " · pengirim: " + esc(r.sender) : ""}${r.user_id ? " · akun SHEDINO" : " · tanpa akun"} · perangkat ${esc(r.token.slice(0, 6))}</p>${r.reason ? `<p class="fhelp"><b>Alasan ditolak:</b> ${esc(r.reason)}</p>` : ""}</div>
        <div class="acts">${FILTER === "approved" ? '<button type="button" class="btn ghost sm" data-a="unpub">Batalkan tayang</button>' : '<button type="button" class="btn teal sm" data-a="ok">Setujui</button>'}${FILTER === "pending" ? '<button type="button" class="btn ghost sm" data-a="no">Tolak</button>' : ""}<button type="button" class="btn danger sm" data-a="del">Hapus</button></div></article>`).join("") || `<p class="empty">Tidak ada kiriman ${lbl[FILTER].toLowerCase()}.</p>`}</div>`;
    $$(".ga-seg [data-f]", body).forEach(b => b.addEventListener("click", () => { FILTER = b.dataset.f; draw(); }));
    $("#dq-q-list").addEventListener("click", async e => {
      const art = e.target.closest(".ga-card"); if (!art) return; const r = rows.find(x => x.id === art.dataset.id); if (!r) return;
      if (e.target.closest("[data-zoom]")) return zoom(r);
      const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a;
      try {
        if (a === "ok") await setStatus(r, "approved", "");
        else if (a === "unpub") await setStatus(r, "pending", "");
        else if (a === "no") return rejectDlg(r);
        else if (a === "del") { if (!window.confirm(`Hapus poster "${r.name}" secara permanen?`)) return; await q(Auth.client.from("dq_submissions").delete().eq("id", r.id)); const path = (r.image.split("/storage/v1/object/public/dq-submissions/")[1] || ""); if (path) await Auth.client.storage.from("dq-submissions").remove([path]); note("ok", "Poster dihapus."); }
        await draw();
      } catch (err) { note("err", err.message); }
    });
  }
  async function setStatus(r, status, reason) {
    const st = await Auth.getState(), uid = st && st.session ? st.session.user.id : null;
    const d = await q(Auth.client.from("dq_submissions").update({ status, reason, reviewed_at: new Date().toISOString(), reviewed_by: uid }).eq("id", r.id).select("id"));
    if (!d || !d.length) throw new Error(friendly("permission denied"));
    note("ok", status === "approved" ? `Poster "${r.name}" disetujui dan tayang di galeri.` : status === "rejected" ? `Poster "${r.name}" ditolak.` : `Poster "${r.name}" dikembalikan ke antrean.`);
  }
  function dlg(id, html) { let d = $("#" + id); if (!d) { d = document.createElement("dialog"); d.id = id; d.className = "cdlg"; document.body.appendChild(d); } d.innerHTML = html; return d; }
  function zoom(r) { const d = dlg("dq-a-zoom", `<div class="chead"><h2>${esc(r.name)}</h2></div><img src="${esc(r.image)}" alt="Poster ${esc(r.name)}" style="width:100%;border-radius:12px"><div class="foot"><button type="button" class="btn" id="dq-zx">Tutup</button></div>`); $("#dq-zx", d).addEventListener("click", () => dClose(d)); dOpen(d); }
  function rejectDlg(r) {
    const d = dlg("dq-a-rej", `<form id="dq-rf" novalidate><div class="chead"><h2>Tolak poster</h2></div><label>Alasan (opsional, hanya terlihat oleh admin)<textarea id="dq-rr" rows="3" maxlength="300"></textarea></label><p class="msg" id="dq-rm" role="alert"></p><div class="foot"><button type="button" class="btn ghost" id="dq-rx">Batal</button><button type="submit" class="btn">Tolak</button></div></form>`);
    $("#dq-rx", d).addEventListener("click", () => dClose(d));
    $("#dq-rf", d).addEventListener("submit", async e => { e.preventDefault(); try { await setStatus(r, "rejected", $("#dq-rr", d).value.trim()); dClose(d); await draw(); } catch (err) { const m = $("#dq-rm", d); m.className = "msg show err"; m.textContent = err.message; } });
    dOpen(d); setTimeout(() => $("#dq-rr", d).focus(), 30);
  }

  /* ===================== Pengaturan ===================== */
  async function settings(body) {
    SET = await q(Auth.client.from("dq_settings").select("*").eq("id", 1).maybeSingle());
    if (!SET) throw new Error(friendly("does not exist"));
    body.innerHTML = `<form id="dq-sf" class="ga-lset" novalidate><div class="ga-lhead"><h3>Pengaturan Daily Quotes</h3></div>
      <label class="fchk"><input type="checkbox" id="dq-s-en"${SET.enabled ? " checked" : ""}> Fitur aktif (pengunjung bisa membuat dan mengirim poster)</label>
      <label class="fchk"><input type="checkbox" id="dq-s-lg"${SET.require_login ? " checked" : ""}> Pengirim wajib masuk dengan akun SHEDINO (bila mati, siapa pun bisa mengirim, tetap harus Anda setujui)</label>
      <div class="frow"><label>Batas antrean menunggu<input type="number" id="dq-s-mp" min="1" max="2000" value="${SET.max_pending}" inputmode="numeric"><span class="fhelp">Kiriman baru ditolak otomatis bila antrean sudah sebanyak ini.</span></label>
        <label>Batas kiriman per perangkat per hari<input type="number" id="dq-s-pt" min="1" max="100" value="${SET.per_token_daily}" inputmode="numeric"><span class="fhelp">Mencegah kiriman beruntun dari satu perangkat.</span></label></div>
      <label>Pesan untuk pengirim<textarea id="dq-s-nt" rows="2" maxlength="300">${esc(SET.notice)}</textarea></label>
      <div class="ga-foot"><button type="submit" class="btn sm">Simpan pengaturan</button></div></form>`;
    $("#dq-sf").addEventListener("submit", async e => {
      e.preventDefault(); const mp = +$("#dq-s-mp").value, pt = +$("#dq-s-pt").value;
      if (!Number.isInteger(mp) || mp < 1 || mp > 2000) return note("err", "Batas antrean harus bilangan bulat 1 sampai 2000.");
      if (!Number.isInteger(pt) || pt < 1 || pt > 100) return note("err", "Batas per perangkat harus bilangan bulat 1 sampai 100.");
      try { const d = await q(Auth.client.from("dq_settings").update({ enabled: $("#dq-s-en").checked, require_login: $("#dq-s-lg").checked, max_pending: mp, per_token_daily: pt, notice: $("#dq-s-nt").value.trim(), updated_at: new Date().toISOString() }).eq("id", 1).select("id")); if (!d.length) throw new Error(friendly("permission denied")); note("ok", "Pengaturan tersimpan."); } catch (err) { note("err", err.message); }
    });
  }

  /* ===================== Templat ===================== */
  async function templates(body) {
    if (E) return editor(body);
    TPL = await q(Auth.client.from("dq_templates").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }));
    body.innerHTML = `<div class="tools ga-tools"><button type="button" class="btn sm" id="dq-t-add">Tambah templat</button></div>
      <p class="fhelp">Templat adalah latar poster. Unggah latar mentahan (tanpa orang dan tanpa teks yang akan diganti), lalu tandai tempat orang dan kotak teks. Templat pertama yang aktif menjadi pilihan utama.</p>
      <div class="ga-cards">${TPL.map((t, i) => `<article class="ga-card${t.active ? "" : " ga-del"}" data-id="${esc(t.id)}"><img src="${esc(t.back_image)}" alt="Templat ${esc(t.name)}" loading="lazy">
        <div class="ga-cbody"><strong>${esc(t.name)}</strong> <span class="chip ${t.active ? "approved" : "rejected"}">${t.active ? "Aktif" : "Nonaktif"}</span><p class="fhelp">${t.w} x ${t.h} piksel · ${t.fields.length} kotak teks</p></div>
        <div class="acts"><button type="button" class="btn ghost sm" data-a="edit">Ubah</button><button type="button" class="btn ghost sm" data-a="tg">${t.active ? "Nonaktifkan" : "Aktifkan"}</button><button type="button" class="btn ghost sm" data-a="up"${i === 0 ? " disabled" : ""} aria-label="Naikkan urutan">&uarr;</button><button type="button" class="btn ghost sm" data-a="dn"${i === TPL.length - 1 ? " disabled" : ""} aria-label="Turunkan urutan">&darr;</button><button type="button" class="btn danger sm" data-a="del">Hapus</button></div></article>`).join("") || '<p class="empty">Belum ada templat. Klik Tambah templat.</p>'}</div>`;
    $("#dq-t-add").addEventListener("click", () => { E = newE(); templates($("#dq-a-body")); });
    $(".ga-cards", body).addEventListener("click", async e => {
      const b = e.target.closest("[data-a]"); if (!b) return; const t = TPL.find(x => x.id === b.closest(".ga-card").dataset.id); if (!t) return;
      try {
        if (b.dataset.a === "edit") { E = fromRow(t); return templates($("#dq-a-body")); }
        if (b.dataset.a === "tg") await q(Auth.client.from("dq_templates").update({ active: !t.active, updated_at: new Date().toISOString() }).eq("id", t.id).select("id"));
        if (b.dataset.a === "up" || b.dataset.a === "dn") { const i = TPL.indexOf(t), j = i + (b.dataset.a === "up" ? -1 : 1), arr = TPL.slice(); [arr[i], arr[j]] = [arr[j], arr[i]]; for (let k = 0; k < arr.length; k++) await q(Auth.client.from("dq_templates").update({ sort_order: k }).eq("id", arr[k].id).select("id")); }
        if (b.dataset.a === "del") { if (!window.confirm(`Hapus templat "${t.name}"? Poster yang sudah dikirim tetap ada.`)) return; await q(Auth.client.from("dq_templates").delete().eq("id", t.id)); note("ok", "Templat dihapus."); }
        await draw();
      } catch (err) { note("err", err.message); }
    });
  }
  const defField = (key, over) => Object.assign({ key, label: ({ name: "Nama", job: "Jabatan atau departemen", quote: "Kata-kata", date: "Tanggal" })[key] || "Teks", sample: ({ name: "Nama Pekerja", job: "Jabatan, Departemen", quote: "Keselamatan bukan pilihan, tetapi tanggung jawab bersama.", date: "03/NOV/26" })[key] || "Contoh teks", x: 10, y: 50, w: 80, h: 6, size: 3, font: "body", weight: "600", italic: false, upper: false, color: "#FFFFFF", align: "center", maxlines: 1, shadow: false }, over || {});
  function newE() { return { id: null, name: "", active: true, sort: TPL.length, back: null, front: null, frontClear: false, w: 1080, h: 1350, photo: { x: 8, y: 27, w: 84, h: 53 }, fields: [defField("name", { y: 81.6, h: 4.2, size: 3.4, font: "display", weight: "800", upper: true }), defField("job", { y: 86, h: 2.8, size: 2.1, color: "#FBBF24" }), defField("quote", { y: 89.2, h: 7, size: 2, weight: "500", italic: true, maxlines: 4 })], sel: "photo", assets: {} }; }
  function fromRow(t) { return { id: t.id, name: t.name, active: t.active, sort: t.sort_order, back: { url: t.back_image, w: t.w, h: t.h }, front: t.front_image ? { url: t.front_image } : null, frontClear: false, w: t.w, h: t.h, photo: Object.assign({}, t.photo), fields: JSON.parse(JSON.stringify(t.fields)), sel: "photo", assets: {} }; }

  async function shrink(file, maxSide, kind) {
    const ext = ((file.name || "").toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";
    if (ext === "svg" || /svg/.test(file.type)) throw new Error("Format SVG tidak diizinkan. Gunakan JPG, PNG, atau WebP.");
    if (!["jpg", "jpeg", "png", "webp"].includes(ext) || (file.type && !/^image\/(jpeg|png|webp)$/.test(file.type))) throw new Error("Gunakan gambar JPG, PNG, atau WebP.");
    if (file.size > 25 * 1024 * 1024) throw new Error("Ukuran gambar melebihi 25 MB.");
    let bmp; try { bmp = await createImageBitmap(file); } catch (e) { throw new Error("Gambar tidak dapat dibaca."); }
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k)), cv = document.createElement("canvas"); cv.width = w; cv.height = h; const cx = cv.getContext("2d");
    if (kind === "back") { cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); } cx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(r => cv.toBlob(r, kind === "back" ? "image/jpeg" : "image/png", 0.9)); if (!blob) throw new Error("Gambar tidak dapat diproses.");
    return { blob, w, h, ext: kind === "back" ? "jpg" : "png", url: URL.createObjectURL(blob) };
  }
  async function upload(img, kind) {
    const path = `dq/templates/${Date.now().toString(36)}${rnd(4)}-${kind}.${img.ext}`;
    const r = await Auth.client.storage.from("site-media").upload(path, img.blob, { contentType: img.blob.type, cacheControl: "31536000", upsert: false });
    if (r.error) throw new Error(/bucket not found/i.test(r.error.message) ? "Penyimpanan foto belum dibuat. Jalankan supabase/schema.sql." : /row-level|policy|permission/i.test(r.error.message) ? "Akun ini tidak punya izin mengunggah. Pastikan Anda admin." : friendly(r.error.message));
    return Auth.client.storage.from("site-media").getPublicUrl(path).data.publicUrl;
  }

  function editor(body) {
    body.innerHTML = `<div class="dq-ed"><div class="dq-ed-main"><div class="dq-ed-stage" id="dq-stage" style="aspect-ratio:${E.w}/${E.h}"><canvas id="dq-cv" aria-label="Pratinjau templat"></canvas><div id="dq-boxes"></div></div>
        <p class="fhelp">Kotak <b>biru</b> = tempat orang (rata bawah, di tengah). Kotak <b>hijau</b> = teks. Seret kotak untuk memindah, tarik sudut kanan bawah untuk mengubah ukuran. Papan ketik: fokuskan kotak, panah menggeser, Ctrl + panah mengubah ukuran (Shift = lompatan besar).</p></div>
      <div class="dq-ed-side"><label>Nama templat<input id="dq-e-name" maxlength="80" value="${esc(E.name)}"></label><label class="fchk"><input type="checkbox" id="dq-e-act"${E.active ? " checked" : ""}> Aktif (tampil bagi pengunjung)</label>
        <label>Latar mentahan${E.back ? "" : " (wajib)"}<input type="file" id="dq-e-back" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"><span class="fhelp">Gambar latar tanpa orang. Ukuran poster mengikuti gambar ini. Disarankan 1080 x 1350.</span></label>
        <label>Lapisan depan (opsional)<input type="file" id="dq-e-front" accept=".png,.webp,image/png,image/webp"><span class="fhelp">PNG transparan yang tampil di atas orang, misalnya kotak keterangan dan footer. Ukuran harus sama dengan latar.${E.front ? ' <button type="button" class="btn ghost sm" id="dq-e-nofront">Hapus lapisan depan</button>' : ""}</span></label>
        <h4>Kotak</h4><ul id="dq-e-list" class="ga-sc-list"></ul><div class="tools ga-tools"><button type="button" class="btn ghost sm" id="dq-e-addf">Tambah kotak teks</button></div><div id="dq-e-form"></div></div></div>
      <p class="msg" id="dq-e-msg" role="alert"></p><div class="ga-foot"><button type="button" class="btn ghost" id="dq-e-x">Batal</button><button type="button" class="btn" id="dq-e-save">Simpan templat</button></div>`;
    const stage = $("#dq-stage"), emsg = (k, t) => { const m = $("#dq-e-msg"); m.className = "msg show " + k; m.textContent = t; };
    let timer = 0;
    const loadAssets = async () => { try { E.assets.back = E.back ? await window.DQ.loadImage(E.back.url) : null; E.assets.front = E.front ? await window.DQ.loadImage(E.front.url).catch(() => null) : null; } catch (e) { emsg("err", "Gambar latar tidak dapat dimuat."); } };
    const render = async () => {
      if (!E || !$("#dq-cv")) return; await window.DQ.ensureFonts();
      if (E.assets.back) window.DQ.render($("#dq-cv"), { w: E.w, h: E.h, photo: E.photo, fields: E.fields }, E.assets, { person: null, texts: {} }, { width: 540, placeholder: true, samples: true });
      else { const c = $("#dq-cv"); c.width = 540; c.height = Math.round(540 * E.h / E.w); const x = c.getContext("2d"); x.fillStyle = "#E2E8F0"; x.fillRect(0, 0, c.width, c.height); x.fillStyle = "#64748B"; x.font = "20px sans-serif"; x.textAlign = "center"; x.fillText("Unggah latar mentahan", c.width / 2, c.height / 2); }
    };
    const later = () => { clearTimeout(timer); timer = setTimeout(render, 70); };
    const model = s => s === "photo" ? E.photo : E.fields[s];
    function paintBoxes() {
      const items = [["photo", E.photo, "Foto orang"]].concat(E.fields.map((f, i) => [i, f, f.label]));
      $("#dq-boxes").innerHTML = items.map(([s, m, lab]) => `<div class="dq-bx ${s === "photo" ? "photo" : "txt"}${E.sel === s ? " on" : ""}" data-s="${s}" tabindex="0" role="button" aria-label="${esc(lab)}: kotak di ${m.x}%, ${m.y}%" style="left:${m.x}%;top:${m.y}%;width:${m.w}%;height:${m.h}%"><span class="dq-bl">${esc(lab)}</span><i class="dq-h" aria-hidden="true"></i></div>`).join("");
    }
    function paintList() {
      $("#dq-e-list").innerHTML = `<li><button type="button" class="ga-li${E.sel === "photo" ? " on" : ""}" data-s="photo">Foto orang</button></li>` + E.fields.map((f, i) => `<li><button type="button" class="ga-li${E.sel === i ? " on" : ""}" data-s="${i}">${esc(f.label)}</button></li>`).join("");
    }
    const numIn = (id, lab, v, mn, mx, st) => `<label>${lab}<input type="number" id="${id}" min="${mn}" max="${mx}" step="${st || 0.1}" value="${v}" inputmode="decimal"></label>`;
    function paintForm() {
      const s = E.sel, m = model(s); if (!m) { $("#dq-e-form").innerHTML = ""; return; }
      const geo = `<div class="frow dq-geo">${numIn("dq-g-x", "Kiri (%)", m.x, 0, 100)}${numIn("dq-g-y", "Atas (%)", m.y, 0, 100)}${numIn("dq-g-w", "Lebar (%)", m.w, 1, 100)}${numIn("dq-g-h", "Tinggi (%)", m.h, 1, 100)}</div>`;
      let h;
      if (s === "photo") h = `<fieldset class="ga-pform"><legend>Foto orang</legend><p class="fhelp">Orang diletakkan rata bawah dan di tengah kotak ini; tingginya menyesuaikan kotak. Pengunjung masih bisa mengatur ukuran dan posisinya.</p>${geo}</fieldset>`;
      else {
        const kk = KEYS.some(k => k[0] === m.key) ? m.key : "custom", sel = (id, lab, opts, v) => `<label>${lab}<select id="${id}">${opts.map(o => `<option value="${o[0]}"${String(o[0]) === String(v) ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label>`;
        h = `<fieldset class="ga-pform"><legend>Kotak teks: ${esc(m.label)}</legend>
          <label>Nama isian (yang dilihat pengunjung)<input id="dq-f-label" maxlength="60" value="${esc(m.label)}"></label>${sel("dq-f-key", "Jenis isian", KEYS, kk)}
          <label>Contoh teks (tampil di pratinjau)<input id="dq-f-sample" maxlength="300" value="${esc(m.sample)}"></label>
          <div class="frow">${sel("dq-f-font", "Huruf", [["display", "Judul tebal (Bricolage)"], ["body", "Teks biasa (Figtree)"], ["serif", "Serif"]], m.font)}${sel("dq-f-weight", "Ketebalan", [["400", "400 biasa"], ["500", "500"], ["600", "600"], ["700", "700 tebal"], ["800", "800"], ["900", "900"]], m.weight)}</div>
          <div class="frow">${numIn("dq-f-size", "Ukuran (% tinggi poster)", m.size, 0.5, 30, 0.1)}${numIn("dq-f-ml", "Maksimal baris", m.maxlines, 1, 8, 1)}</div>
          <p class="fhelp" id="dq-f-hint" role="status"></p>
          <div class="frow"><label>Warna<input type="color" id="dq-f-color" value="${esc(m.color)}"></label>${sel("dq-f-align", "Perataan", [["left", "Kiri"], ["center", "Tengah"], ["right", "Kanan"]], m.align)}</div>
          <label class="fchk"><input type="checkbox" id="dq-f-it"${m.italic ? " checked" : ""}> Miring</label><label class="fchk"><input type="checkbox" id="dq-f-up"${m.upper ? " checked" : ""}> HURUF BESAR semua</label><label class="fchk"><input type="checkbox" id="dq-f-sh"${m.shadow ? " checked" : ""}> Bayangan teks</label>
          ${geo}<button type="button" class="btn danger sm" id="dq-f-del">Hapus kotak teks ini</button></fieldset>`;
      }
      $("#dq-e-form").innerHTML = h;
      const hint = () => { const el = $("#dq-f-hint"); if (!el || s === "photo") return; const per = m.size * 1.22, fit = Math.max(1, Math.floor(m.h * 1.03 / per)); el.textContent = m.maxlines * per > m.h * 1.03 ? `Tinggi kotak (${m.h}%) hanya muat sekitar ${fit} baris pada ukuran huruf ${m.size}%, padahal Maksimal baris ${m.maxlines}. Naikkan Tinggi atau kecilkan Ukuran agar semua baris terbaca; bila tidak, teks akan dikecilkan otomatis.` : ""; };
      const bind = (id, fn) => { const el = $("#" + id); if (el) el.addEventListener("input", () => { fn(el); syncBox(); later(); hint(); }); };
      const num = (el, a, b, d) => { const v = parseFloat(el.value); return Number.isFinite(v) ? clamp(v, a, b) : d; };
      bind("dq-g-x", el => { m.x = num(el, 0, 100, m.x); }); bind("dq-g-y", el => { m.y = num(el, 0, 100, m.y); }); bind("dq-g-w", el => { m.w = num(el, 1, 100, m.w); }); bind("dq-g-h", el => { m.h = num(el, 1, 100, m.h); });
      if (s !== "photo") {
        hint();
        bind("dq-f-label", el => { m.label = el.value || "Teks"; paintList(); const b = $(`.dq-bx[data-s="${s}"] .dq-bl`); if (b) b.textContent = m.label; });
        bind("dq-f-sample", el => { m.sample = el.value; }); bind("dq-f-font", el => { m.font = el.value; }); bind("dq-f-weight", el => { m.weight = el.value; }); bind("dq-f-size", el => { m.size = num(el, 0.5, 30, m.size); });
        bind("dq-f-ml", el => { m.maxlines = Math.round(num(el, 1, 8, m.maxlines)); }); bind("dq-f-color", el => { m.color = el.value.toUpperCase(); }); bind("dq-f-align", el => { m.align = el.value; });
        bind("dq-f-it", el => { m.italic = el.checked; }); bind("dq-f-up", el => { m.upper = el.checked; }); bind("dq-f-sh", el => { m.shadow = el.checked; });
        $("#dq-f-key").addEventListener("change", e => {
          const v = e.target.value; if (v === "custom") { let n = 1; while (E.fields.some(f => f.key === "teks" + n)) n++; m.key = "teks" + n; }
          else if (E.fields.some(f => f !== m && f.key === v)) { emsg("err", "Jenis isian ini sudah dipakai kotak lain."); e.target.value = KEYS.some(k => k[0] === m.key) ? m.key : "custom"; return; } else m.key = v;
          $("#dq-e-msg").className = "msg";
        });
        $("#dq-f-del").addEventListener("click", () => { E.fields.splice(s, 1); E.sel = Math.min(s, E.fields.length - 1); if (E.sel < 0) E.sel = "photo"; paint(); later(); });
      }
    }
    function syncBox() { const m = model(E.sel), b = $(`.dq-bx[data-s="${E.sel}"]`); if (m && b) { b.style.left = m.x + "%"; b.style.top = m.y + "%"; b.style.width = m.w + "%"; b.style.height = m.h + "%"; } }
    function syncGeo() { const m = model(E.sel); if (!m) return; [["x", m.x], ["y", m.y], ["w", m.w], ["h", m.h]].forEach(([k, v]) => { const el = $("#dq-g-" + k); if (el) el.value = v; }); }
    const paint = () => { paintBoxes(); paintList(); paintForm(); };
    // seret dan ubah ukuran
    const boxes = $("#dq-boxes");
    boxes.addEventListener("pointerdown", e => {
      const el = e.target.closest(".dq-bx"); if (!el) return; const s = el.dataset.s === "photo" ? "photo" : +el.dataset.s, m = model(s), resize = !!e.target.closest(".dq-h");
      const sel = E.sel !== s; E.sel = s; if (sel) { $$(".dq-bx").forEach(x => x.classList.toggle("on", x === el)); paintList(); paintForm(); }
      const rc = stage.getBoundingClientRect(), o = { x: e.clientX, y: e.clientY, mx: m.x, my: m.y, mw: m.w, mh: m.h };
      const mv = ev => { const dx = (ev.clientX - o.x) / rc.width * 100, dy = (ev.clientY - o.y) / rc.height * 100;
        if (resize) { m.w = r1(clamp(o.mw + dx, 1, 100 - m.x)); m.h = r1(clamp(o.mh + dy, 1, 100 - m.y)); } else { m.x = r1(clamp(o.mx + dx, 0, 100 - m.w)); m.y = r1(clamp(o.my + dy, 0, 100 - m.h)); }
        syncBox(); syncGeo(); later(); };
      const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); e.preventDefault();
    });
    boxes.addEventListener("keydown", e => {
      const el = e.target.closest(".dq-bx"); if (!el) return; const s = el.dataset.s === "photo" ? "photo" : +el.dataset.s, m = model(s), st = e.shiftKey ? 2 : 0.5, d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key]; if (!d) return; e.preventDefault();
      if (e.ctrlKey || e.metaKey) { m.w = r1(clamp(m.w + d[0], 1, 100 - m.x)); m.h = r1(clamp(m.h + d[1], 1, 100 - m.y)); } else { m.x = r1(clamp(m.x + d[0], 0, 100 - m.w)); m.y = r1(clamp(m.y + d[1], 0, 100 - m.h)); }
      E.sel = s; el.style.left = m.x + "%"; el.style.top = m.y + "%"; el.style.width = m.w + "%"; el.style.height = m.h + "%"; syncGeo(); later();
    });
    boxes.addEventListener("focusin", e => { const el = e.target.closest(".dq-bx"); if (!el) return; const s = el.dataset.s === "photo" ? "photo" : +el.dataset.s; if (E.sel !== s) { E.sel = s; $$(".dq-bx").forEach(x => x.classList.toggle("on", x === el)); paintList(); paintForm(); } });
    $("#dq-e-list").addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (b) { E.sel = b.dataset.s === "photo" ? "photo" : +b.dataset.s; paint(); } });
    $("#dq-e-addf").addEventListener("click", () => { if (E.fields.length >= 8) return emsg("err", "Maksimal 8 kotak teks."); let n = 1; while (E.fields.some(f => f.key === "teks" + n)) n++; E.fields.push(defField("teks" + n, { label: "Teks " + n, sample: "Contoh teks" })); E.sel = E.fields.length - 1; paint(); later(); });
    $("#dq-e-name").addEventListener("input", e => { E.name = e.target.value; }); $("#dq-e-act").addEventListener("change", e => { E.active = e.target.checked; });
    $("#dq-e-back").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; try { const img = await shrink(f, 1600, "back"); E.back = img; E.w = img.w; E.h = img.h; stage.style.aspectRatio = `${E.w}/${E.h}`; await loadAssets(); render(); emsg("info", `Latar diganti (${img.w} x ${img.h} piksel).`); } catch (err) { emsg("err", err.message); e.target.value = ""; } });
    $("#dq-e-front").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; try { const img = await shrink(f, 1600, "front"); const asp = Math.abs(img.w / img.h - E.w / E.h) / (E.w / E.h); E.front = img; E.frontClear = false; await loadAssets(); render(); emsg(asp > 0.02 ? "warn" : "info", asp > 0.02 ? "Perbandingan ukuran lapisan depan berbeda dari latar, sehingga akan terlihat melar. Samakan ukurannya." : "Lapisan depan dipasang."); } catch (err) { emsg("err", err.message); e.target.value = ""; } });
    const nf = $("#dq-e-nofront"); if (nf) nf.addEventListener("click", () => { E.front = null; E.frontClear = true; loadAssets().then(render); nf.remove(); });
    $("#dq-e-x").addEventListener("click", () => { E = null; draw(); });
    $("#dq-e-save").addEventListener("click", async () => {
      const btn = $("#dq-e-save"), name = (E.name || "").trim(); E.name = name;
      if (!name) return emsg("err", "Nama templat wajib diisi."); if (!E.back) return emsg("err", "Unggah latar mentahan terlebih dulu.");
      if (!E.fields.length) return emsg("err", "Tambahkan minimal satu kotak teks.");
      const lab = E.fields.findIndex(f => !String(f.label).trim()); if (lab >= 0) return emsg("err", `Kotak teks ${lab + 1} belum diberi nama isian.`);
      btn.disabled = true; btn.textContent = "Menyimpan...";
      try {
        const back = E.back.blob ? await upload(E.back, "back") : E.back.url, front = E.front ? (E.front.blob ? await upload(E.front, "front") : E.front.url) : "";
        const row = { name, back_image: back, front_image: front, w: E.w, h: E.h, photo: E.photo, fields: E.fields.map(f => ({ key: f.key, label: String(f.label).trim(), sample: f.sample, x: f.x, y: f.y, w: f.w, h: f.h, size: f.size, font: f.font, weight: String(f.weight), italic: !!f.italic, upper: !!f.upper, color: f.color, align: f.align, maxlines: f.maxlines, shadow: !!f.shadow })), active: E.active, sort_order: E.sort, updated_at: new Date().toISOString() };
        if (E.id) await q(Auth.client.from("dq_templates").update(row).eq("id", E.id).select("id")); else await q(Auth.client.from("dq_templates").insert(row).select("id"));
        E = null; note("ok", "Templat disimpan."); await draw();
      } catch (err) { emsg("err", err.message); btn.disabled = false; btn.textContent = "Simpan templat"; }
    });
    paint(); loadAssets().then(render);
    const top = $(".dq-ed"); if (top && top.scrollIntoView) top.scrollIntoView({ block: "start" });
  }

  window.AdminDQ = { show, badge };
})();
