/* SHEGAMES di panel admin, level 1, 2, dan 4: kata dan tata letak TTS, rambu (unggah massal), foto bahaya (editor titik).
   Semua perubahan tersimpan sebagai draf dan baru berlaku setelah Terbitkan. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  let A = null, IMP = null, PREVIEW = null, NEWSIGNS = null, SC = null;
  const CATS = ["Larangan", "Peringatan", "Wajib", "Kondisi aman", "Pemadam api"];
  const slug = s => String(s || "x").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "x";
  const dlgOpen = d => { if (typeof d.showModal === "function") d.showModal(); else { d.classList.add("polyfill"); d.setAttribute("open", ""); } };
  const dlgClose = d => { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); };
  const status = r => !r.live ? '<span class="chip pending">Draf baru</span>' : r.pending_op === "edit" ? '<span class="chip pending">Diubah, belum terbit</span>' : r.pending_op === "delete" ? '<span class="chip rejected">Akan dihapus</span>' : '<span class="chip approved">Tayang</span>';
  const view = (r, keys) => (r.pending_op === "edit" && r.pending) ? Object.assign({}, r, r.pending) : r;
  const download = (u8, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([u8], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };

  /* ---------- Gambar: kecilkan di browser, unggah ke penyimpanan ---------- */
  async function shrink(file, maxW, kind) {
    const ext = ((file.name || "").toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";
    if (ext === "svg" || /svg/.test(file.type)) throw new Error(`${file.name}: format SVG tidak diizinkan. Gunakan JPG, PNG, atau WebP.`);
    if (!["jpg", "jpeg", "png", "webp"].includes(ext) || (file.type && !/^image\/(jpeg|png|webp)$/.test(file.type))) throw new Error(`${file.name}: gunakan gambar JPG, PNG, atau WebP.`);
    if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name}: ukuran melebihi 15 MB.`);
    let bmp; try { bmp = await createImageBitmap(file); } catch (e) { throw new Error(`${file.name}: gambar tidak dapat dibaca.`); }
    const sc = Math.min(1, maxW / bmp.width), w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const cx = cv.getContext("2d");
    if (kind === "photo") { cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); }
    cx.drawImage(bmp, 0, 0, w, h);
    let blob = await new Promise(res => cv.toBlob(res, kind === "photo" ? "image/jpeg" : "image/webp", kind === "photo" ? 0.85 : 0.9));
    if (!blob) throw new Error(`${file.name}: gambar tidak dapat diproses.`);
    const okType = kind === "photo" ? "image/jpeg" : "image/webp";
    if (blob.type !== okType) { blob = await new Promise(res => cv.toBlob(res, "image/png")); if (!blob) throw new Error(`${file.name}: gambar tidak dapat diproses.`); }
    return { blob, w, h, ext: blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png" };
  }
  async function upload(img, folder, base) {
    const path = `games/${folder}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}-${slug(base)}.${img.ext}`;
    const r = await Auth.client.storage.from("site-media").upload(path, img.blob, { contentType: img.blob.type, cacheControl: "31536000", upsert: false });
    if (r.error) {
      const m = r.error.message || "";
      throw new Error(/bucket not found/i.test(m) ? "Penyimpanan foto belum dibuat. Jalankan supabase/schema.sql di Supabase." : /mime|not supported|not allowed/i.test(m) ? "Jenis file ini tidak diizinkan oleh penyimpanan." : /exceed|too large|size/i.test(m) ? "Ukuran gambar melebihi batas penyimpanan." : /row-level|policy|permission|unauthor/i.test(m) ? "Akun ini tidak punya izin mengunggah. Pastikan Anda admin." : A.friendly(m));
    }
    return Auth.client.storage.from("site-media").getPublicUrl(path).data.publicUrl;
  }

  async function draw(tab, api) {
    A = api; const body = $("#ga-body");
    if (tab === "dash") return dashboard(body);
    if (tab === "l1") return words(body);
    if (tab === "l2") return signs(body);
    return scenes(body);
  }
  const reset = () => { IMP = null; PREVIEW = null; NEWSIGNS = null; SC = null; };
  const origDraw = draw;

  /* =====================================================================
     LEVEL 1: kata dan tata letak
     ===================================================================== */
  let WORDS = [], SAVED = null;
  const wv = r => view(r);
  const resWords = () => WORDS.filter(w => w.pending_op !== "delete").map(w => ({ id: w.id, word: String(wv(w).word).toUpperCase(), clue: wv(w).clue }));
  function layoutState() {
    const res = resWords();
    if (!SAVED || !SAVED.items || !SAVED.items.length) return { kind: "none", res };
    const m = new Map(res.map(w => [w.id, w.word]));
    const same = SAVED.items.length === res.length && SAVED.items.every(i => m.has(i.id));
    return { kind: same ? "ok" : "stale", res };
  }
  function gridHTML(L, res) {
    const word = new Map(res.map(w => [w.id, w.word])), cell = {}, num = {};
    L.items.forEach(it => { const w = word.get(it.id) || ""; for (let k = 0; k < w.length; k++) { const r = it.row + (it.dir === "D" ? k : 0), c = it.col + (it.dir === "A" ? k : 0); cell[r + "," + c] = w[k]; } num[it.row + "," + it.col] = it.num; });
    let h = "";
    for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) { const k = r + "," + c; h += cell[k] ? `<div class="ga-lc">${num[k] ? `<i>${num[k]}</i>` : ""}<b>${A.esc(cell[k])}</b></div>` : '<div class="ga-lb"></div>'; }
    return `<div class="ga-laygrid" style="grid-template-columns:repeat(${L.cols},26px)" role="img" aria-label="Pratinjau tata letak teka-teki silang ${L.rows} baris ${L.cols} kolom">${h}</div>`;
  }
  async function words(body) {
    if (IMP && IMP.kind === "words") return wordImport(body);
    const r = await Auth.client.from("game_words").select("*").order("created_at", { ascending: true });
    if (r.error) throw new Error(A.friendly(r.error.message));
    WORDS = r.data || [];
    const lay = await Auth.client.from("game_layout").select("grid").eq("id", 1).maybeSingle();
    SAVED = lay.data ? lay.data.grid : null;
    const ls = layoutState(), L = PREVIEW || (ls.kind !== "none" ? SAVED : null);
    const un = PREVIEW ? PREVIEW.unplaced.map(id => ls.res.find(w => w.id === id)).filter(Boolean) : [];
    const msg = PREVIEW ? (un.length ? `Pratinjau baru, tetapi ${un.length} kata tidak bisa dipasang. Ubah atau hapus kata itu.` : `Pratinjau baru (${PREVIEW.rows} x ${PREVIEW.cols} kotak). Belum disimpan.`)
      : ls.kind === "none" ? "Tata letak belum dibuat. Klik Buat tata letak otomatis." : ls.kind === "stale" ? "Tata letak tidak sesuai dengan daftar kata sekarang. Buat ulang sebelum menerbitkan." : `Tata letak tersimpan (${SAVED.rows} x ${SAVED.cols} kotak) dan sesuai dengan ${ls.res.length} kata.`;
    body.innerHTML = (await A.levelSettingsHTML(1)) + `
      <section class="ga-lay" aria-labelledby="ga-lay-h"><h3 id="ga-lay-h">Tata letak kotak</h3>
        <p id="ga-lay-st" class="ga-laymsg ${PREVIEW ? (un.length ? "bad" : "new") : ls.kind === "ok" ? "ok" : "bad"}" role="status">${A.esc(msg)}</p>
        ${un.length ? `<p class="warnbox">Kata yang tidak punya huruf yang sama dengan kata lain: <strong>${un.map(w => A.esc(w.word)).join(", ")}</strong>.</p>` : ""}
        <div class="tools ga-tools"><button type="button" class="btn sm" id="ga-lay-gen"${ls.res.length < 2 ? " disabled" : ""}>${PREVIEW ? "Acak ulang" : "Buat tata letak otomatis"}</button>${PREVIEW ? `<button type="button" class="btn sm teal" id="ga-lay-save"${un.length ? " disabled" : ""}>Simpan tata letak sebagai draf</button><button type="button" class="btn ghost sm" id="ga-lay-x">Batal</button>` : ""}</div>
        <div class="ga-scroll" tabindex="0" role="region" aria-label="Pratinjau tata letak">${L ? gridHTML(L, ls.res) : '<p class="empty">Belum ada tata letak.</p>'}</div>
      </section>
      <div class="tools ga-tools"><button type="button" class="btn sm" id="ga-w-add">Tambah kata</button>
        <label class="btn ghost sm ga-file">Impor dari dokumen<input type="file" id="ga-w-file" accept=".docx,.xlsx,.csv,.pdf,.txt" class="sr"></label>
        <button type="button" class="btn ghost sm" id="ga-w-tpl">Unduh templat Excel</button><input type="search" id="ga-w-s" placeholder="Cari kata" aria-label="Cari kata"></div>
      <p class="fhelp">Format dokumen: <code>KATA | petunjuk</code> per baris, atau tabel dengan kolom Jawaban dan Petunjuk. Setiap kata harus punya huruf yang sama dengan kata lain agar bisa disusun menyilang. Total ${WORDS.length} kata (minimal 4). Tata letak dibuat ulang otomatis setiap daftar kata berubah.</p>
      <p id="ga-w-st" class="upst" role="status"></p>
      <div class="ga-scroll" tabindex="0" role="region" aria-label="Daftar kata"><table class="tbl" id="ga-w-tbl"><thead><tr><th>Kata</th><th>Petunjuk</th><th>Status</th><th>Aksi</th></tr></thead><tbody></tbody></table></div>`;
    A.wireLevelSettings(body);
    const fill = () => {
      const s = $("#ga-w-s").value.trim().toLowerCase();
      $("#ga-w-tbl tbody").innerHTML = WORDS.filter(w => !s || (wv(w).word + " " + wv(w).clue).toLowerCase().includes(s)).map(w => `<tr data-id="${A.esc(w.id)}"${w.pending_op === "delete" ? ' class="ga-del"' : ""}><td><strong>${A.esc(String(wv(w).word).toUpperCase())}</strong> <span class="fhelp">${String(wv(w).word).length} huruf</span></td><td>${A.esc(wv(w).clue)}</td><td>${status(w)}</td><td class="acts">${w.pending_op === "delete" ? '<button type="button" class="btn ghost sm" data-act="restore">Pulihkan</button>' : '<button type="button" class="btn ghost sm" data-act="edit">Ubah</button><button type="button" class="btn ghost sm" data-act="del">Hapus</button>'}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">${WORDS.length ? "Tidak ada kata yang cocok." : "Belum ada kata."}</td></tr>`;
    };
    fill(); $("#ga-w-s").addEventListener("input", fill);
    $("#ga-lay-gen").addEventListener("click", () => {
      const G = window.GamesCW.generate(ls.res.map(w => ({ id: w.id, word: w.word })), { seed: Math.floor(Math.random() * 1e9) + 1 });
      PREVIEW = G; words(body).catch(e => A.note("err", e.message));
    });
    const sv = $("#ga-lay-save"); if (sv) sv.addEventListener("click", async () => {
      try { await A.rpc("game_admin_save_layout", { p_grid: { rows: PREVIEW.rows, cols: PREVIEW.cols, items: PREVIEW.items } }); PREVIEW = null; A.note("ok", "Tata letak disimpan sebagai draf. Klik Terbitkan agar berlaku bagi pemain."); await A.redraw(); }
      catch (e) { A.note("err", e.message); }
    });
    const cx = $("#ga-lay-x"); if (cx) cx.addEventListener("click", () => { PREVIEW = null; A.redraw(); });
    $("#ga-w-add").addEventListener("click", () => wordDialog(null));
    $("#ga-w-tpl").addEventListener("click", () => download(window.GamesParse.makeXlsx(window.GamesParse.WORD_TEMPLATE, "Kata"), "templat-kata-teka-teki-silang.xlsx"));
    $("#ga-w-file").addEventListener("change", onWordFile);
    $("#ga-w-tbl").addEventListener("click", async e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const w = WORDS.find(x => x.id === b.closest("tr").dataset.id); if (!w) return;
      try {
        if (b.dataset.act === "edit") return wordDialog(w);
        if (b.dataset.act === "del") { if (!window.confirm("Hapus kata ini? Kata yang sudah tayang baru hilang setelah Terbitkan.")) return; await A.rpc("game_admin_delete_item", { p_kind: "word", p_id: w.id }); }
        if (b.dataset.act === "restore") await A.rpc("game_admin_save_item", { p_kind: "word", p_id: w.id, p_data: { word: w.word, clue: w.clue } });
        await afterWords();
      } catch (err) { A.note("err", err.message); }
    });
  }
  /* Setelah daftar kata berubah: buat ulang tata letak otomatis (benih tetap, hasil sama bila kata sama) */
  async function afterWords() {
    PREVIEW = null;
    const r = await Auth.client.from("game_words").select("*"); WORDS = r.data || [];
    const res = resWords(); let msg = "";
    if (res.length >= 2) {
      const G = window.GamesCW.generate(res.map(w => ({ id: w.id, word: w.word })), { seed: 20260101 });
      if (G.items.length) {
        try { await A.rpc("game_admin_save_layout", { p_grid: { rows: G.rows, cols: G.cols, items: G.items } }); msg = G.unplaced.length ? ` Tata letak diperbarui, tetapi ${G.unplaced.length} kata tidak bisa dipasang.` : " Tata letak dibuat ulang otomatis."; }
        catch (e) { msg = " Tata letak belum bisa diperbarui: " + e.message; }
      }
    }
    A.note("ok", "Daftar kata diperbarui." + msg + " Klik Terbitkan agar berlaku bagi pemain.");
    await A.redraw();
  }
  function wordDialog(w) {
    let d = $("#ga-dlg"); if (!d) { d = document.createElement("dialog"); d.id = "ga-dlg"; d.className = "cdlg"; document.body.appendChild(d); }
    d.setAttribute("aria-label", "Formulir kata");
    const v = w ? wv(w) : { word: "", clue: "" };
    d.innerHTML = `<form id="ga-wf" novalidate><div class="chead"><h2>${w ? "Ubah kata" : "Tambah kata"}</h2></div>
      <label>Kata (huruf A-Z, 2 sampai 20 huruf)<input id="ga-wf-w" value="${A.esc(v.word)}" maxlength="30" autocapitalize="characters"></label>
      <label>Petunjuk<textarea id="ga-wf-c" rows="3" maxlength="300">${A.esc(v.clue)}</textarea></label>
      <p class="msg" id="ga-wf-m" role="alert"></p><div class="foot"><button type="button" class="btn ghost" id="ga-wf-x">Batal</button><button type="submit" class="btn">Simpan sebagai draf</button></div></form>`;
    $("#ga-wf-x").addEventListener("click", () => dlgClose(d));
    $("#ga-wf").addEventListener("submit", async e => {
      e.preventDefault(); const it = { word: $("#ga-wf-w").value, clue: $("#ga-wf-c").value }, p = window.GamesParse.validateWord(it, null), m = $("#ga-wf-m");
      if (p.length) { m.className = "msg show err"; m.textContent = p.join(". ") + "."; return; }
      try { await A.rpc("game_admin_save_item", { p_kind: "word", p_id: w ? w.id : null, p_data: it }); dlgClose(d); await afterWords(); }
      catch (err) { m.className = "msg show err"; m.textContent = err.message; }
    });
    dlgOpen(d); setTimeout(() => $("#ga-wf-w").focus(), 30);
  }
  async function onWordFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const st = $("#ga-w-st"); st.className = "upst"; st.textContent = `Membaca ${file.name}...`;
    try {
      const items = window.GamesParse.parseWords(await window.GamesParse.readFile(file));
      if (!items.length) throw new Error('Tidak ada kata yang dikenali. Tulis satu per baris dengan format "KATA | petunjuk", atau pakai tabel berkolom Jawaban dan Petunjuk. Unduh templat Excel untuk contoh.');
      IMP = { kind: "words", name: file.name, items: items.slice(0, 300), mode: "add" }; wordImport($("#ga-body"));
    } catch (err) { st.className = "upst err"; st.textContent = err.message || "Berkas tidak dapat dibaca."; }
    e.target.value = "";
  }
  function wordImport(body) {
    body.innerHTML = `<div class="ga-imp-head"><h3>Pratinjau impor kata: ${A.esc(IMP.name)}</h3><p id="ga-imp-sum" class="fhelp" role="status"></p>
      <fieldset class="ga-mode"><legend>Cara menyimpan</legend><label class="fchk"><input type="radio" name="ga-mode" value="add"${IMP.mode === "add" ? " checked" : ""}> Tambahkan ke kata yang sudah ada</label><label class="fchk"><input type="radio" name="ga-mode" value="replace"${IMP.mode === "replace" ? " checked" : ""}> Ganti semua kata yang ada dengan kata ini</label></fieldset></div>
      <div id="ga-imp-list">${IMP.items.map((it, i) => `<div class="ga-item ga-witem" data-i="${i}"><label>Kata<input class="iw" value="${A.esc(it.word)}" maxlength="30"></label><label>Petunjuk<input class="ic" value="${A.esc(it.clue)}" maxlength="300"></label><span class="ga-probs"></span><button type="button" class="btn ghost sm" data-drop>Buang</button></div>`).join("")}</div>
      <p class="msg" id="ga-imp-msg" role="alert"></p><div class="ga-foot"><button type="button" class="btn ghost" id="ga-imp-x">Batal impor</button><button type="button" class="btn" id="ga-imp-save">Simpan</button></div>`;
    const read = () => $$(".ga-witem", body).map(b => ({ word: $(".iw", b).value, clue: $(".ic", b).value }));
    const refresh = () => {
      if (!IMP || !$("#ga-imp-sum")) return;
      const seen = new Set(IMP.mode === "add" ? resWords().map(w => String(w.word).replace(/\s+/g, "").toUpperCase()) : []); let good = 0, bad = 0;
      $$(".ga-witem", body).forEach(b => { const p = window.GamesParse.validateWord({ word: $(".iw", b).value, clue: $(".ic", b).value }, seen); b.classList.toggle("bad", p.length > 0); $(".ga-probs", b).innerHTML = p.map(x => `<span class="chip rejected">${A.esc(x)}</span>`).join(""); p.length ? bad++ : good++; });
      $("#ga-imp-sum").textContent = `${good + bad} kata terbaca: ${good} siap disimpan, ${bad} perlu diperbaiki. Perbaiki langsung di bawah; kata yang masih bermasalah tidak ikut disimpan.`;
      const b = $("#ga-imp-save"); b.textContent = good ? `Simpan ${good} kata sebagai draf` : "Belum ada kata yang siap"; b.disabled = !good;
    };
    $("#ga-imp-list").addEventListener("input", refresh);
    $("#ga-imp-list").addEventListener("click", e => { const d = e.target.closest("[data-drop]"); if (d) { d.closest(".ga-item").remove(); refresh(); } });
    $$('input[name="ga-mode"]', body).forEach(r => r.addEventListener("change", () => { IMP.mode = r.value; refresh(); }));
    $("#ga-imp-x").addEventListener("click", () => { IMP = null; A.redraw(); });
    $("#ga-imp-save").addEventListener("click", async () => {
      const seen = new Set(IMP.mode === "add" ? resWords().map(w => String(w.word).replace(/\s+/g, "").toUpperCase()) : []), items = read().filter(it => !window.GamesParse.validateWord(it, seen).length), m = $("#ga-imp-msg"), b = $("#ga-imp-save");
      if (!items.length) return;
      if (IMP.mode === "replace" && !window.confirm(`Ganti SEMUA kata yang ada dengan ${items.length} kata ini? Perubahan baru berlaku setelah Terbitkan.`)) return;
      b.disabled = true; let n = 0;
      try {
        if (IMP.mode === "replace") await A.rpc("game_admin_clear", { p_kind: "word" });
        for (const it of items) { b.textContent = `Menyimpan ${n + 1} dari ${items.length}...`; await A.rpc("game_admin_save_item", { p_kind: "word", p_id: null, p_data: it }); n++; }
        IMP = null; await afterWords();
      } catch (err) { m.className = "msg show err"; m.textContent = `${n} kata tersimpan, lalu terhenti: ${err.message}`; b.disabled = false; }
    });
    refresh();
  }

  /* =====================================================================
     LEVEL 2: rambu (unggah massal)
     ===================================================================== */
  let SIGNS = [];
  const GUESS = [["Pemadam api", /apar|pemadam|hidran|hydrant|fire|selang api/], ["Kondisi aman", /evakuasi|darurat|aman|kumpul|p3k|pertolongan|exit|keluar|safe/], ["Larangan", /dilarang|larangan|jangan|tidak boleh|stop|no[ _-]/], ["Peringatan", /awas|bahaya|hati|waspada|peringatan|licin|listrik|racun|beracun|warning|caution/], ["Wajib", /wajib|gunakan|pakai|harus|helm|kacamata|sarung|masker|sepatu|rompi|mandatory/]];
  const guessCat = n => { const t = String(n).toLowerCase(); for (const [c, re] of GUESS) if (re.test(t)) return c; return "Peringatan"; };
  const niceName = f => { const b = String(f).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(); return b ? b.charAt(0).toUpperCase() + b.slice(1) : "Rambu"; };
  const catSelect = (v, cls) => `<select class="${cls}" aria-label="Kategori">${CATS.map(c => `<option${c === v ? " selected" : ""}>${c}</option>`).join("")}</select>`;
  async function signs(body) {
    if (NEWSIGNS) return signBatch(body);
    const r = await Auth.client.from("game_signs").select("*").order("created_at", { ascending: true });
    if (r.error) throw new Error(A.friendly(r.error.message));
    SIGNS = r.data || [];
    const live = SIGNS.filter(s => s.live && s.pending_op !== "delete").length;
    body.innerHTML = (await A.levelSettingsHTML(2)) + `
      <div class="tools ga-tools"><label class="btn sm ga-file">Unggah gambar rambu (bisa banyak sekaligus)<input type="file" id="ga-s-file" multiple accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" class="sr"></label><input type="search" id="ga-s-s" placeholder="Cari rambu" aria-label="Cari rambu"></div>
      <p class="fhelp">Nama berkas menjadi nama rambu dan kategorinya ditebak dari katanya; keduanya bisa diubah sebelum disimpan. Gambar JPG, PNG, atau WebP dikecilkan otomatis di komputer Anda. SVG tidak diizinkan. Total ${SIGNS.length} rambu, ${live} akan tayang setelah diterbitkan. Minimal 4 dengan nama yang berbeda.</p>
      <p id="ga-s-st" class="upst" role="status"></p><div class="ga-cards" id="ga-s-grid"></div>`;
    A.wireLevelSettings(body);
    const fill = () => {
      const s = $("#ga-s-s").value.trim().toLowerCase();
      $("#ga-s-grid").innerHTML = SIGNS.filter(x => !s || (view(x).name + " " + view(x).category).toLowerCase().includes(s)).map(x => { const v = view(x); return `<article class="ga-card${x.pending_op === "delete" ? " ga-del" : ""}" data-id="${A.esc(x.id)}"><img src="${A.esc(v.image)}" alt="Rambu ${A.esc(v.name)}" loading="lazy"><div class="ga-cbody"><strong>${A.esc(v.name)}</strong><span class="chip">${A.esc(v.category)}</span> ${status(x)}<p>${A.esc(v.meaning || "")}</p></div><div class="acts">${x.pending_op === "delete" ? '<button type="button" class="btn ghost sm" data-act="restore">Pulihkan</button>' : '<button type="button" class="btn ghost sm" data-act="edit">Ubah</button><button type="button" class="btn ghost sm" data-act="del">Hapus</button>'}</div></article>`; }).join("") || `<p class="empty">${SIGNS.length ? "Tidak ada rambu yang cocok." : "Belum ada rambu. Unggah gambar rambu untuk memulai."}</p>`;
    };
    fill(); $("#ga-s-s").addEventListener("input", fill);
    $("#ga-s-file").addEventListener("change", onSignFiles);
    $("#ga-s-grid").addEventListener("click", async e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const x = SIGNS.find(z => z.id === b.closest(".ga-card").dataset.id); if (!x) return;
      try {
        if (b.dataset.act === "edit") return signDialog(x);
        if (b.dataset.act === "del") { if (!window.confirm("Hapus rambu ini? Rambu yang sudah tayang baru hilang setelah Terbitkan.")) return; await A.rpc("game_admin_delete_item", { p_kind: "sign", p_id: x.id }); }
        if (b.dataset.act === "restore") await A.rpc("game_admin_save_item", { p_kind: "sign", p_id: x.id, p_data: { name: x.name, category: x.category, meaning: x.meaning, image: x.image } });
        await A.redraw();
      } catch (err) { A.note("err", err.message); }
    });
  }
  async function onSignFiles(e) {
    const files = Array.from(e.target.files || []); e.target.value = ""; if (!files.length) return;
    const st = $("#ga-s-st"); st.className = "upst"; const out = [], errs = [];
    for (let i = 0; i < files.length; i++) {
      st.textContent = `Memproses gambar ${i + 1} dari ${files.length}...`;
      try { const img = await shrink(files[i], 640, "sign"), name = niceName(files[i].name); out.push({ img, url: URL.createObjectURL(img.blob), name, category: guessCat(name), meaning: "" }); }
      catch (err) { errs.push(err.message); }
    }
    if (!out.length) { st.className = "upst err"; st.textContent = errs.join(" "); return; }
    NEWSIGNS = { items: out, errs }; signBatch($("#ga-body"));
  }
  function signBatch(body) {
    const N = NEWSIGNS;
    body.innerHTML = `<div class="ga-imp-head"><h3>Rambu yang akan ditambahkan</h3><p id="ga-sb-sum" class="fhelp" role="status"></p>${N.errs.length ? `<p class="warnbox">${N.errs.map(A.esc).join("<br>")}</p>` : ""}</div>
      <div id="ga-sb-list">${N.items.map((it, i) => `<div class="ga-item ga-sitem" data-i="${i}"><img src="${it.url}" alt="Gambar rambu ${A.esc(it.name)}"><div class="ga-sfields"><label>Nama rambu<input class="ga-sn" value="${A.esc(it.name)}" maxlength="80"></label><label>Kategori${catSelect(it.category, "ga-sc")}</label><label>Arti rambu (tampil setelah menjawab)<textarea class="ga-sm" rows="2" maxlength="500">${A.esc(it.meaning)}</textarea></label></div><div><span class="ga-probs"></span><button type="button" class="btn ghost sm" data-drop>Buang</button></div></div>`).join("")}</div>
      <p class="msg" id="ga-sb-msg" role="alert"></p><div class="ga-foot"><button type="button" class="btn ghost" id="ga-sb-x">Batal</button><button type="button" class="btn" id="ga-sb-save">Simpan</button></div>`;
    const read = () => $$(".ga-sitem", body).map(b => ({ i: +b.dataset.i, name: $(".ga-sn", b).value.trim(), category: $(".ga-sc", b).value, meaning: $(".ga-sm", b).value.trim() }));
    const refresh = () => {
      if (!NEWSIGNS || !$("#ga-sb-sum")) return;
      const names = new Map(); SIGNS.filter(s => s.pending_op !== "delete").forEach(s => names.set(String(view(s).name).toLowerCase(), 1));
      const cnt = {}; read().forEach(r => { cnt[r.name.toLowerCase()] = (cnt[r.name.toLowerCase()] || 0) + 1; });
      let good = 0, bad = 0;
      $$(".ga-sitem", body).forEach(b => {
        const nm = $(".ga-sn", b).value.trim(), p = []; if (!nm) p.push("Nama kosong"); if (nm && cnt[nm.toLowerCase()] > 1) p.push("Nama kembar dalam unggahan ini"); if (nm && names.has(nm.toLowerCase())) p.push("Nama sudah dipakai rambu lain");
        b.classList.toggle("bad", p.length > 0); $(".ga-probs", b).innerHTML = p.map(x => `<span class="chip rejected">${A.esc(x)}</span>`).join(""); p.length ? bad++ : good++;
      });
      $("#ga-sb-sum").textContent = `${good + bad} gambar siap diperiksa: ${good} siap disimpan, ${bad} perlu diperbaiki.`;
      const s = $("#ga-sb-save"); s.textContent = good ? `Simpan ${good} rambu sebagai draf` : "Belum ada rambu yang siap"; s.disabled = !good;
    };
    $("#ga-sb-list").addEventListener("input", refresh); $("#ga-sb-list").addEventListener("change", refresh);
    $("#ga-sb-list").addEventListener("click", e => { const d = e.target.closest("[data-drop]"); if (d) { d.closest(".ga-item").remove(); refresh(); } });
    $("#ga-sb-x").addEventListener("click", () => { NEWSIGNS = null; A.redraw(); });
    $("#ga-sb-save").addEventListener("click", async () => {
      const rows = read(), m = $("#ga-sb-msg"), btn = $("#ga-sb-save"); btn.disabled = true; let n = 0;
      const bad = new Set($$(".ga-sitem.bad", body).map(b => +b.dataset.i)), ok = rows.filter(r => !bad.has(r.i));
      try {
        for (const r of ok) {
          btn.textContent = `Mengunggah ${n + 1} dari ${ok.length}...`;
          const url = await upload(N.items[r.i].img, "signs", r.name);
          await A.rpc("game_admin_save_item", { p_kind: "sign", p_id: null, p_data: { name: r.name, category: r.category, meaning: r.meaning, image: url } }); n++;
        }
        NEWSIGNS = null; A.note("ok", `${n} rambu disimpan sebagai draf. Klik Terbitkan agar berlaku bagi pemain.`); await A.redraw();
      } catch (err) { m.className = "msg show err"; m.textContent = `${n} rambu tersimpan, lalu terhenti: ${err.message}`; btn.disabled = false; }
    });
    refresh();
  }
  function signDialog(x) {
    let d = $("#ga-dlg"); if (!d) { d = document.createElement("dialog"); d.id = "ga-dlg"; d.className = "cdlg"; document.body.appendChild(d); }
    d.setAttribute("aria-label", "Formulir rambu"); const v = view(x);
    d.innerHTML = `<form id="ga-sf" novalidate><div class="chead"><h2>Ubah rambu</h2></div><div class="ga-sedit"><img id="ga-sf-img" src="${A.esc(v.image)}" alt="Gambar rambu saat ini">
      <div><label>Nama rambu<input id="ga-sf-n" value="${A.esc(v.name)}" maxlength="80"></label><label>Kategori${catSelect(v.category, "")}</label>
      <label>Arti rambu<textarea id="ga-sf-m" rows="3" maxlength="500">${A.esc(v.meaning || "")}</textarea></label>
      <label>Ganti gambar (opsional)<input type="file" id="ga-sf-f" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"></label></div></div>
      <p class="msg" id="ga-sf-msg" role="alert"></p><div class="foot"><button type="button" class="btn ghost" id="ga-sf-x">Batal</button><button type="submit" class="btn">Simpan sebagai draf</button></div></form>`;
    let newImg = null; const m = $("#ga-sf-msg");
    $("#ga-sf-f").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; try { newImg = await shrink(f, 640, "sign"); $("#ga-sf-img").src = URL.createObjectURL(newImg.blob); m.className = "msg"; } catch (err) { newImg = null; m.className = "msg show err"; m.textContent = err.message; e.target.value = ""; } });
    $("#ga-sf-x").addEventListener("click", () => dlgClose(d));
    $("#ga-sf").addEventListener("submit", async e => {
      e.preventDefault(); const name = $("#ga-sf-n").value.trim(); if (!name) { m.className = "msg show err"; m.textContent = "Nama rambu wajib diisi."; return; }
      try {
        const url = newImg ? await upload(newImg, "signs", name) : v.image;
        await A.rpc("game_admin_save_item", { p_kind: "sign", p_id: x.id, p_data: { name, category: $("select", d).value, meaning: $("#ga-sf-m").value.trim(), image: url } });
        dlgClose(d); A.note("ok", "Rambu disimpan sebagai draf. Klik Terbitkan agar berlaku bagi pemain."); await A.redraw();
      } catch (err) { m.className = "msg show err"; m.textContent = err.message; }
    });
    dlgOpen(d); setTimeout(() => $("#ga-sf-n").focus(), 30);
  }

  /* =====================================================================
     LEVEL 4: foto bahaya (editor titik)
     ===================================================================== */
  let SCENES = [];
  async function scenes(body) {
    if (SC) return sceneEditor(body);
    const r = await Auth.client.from("game_scenes").select("*").order("created_at", { ascending: true });
    if (r.error) throw new Error(A.friendly(r.error.message));
    SCENES = r.data || [];
    const live = SCENES.filter(s => s.live && s.pending_op !== "delete").length;
    body.innerHTML = (await A.levelSettingsHTML(4)) + `
      <div class="tools ga-tools"><label class="btn sm ga-file">Tambah foto bahaya<input type="file" id="ga-c-file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" class="sr"></label></div>
      <p class="fhelp">Unggah foto area kerja, lalu klik foto untuk menandai titik bahaya, mengisi nama, risiko, dan pengendalian. Foto JPG, PNG, atau WebP dikecilkan otomatis. Total ${SCENES.length} foto, ${live} akan tayang setelah diterbitkan. Tiap foto minimal 1 titik.</p>
      <p id="ga-c-st" class="upst" role="status"></p><div class="ga-cards" id="ga-c-grid"></div>`;
    A.wireLevelSettings(body);
    $("#ga-c-grid").innerHTML = SCENES.map(x => { const v = view(x), n = (v.points || []).length; return `<article class="ga-card${x.pending_op === "delete" ? " ga-del" : ""}" data-id="${A.esc(x.id)}"><img src="${A.esc(v.image)}" alt="Foto ${A.esc(v.title)}" loading="lazy"><div class="ga-cbody"><strong>${A.esc(v.title)}</strong><span class="chip">${n} titik bahaya</span> ${status(x)}<p>${A.esc(v.prompt || "")}</p></div><div class="acts">${x.pending_op === "delete" ? '<button type="button" class="btn ghost sm" data-act="restore">Pulihkan</button>' : '<button type="button" class="btn ghost sm" data-act="edit">Ubah titik</button><button type="button" class="btn ghost sm" data-act="del">Hapus</button>'}</div></article>`; }).join("") || '<p class="empty">Belum ada foto. Klik Tambah foto bahaya.</p>';
    $("#ga-c-file").addEventListener("change", async e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      const st = $("#ga-c-st"); st.className = "upst"; st.textContent = "Memproses foto...";
      try { const img = await shrink(f, 1600, "photo"); SC = { id: null, title: niceName(f.name), prompt: "Temukan semua bahaya pada foto ini.", img, url: URL.createObjectURL(img.blob), w: img.w, h: img.h, points: [], sel: -1 }; sceneEditor($("#ga-body")); }
      catch (err) { st.className = "upst err"; st.textContent = err.message; }
    });
    $("#ga-c-grid").addEventListener("click", async e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const x = SCENES.find(z => z.id === b.closest(".ga-card").dataset.id); if (!x) return; const v = view(x);
      try {
        if (b.dataset.act === "edit") { SC = { id: x.id, title: v.title, prompt: v.prompt || "", img: null, url: v.image, w: v.img_w, h: v.img_h, points: JSON.parse(JSON.stringify(v.points || [])), sel: (v.points || []).length ? 0 : -1 }; return sceneEditor($("#ga-body")); }
        if (b.dataset.act === "del") { if (!window.confirm("Hapus foto ini? Foto yang sudah tayang baru hilang setelah Terbitkan.")) return; await A.rpc("game_admin_delete_item", { p_kind: "scene", p_id: x.id }); }
        if (b.dataset.act === "restore") await A.rpc("game_admin_save_item", { p_kind: "scene", p_id: x.id, p_data: { title: x.title, prompt: x.prompt, image: x.image, img_w: x.img_w, img_h: x.img_h, points: x.points } });
        await A.redraw();
      } catch (err) { A.note("err", err.message); }
    });
  }
  function sceneEditor(body) {
    const S = SC, esc = A.esc;
    body.innerHTML = `<div class="ga-sceneed">
      <div class="ga-sc-main"><div class="ga-sc-img" id="ga-sc-img" style="aspect-ratio:${S.w}/${S.h}"><img src="${esc(S.url)}" alt="" draggable="false"><div id="ga-sc-pts"></div></div>
        <p class="fhelp">Klik pada foto untuk menambah titik bahaya. Seret titik untuk memindahnya. Pilih titik lalu gunakan tombol panah untuk menggeser halus (Shift = lebih besar). Lingkaran adalah area yang dihitung benar saat pemain mengetuk.</p></div>
      <div class="ga-sc-side">
        <label>Judul foto<input id="ga-sc-title" value="${esc(S.title)}" maxlength="120"></label>
        <label>Perintah untuk pemain<textarea id="ga-sc-prompt" rows="2" maxlength="300">${esc(S.prompt)}</textarea></label>
        <label>Ganti foto (opsional)<input type="file" id="ga-sc-file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"></label>
        <h4>Titik bahaya (<span id="ga-sc-n"></span>)</h4><ul id="ga-sc-list" class="ga-sc-list"></ul>
        <div id="ga-sc-form"></div>
        <div class="tools ga-tools"><button type="button" class="btn ghost sm" id="ga-sc-addc">Tambah titik di tengah foto</button></div>
      </div></div>
      <p class="msg" id="ga-sc-msg" role="alert"></p>
      <div class="ga-foot"><button type="button" class="btn ghost" id="ga-sc-x">Batal</button><button type="button" class="btn" id="ga-sc-save">Simpan sebagai draf</button></div>`;
    const box = $("#ga-sc-img"), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rd = v => Math.round(v * 100) / 100;
    let dragging = false, justDragged = false;
    const lblOf = (p, i) => `${i + 1}. ${p.name || "(tanpa nama)"}`;
    function paintPts() {
      $("#ga-sc-n").textContent = S.points.length;
      $("#ga-sc-pts").innerHTML = S.points.map((p, i) => `<button type="button" class="ga-pt${i === S.sel ? " on" : ""}" data-i="${i}" style="left:${p.x}%;top:${p.y}%;width:${p.r * 2}%" aria-label="Titik ${i + 1}: ${esc(p.name || "tanpa nama")}"><span>${i + 1}</span></button>`).join("");
    }
    function paintList() {
      $("#ga-sc-list").innerHTML = S.points.map((p, i) => `<li><button type="button" class="ga-li${i === S.sel ? " on" : ""}" data-i="${i}">${esc(lblOf(p, i))}</button></li>`).join("") || '<li class="empty">Belum ada titik.</li>';
    }
    function paintForm() {
      const p = S.points[S.sel];
      $("#ga-sc-form").innerHTML = p ? `<fieldset class="ga-pform"><legend>Titik ${S.sel + 1}</legend>
        <label>Nama bahaya<input id="ga-p-n" value="${esc(p.name)}" maxlength="120"></label><label>Risiko<textarea id="ga-p-r" rows="2" maxlength="300">${esc(p.risk)}</textarea></label><label>Pengendalian<textarea id="ga-p-c" rows="2" maxlength="300">${esc(p.control)}</textarea></label>
        <label>Ukuran area ketuk (% lebar foto)<span class="ga-rad"><input type="range" id="ga-p-rs" min="1" max="30" step="0.5" value="${Math.min(30, p.r)}"><input type="number" id="ga-p-rn" min="1" max="50" step="0.5" value="${p.r}"></span></label>
        <button type="button" class="btn danger sm" id="ga-p-del">Hapus titik ini</button></fieldset>` : "";
      if (!p) return;
      const idx = S.sel, upd = () => { p.name = $("#ga-p-n").value; p.risk = $("#ga-p-r").value; p.control = $("#ga-p-c").value; const m = $(`.ga-pt[data-i="${idx}"]`); if (m) m.setAttribute("aria-label", `Titik ${idx + 1}: ${p.name || "tanpa nama"}`); const li = $(`.ga-li[data-i="${idx}"]`); if (li) li.textContent = lblOf(p, idx); };
      $("#ga-p-n").addEventListener("input", upd); $("#ga-p-r").addEventListener("input", upd); $("#ga-p-c").addEventListener("input", upd);
      const setR = v => { p.r = clamp(rd(+v || 1), 1, 50); const m = $(`.ga-pt[data-i="${idx}"]`); if (m) m.style.width = p.r * 2 + "%"; $("#ga-p-rs").value = Math.min(30, p.r); $("#ga-p-rn").value = p.r; };
      $("#ga-p-rs").addEventListener("input", e => setR(e.target.value)); $("#ga-p-rn").addEventListener("input", e => { if (e.target.value !== "") setR(e.target.value); });
      $("#ga-p-del").addEventListener("click", () => { S.points.splice(idx, 1); S.sel = Math.min(idx, S.points.length - 1); paint(); });
    }
    const paint = () => { paintPts(); paintList(); paintForm(); };
    const pos = e => { const r = box.getBoundingClientRect(); return { x: rd(clamp((e.clientX - r.left) / r.width * 100, 0, 100)), y: rd(clamp((e.clientY - r.top) / r.height * 100, 0, 100)) }; };
    const add = (x, y) => { S.points.push({ x, y, r: 6, name: "", risk: "", control: "" }); S.sel = S.points.length - 1; paint(); const n = $("#ga-p-n"); if (n) n.focus(); };
    box.addEventListener("click", e => { if (justDragged) { justDragged = false; return; } if (e.target.closest(".ga-pt")) return; const p = pos(e); add(p.x, p.y); });
    box.addEventListener("pointerdown", e => {
      const b = e.target.closest(".ga-pt"); if (!b) return; S.sel = +b.dataset.i; const idx = S.sel; dragging = false;
      const startX = e.clientX, startY = e.clientY, move = ev => { if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return; dragging = true; const p = pos(ev); S.points[idx].x = p.x; S.points[idx].y = p.y; b.style.left = p.x + "%"; b.style.top = p.y + "%"; };
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); if (dragging) { justDragged = true; setTimeout(() => { justDragged = false; }, 0); } paint(); const nb = $(`.ga-pt[data-i="${idx}"]`); if (nb) nb.focus(); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); e.preventDefault();
    });
    box.addEventListener("keydown", e => {
      const b = e.target.closest(".ga-pt"); if (!b) return; const p = S.points[+b.dataset.i], st = e.shiftKey ? 2 : 0.5, d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
      if (d) { e.preventDefault(); p.x = rd(clamp(p.x + d[0], 0, 100)); p.y = rd(clamp(p.y + d[1], 0, 100)); b.style.left = p.x + "%"; b.style.top = p.y + "%"; }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); S.points.splice(+b.dataset.i, 1); S.sel = Math.min(S.sel, S.points.length - 1); paint(); }
    });
    box.addEventListener("focusin", e => {
      const b = e.target.closest(".ga-pt"); if (!b || S.sel === +b.dataset.i) return;
      S.sel = +b.dataset.i; $$(".ga-pt").forEach(x => x.classList.toggle("on", +x.dataset.i === S.sel)); paintList(); paintForm();
    });
    $("#ga-sc-list").addEventListener("click", e => { const b = e.target.closest(".ga-li"); if (b) { S.sel = +b.dataset.i; paint(); } });
    $("#ga-sc-addc").addEventListener("click", () => add(50, 50));
    $("#ga-sc-title").addEventListener("input", e => { S.title = e.target.value; }); $("#ga-sc-prompt").addEventListener("input", e => { S.prompt = e.target.value; });
    $("#ga-sc-file").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; const m = $("#ga-sc-msg"); try { const img = await shrink(f, 1600, "photo"); S.img = img; S.url = URL.createObjectURL(img.blob); S.w = img.w; S.h = img.h; box.style.aspectRatio = `${S.w}/${S.h}`; $("img", box).src = S.url; m.className = "msg show info"; m.textContent = "Foto diganti. Periksa lagi posisi titik karena bentuk foto bisa berbeda."; } catch (err) { m.className = "msg show err"; m.textContent = err.message; e.target.value = ""; } });
    $("#ga-sc-x").addEventListener("click", () => { SC = null; A.redraw(); });
    $("#ga-sc-save").addEventListener("click", async () => {
      const m = $("#ga-sc-msg"), btn = $("#ga-sc-save"), title = S.title.trim();
      const fail = t => { m.className = "msg show err"; m.textContent = t; };
      if (!title) return fail("Judul foto wajib diisi.");
      if (!S.points.length) return fail("Tambahkan minimal 1 titik bahaya dengan mengklik foto.");
      const bad = S.points.findIndex(p => !String(p.name).trim()); if (bad >= 0) { S.sel = bad; paint(); return fail(`Titik ${bad + 1} belum diberi nama bahaya.`); }
      btn.disabled = true; btn.textContent = "Menyimpan...";
      try {
        const url = S.img ? await upload(S.img, "scenes", title) : S.url;
        await A.rpc("game_admin_save_item", { p_kind: "scene", p_id: S.id, p_data: { title, prompt: S.prompt.trim(), image: url, img_w: S.w, img_h: S.h, points: S.points.map(p => ({ x: p.x, y: p.y, r: p.r, name: String(p.name).trim(), risk: String(p.risk).trim(), control: String(p.control).trim() })) } });
        SC = null; A.note("ok", "Foto bahaya disimpan sebagai draf. Klik Terbitkan agar berlaku bagi pemain."); await A.redraw();
      } catch (err) { fail(err.message); btn.disabled = false; btn.textContent = "Simpan sebagai draf"; }
    });
    paint();
    const top = $(".ga-sceneed"); if (top && top.scrollIntoView) top.scrollIntoView({ block: "start" });   // foto langsung terlihat penuh saat editor dibuka
  }


  /* =====================================================================
     DASBOR MANAJEMEN: KPI, per level, per departemen, topik sering salah, peringkat lengkap, ekspor Excel, cetak
     ===================================================================== */
  let DASH = { mode: "week", week: null, month: null }, DATA = null, ME = null;
  const num = v => v == null ? "-" : Number(v).toLocaleString("id-ID", { maximumFractionDigits: 1 });
  const mLabel = iso => new Date(iso + "T00:00:00Z").toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
  const addD = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const addM = (iso, n) => { const d = new Date(iso.slice(0, 7) + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
  const isoWeek = iso => { const t = new Date(iso + "T00:00:00Z"), dd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dd); const y = t.getUTCFullYear(); return [y, Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)]; };
  const wLabel = w => { const [y, n] = isoWeek(w), e = addD(w, 6); return `Minggu ${n}, ${y} (${new Date(w + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" })} - ${new Date(e + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })})`; };
  const fmtDur = ms => { if (ms == null) return "-"; const s = Math.round(ms / 1000), m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)} j ${m % 60} m` : `${m}:${String(s % 60).padStart(2, "0")}`; };
  const LNAMES = { 1: "Teka-teki silang", 2: "Tebak rambu", 3: "Pilihan ganda", 4: "Tebak bahaya" };
  const periodLabel = () => DASH.mode === "all" ? "Semua waktu" : DASH.mode === "month" ? mLabel(DASH.month) : wLabel(DASH.week);
  async function dashboard(body) {
    if (!ME) ME = await A.rpc("game_my_status");
    DASH.week = DASH.week || ME.week; DASH.month = DASH.month || (ME.today || ME.week).slice(0, 7) + "-01";
    const weeks = Array.from({ length: 12 }, (_, i) => addD(ME.week, -7 * i)), months = Array.from({ length: 12 }, (_, i) => addM(DASH.month && ME.today ? ME.today : ME.week, -i));
    body.innerHTML = `<div class="ga-dtools no-print">
        <div class="ga-seg" role="group" aria-label="Periode dasbor">${[["week", "Mingguan"], ["month", "Bulanan"], ["all", "Semua waktu"]].map(m => `<button type="button" data-m="${m[0]}" aria-pressed="${DASH.mode === m[0]}">${m[1]}</button>`).join("")}</div>
        <label class="sr" for="ga-d-w">Pilih minggu</label><select id="ga-d-w" ${DASH.mode === "week" ? "" : "hidden"}>${weeks.map(w => `<option value="${w}"${w === DASH.week ? " selected" : ""}>${A.esc(wLabel(w))}</option>`).join("")}</select>
        <label class="sr" for="ga-d-m">Pilih bulan</label><select id="ga-d-m" ${DASH.mode === "month" ? "" : "hidden"}>${months.map(m => `<option value="${m}"${m === DASH.month ? " selected" : ""}>${A.esc(mLabel(m))}</option>`).join("")}</select>
        <span class="ga-spacer"></span><button type="button" class="btn ghost sm" id="ga-d-print">Cetak</button><button type="button" class="btn sm" id="ga-d-xls">Ekspor Excel</button></div>
      <div id="ga-d-body"><p class="empty">Memuat dasbor...</p></div>`;
    $$(".ga-seg [data-m]", body).forEach(b => b.addEventListener("click", () => { DASH.mode = b.dataset.m; dashboard(body).catch(e => A.note("err", e.message)); }));
    $("#ga-d-w").addEventListener("change", e => { DASH.week = e.target.value; loadDash(); });
    $("#ga-d-m").addEventListener("change", e => { DASH.month = e.target.value; loadDash(); });
    $("#ga-d-print").addEventListener("click", () => window.print());
    $("#ga-d-xls").addEventListener("click", exportXlsx);
    await loadDash();
  }
  async function loadDash() {
    const box = $("#ga-d-body"); if (!box) return;
    try { DATA = await A.rpc("game_admin_dashboard", { p_week: DASH.mode === "week" ? DASH.week : null, p_month: DASH.mode === "month" ? DASH.month : null, p_all: DASH.mode === "all" }); }
    catch (e) { box.innerHTML = `<p class="warnbox">${A.esc(e.message)}</p>`; return; }
    const D = DATA, esc = A.esc, bar = (v, cls) => `<span class="ga-bar ${cls || ""}" role="img" aria-label="${num(v)} persen"><i style="width:${Math.max(0, Math.min(100, Number(v) || 0))}%"></i></span>`;
    const lv = (D.active_levels || []).slice().sort();
    box.innerHTML = `<h3 class="ga-dtitle">Periode: ${esc(periodLabel())}</h3>
      <div class="ga-kpis">
        <div class="ga-kpi"><small>Peserta aktif</small><b>${D.active}<span> dari ${D.registered}</span></b><em>${num(D.active_pct)}% dari akun terdaftar</em></div>
        <div class="ga-kpi"><small>Rata-rata skor</small><b>${num(D.avg_score)}</b><em>skor terbaik tiap pemain per level</em></div>
        <div class="ga-kpi"><small>Lulus semua level</small><b>${D.all_passed}</b><em>dari ${lv.length} level aktif</em></div>
        <div class="ga-kpi"><small>Skor tertinggi</small><b>${num(D.top_score)}</b><em>total skor lulus</em></div>
        <div class="ga-kpi"><small>Level aktif</small><b>${lv.length}</b><em>${lv.map(n => "L" + n).join(", ")}</em></div></div>
      <div class="ga-dgrid">
        <section class="ga-dcard" aria-labelledby="ga-d-h1"><h3 id="ga-d-h1">Penyelesaian per level</h3>
          <div class="ga-scroll" tabindex="0" role="region" aria-label="Penyelesaian per level"><table class="tbl"><thead><tr><th>Level</th><th>Pemain</th><th>Percobaan</th><th>Lulus</th><th>Tingkat lulus</th><th>Rata-rata</th></tr></thead><tbody>
          ${D.levels.map(x => `<tr><td>${x.level}. ${esc(LNAMES[x.level] || "")}</td><td>${x.players}</td><td>${x.attempts}</td><td>${x.passed}</td><td>${bar(x.pass_rate)} ${num(x.pass_rate)}%</td><td>${num(x.avg_score)}</td></tr>`).join("") || '<tr><td colspan="6" class="empty">Tidak ada level aktif.</td></tr>'}</tbody></table></div></section>
        <section class="ga-dcard" aria-labelledby="ga-d-h2"><h3 id="ga-d-h2">Rata-rata skor per departemen</h3>
          <div class="ga-scroll" tabindex="0" role="region" aria-label="Rata-rata skor per departemen"><table class="tbl"><thead><tr><th>Departemen</th><th>Peserta</th><th>Partisipasi</th><th>Rata-rata skor</th></tr></thead><tbody>
          ${D.departments.map(x => `<tr><td>${esc(x.department)}</td><td>${x.players} dari ${x.registered}</td><td>${num(x.participation)}%</td><td>${x.avg_score == null ? "-" : bar(x.avg_score, "teal") + " " + num(x.avg_score)}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">Belum ada akun.</td></tr>'}</tbody></table></div></section></div>
      <section class="ga-dcard" aria-labelledby="ga-d-h3"><h3 id="ga-d-h3">5 topik paling sering salah</h3>
        ${D.wrong.length ? `<ol class="ga-wrong">${D.wrong.map(w => `<li><span class="chip">L${w.level} ${esc(LNAMES[w.level] || "")}</span> ${esc(w.label)} <strong>${w.times}x salah</strong></li>`).join("")}</ol>` : '<p class="empty">Belum ada jawaban salah pada periode ini.</p>'}</section>
      <section class="ga-dcard" aria-labelledby="ga-d-h4"><h3 id="ga-d-h4">Peringkat lengkap</h3>
        <div class="ga-scroll" tabindex="0" role="region" aria-label="Peringkat lengkap"><table class="tbl"><thead><tr><th>#</th><th>Nama</th><th>NIK</th><th>Departemen</th><th>Lulus</th>${lv.map(n => `<th>L${n}</th>`).join("")}<th>Total</th><th>Waktu</th></tr></thead><tbody>
        ${D.ranking.map(r => `<tr><td>${r.rank}</td><td>${esc(r.name)}</td><td>${esc(r.nik || "-")}</td><td>${esc(r.department || "-")}</td><td>${r.passed_levels}</td>${lv.map(n => `<td>${num(r["s" + n])}</td>`).join("")}<td><strong>${num(r.total)}</strong></td><td>${fmtDur(r.time_ms)}</td></tr>`).join("") || `<tr><td colspan="${7 + lv.length}" class="empty">Belum ada skor lulus pada periode ini.</td></tr>`}</tbody></table></div></section>`;
  }
  function exportXlsx() {
    if (!DATA) return A.note("err", "Dasbor belum termuat.");
    const D = DATA, lv = (D.active_levels || []).slice().sort(), today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const sheets = [
      { name: "Ringkasan", rows: [["Dasbor SHEGAMES", ""], ["Periode", periodLabel()], ["Dibuat pada", today], ["", ""], ["Akun terdaftar", D.registered], ["Peserta aktif", D.active], ["Persentase peserta aktif", D.active_pct], ["Rata-rata skor", D.avg_score == null ? "-" : D.avg_score], ["Lulus semua level aktif", D.all_passed], ["Skor tertinggi", D.top_score == null ? "-" : D.top_score], ["Level aktif", lv.map(n => n + ". " + LNAMES[n]).join(", ")]] },
      { name: "Peringkat", rows: [["Peringkat", "Nama", "NIK", "Departemen", "Level lulus"].concat(lv.map(n => "Skor L" + n), ["Total skor", "Waktu (detik)"])].concat(D.ranking.map(r => [r.rank, r.name, r.nik || "", r.department || "", r.passed_levels].concat(lv.map(n => r["s" + n] == null ? "" : Number(r["s" + n])), [Number(r.total), Math.round((r.time_ms || 0) / 1000)]))) },
      { name: "Per departemen", rows: [["Departemen", "Akun terdaftar", "Peserta aktif", "Partisipasi (%)", "Rata-rata skor"]].concat(D.departments.map(x => [x.department, x.registered, x.players, Number(x.participation), x.avg_score == null ? "" : Number(x.avg_score)])) },
      { name: "Per level", rows: [["Level", "Nama level", "Pemain", "Percobaan", "Lulus", "Tingkat lulus (%)", "Rata-rata skor"]].concat(D.levels.map(x => [x.level, LNAMES[x.level] || "", x.players, x.attempts, x.passed, Number(x.pass_rate), x.avg_score == null ? "" : Number(x.avg_score)])) },
      { name: "Topik sering salah", rows: [["No", "Level", "Butir", "Jumlah salah"]].concat(D.wrong.map((w, i) => [i + 1, w.level + ". " + (LNAMES[w.level] || ""), w.label, w.times])) }
    ];
    const u8 = window.GamesParse.makeXlsxMulti(sheets), a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([u8], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.download = "dasbor-shegames-" + (DASH.mode === "all" ? "semua-waktu" : DASH.mode === "month" ? DASH.month.slice(0, 7) : DASH.week) + ".xlsx";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    A.note("ok", "Berkas Excel dibuat (5 lembar: Ringkasan, Peringkat, Per departemen, Per level, Topik sering salah).");
  }

  window.GamesAdmin2 = { draw: (tab, api) => { if (tab !== lastTab) reset(); lastTab = tab; return origDraw(tab, api); }, reset };
  let lastTab = "";
})();
