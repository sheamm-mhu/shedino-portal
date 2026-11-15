/* SHEGAMES di panel admin: pengaturan, bank soal (termasuk impor dokumen), peserta dan skor, terbitkan.
   Semua perubahan soal disimpan sebagai DRAF dan baru berlaku setelah tombol Terbitkan. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LET = "ABCDE";
  const BUILT = { 1: false, 2: false, 3: true, 4: false };
  const LNAME = { 1: "Teka-teki silang JSA", 2: "Tebak rambu", 3: "Pilihan ganda", 4: "Tebak bahaya" };
  let panel = null, tab = "set", S = null, QS = [], IMPORT = null;

  function friendly(m) {
    m = String(m || "");
    if (/Could not find the function|does not exist|schema cache|PGRST202|42883|42P01/i.test(m)) return "Fitur SHEGAMES di database belum lengkap. Jalankan seluruh isi supabase/games.sql di Supabase (SQL Editor), lalu muat ulang halaman ini.";
    if (/permission denied|row-level security/i.test(m)) return "Akun ini tidak punya izin. Pastikan Anda masuk sebagai admin dan supabase/games.sql sudah dijalankan.";
    if (/violates check constraint/i.test(m)) return "Ada nilai di luar batas yang diizinkan. Periksa lagi angka yang diisi.";
    if (/fetch|network/i.test(m)) return "Gagal terhubung ke server. Periksa koneksi internet Anda.";
    return m || "Terjadi kesalahan. Coba lagi.";
  }
  async function rpc(fn, args) {
    const r = await Auth.client.rpc(fn, args || {});
    if (r.error) throw new Error(friendly(r.error.message));
    return r.data;
  }
  function note(kind, text) {
    const m = $("#ga-msg"); if (!m) return;
    m.className = "msg show " + kind; m.textContent = text;
    if (kind === "ok") setTimeout(() => { if (m.textContent === text) m.className = "msg"; }, 6000);
  }

  /* ---------- Kerangka ---------- */
  async function show() {
    panel = $("#games-panel");
    panel.innerHTML = `
      <div class="ga">
        <div class="ga-pub">
          <div><strong>SHEGAMES</strong><span id="ga-pending" class="ga-pend">Memeriksa perubahan...</span></div>
          <div class="ga-pubact"><a class="btn ghost sm" href="shegames.html" target="_blank" rel="noopener">Buka SHEGAMES</a><button type="button" class="btn ghost sm" id="ga-discard">Batalkan perubahan</button><button type="button" class="btn sm" id="ga-publish">Terbitkan</button></div>
        </div>
        <div id="ga-msg" class="msg" role="status" aria-live="polite"></div>
        <div class="ga-tabs" role="tablist" aria-label="Bagian SHEGAMES">
          <button type="button" role="tab" data-g="set">Pengaturan</button>
          <button type="button" role="tab" data-g="q">Soal pilihan ganda</button>
          <button type="button" role="tab" data-g="people">Peserta &amp; skor</button>
        </div>
        <div id="ga-body"></div>
      </div>`;
    $(".ga-tabs").addEventListener("click", e => { const b = e.target.closest("[data-g]"); if (b) { tab = b.dataset.g; IMPORT = null; draw(); } });
    $("#ga-publish").addEventListener("click", publish);
    $("#ga-discard").addEventListener("click", discard);
    await draw();
  }
  async function pending() {
    const el = $("#ga-pending"); if (!el) return;
    try {
      const p = await rpc("game_admin_pending");
      const parts = [["questions", "soal"], ["words", "kata TTS"], ["signs", "rambu"], ["scenes", "foto bahaya"]].filter(x => p[x[0]] > 0).map(x => `${p[x[0]]} ${x[1]}`);
      el.textContent = p.total ? `${p.total} perubahan belum diterbitkan (${parts.join(", ")})` : "Semua perubahan sudah diterbitkan";
      el.classList.toggle("has", p.total > 0);
      $("#ga-publish").disabled = !p.total; $("#ga-discard").disabled = !p.total;
    } catch (e) { el.textContent = e.message; }
  }
  async function draw() {
    $$(".ga-tabs [data-g]").forEach(b => b.setAttribute("aria-selected", b.dataset.g === tab));
    const body = $("#ga-body"); body.innerHTML = '<p class="empty">Memuat...</p>';
    pending();
    try {
      if (tab === "set") await drawSettings();
      else if (tab === "q") await drawQuestions();
      else await drawPeople();
    } catch (e) { body.innerHTML = `<p class="warnbox">${esc(e.message)}</p>`; }
  }
  async function publish() {
    const b = $("#ga-publish"); b.disabled = true; b.textContent = "Menerbitkan...";
    try {
      const r = await rpc("game_publish");
      note("ok", `Diterbitkan. Sekarang tayang: ${r.questions} soal pilihan ganda, ${r.words} kata TTS, ${r.signs} rambu, ${r.scenes} foto bahaya.`);
    } catch (e) { note("err", e.message); }
    b.textContent = "Terbitkan";
    await draw();
  }
  async function discard() {
    if (!window.confirm("Batalkan semua perubahan yang belum diterbitkan? Draf baru dihapus dan soal yang tayang kembali seperti semula.")) return;
    try { await rpc("game_admin_discard"); note("ok", "Semua perubahan yang belum diterbitkan dibatalkan."); } catch (e) { note("err", e.message); }
    await draw();
  }

  /* ---------- Pengaturan ---------- */
  async function drawSettings() {
    const r = await Auth.client.from("game_settings").select("*").eq("id", 1).maybeSingle();
    if (r.error) throw new Error(friendly(r.error.message));
    if (!r.data) throw new Error(friendly("does not exist"));
    S = r.data;
    const num = (k, label, min, max, help) => `<label>${label}<input type="number" inputmode="numeric" data-s="${k}" value="${esc(S[k])}" min="${min}" max="${max}" step="1">${help ? `<span class="fhelp">${help}</span>` : ""}</label>`;
    $("#ga-body").innerHTML = `
      <form id="ga-set" class="ga-form" novalidate>
        <h3>Umum</h3>
        <div class="frow">
          <label>Nama perusahaan<input data-s="company" value="${esc(S.company)}" maxlength="120"></label>
          <label>Zona waktu minggu dan bulan<select data-s="tz">${[["Asia/Jakarta", "WIB (Asia/Jakarta)"], ["Asia/Makassar", "WITA (Asia/Makassar)"], ["Asia/Jayapura", "WIT (Asia/Jayapura)"]].map(z => `<option value="${z[0]}"${S.tz === z[0] ? " selected" : ""}>${z[1]}</option>`).join("")}</select></label>
        </div>
        <label>Daftar departemen (satu per baris)<textarea data-s="departments" rows="5" placeholder="Produksi&#10;Plant">${esc((S.departments || []).join("\n"))}</textarea><span class="fhelp">Dipakai pemain saat memilih departemen dan untuk filter peringkat. Kosongkan agar pemain bebas mengisi.</span></label>
        <h3>Level aktif</h3>
        <div class="ga-levels">${[1, 2, 3, 4].map(n => `<label class="fchk"><input type="checkbox" data-lv="${n}"${(S.active_levels || []).includes(n) ? " checked" : ""}${BUILT[n] ? "" : " disabled"}> Level ${n}: ${LNAME[n]}${BUILT[n] ? "" : " <em>(segera hadir)</em>"}</label>`).join("")}</div>
        <h3>Aturan main</h3>
        <div class="frow">${num("pass_score", "Nilai lulus", 0, 100, "0 sampai 100.")}${num("max_attempts", "Batas percobaan per level per minggu", 0, 999, "0 berarti tanpa batas.")}</div>
        <div class="frow">
          <label>Urutan level<select data-s="sequential"><option value="true"${S.sequential ? " selected" : ""}>Berurutan (lulus level sebelumnya dulu)</option><option value="false"${S.sequential ? "" : " selected"}>Bebas (semua level terbuka)</option></select></label>
          <label>Dasar peringkat<select data-s="rank_basis"><option value="score"${S.rank_basis === "score" ? " selected" : ""}>Total skor, lalu level tertinggi</option><option value="level"${S.rank_basis === "level" ? " selected" : ""}>Level tertinggi, lalu total skor</option></select></label>
        </div>
        <div class="frow">
          <label>Bila masih seri<select data-s="tiebreak"><option value="fast"${S.tiebreak === "fast" ? " selected" : ""}>Waktu tercepat di atas</option><option value="slow"${S.tiebreak === "slow" ? " selected" : ""}>Waktu terlama di atas</option></select></label>
          ${num("q_count", "Jumlah soal per permainan", 1, 100, "Untuk tebak rambu dan pilihan ganda.")}
        </div>
        <h3>Waktu dan penalti</h3>
        <div class="frow">${num("timer_mcq", "Waktu per soal pilihan ganda (detik)", 0, 600, "0 berarti tanpa batas waktu.")}${num("timer_sign", "Waktu per soal tebak rambu (detik)", 0, 600, "0 berarti tanpa batas waktu.")}</div>
        <div class="frow">${num("hazard_time", "Batas waktu tebak bahaya (detik)", 0, 3600, "0 berarti tanpa batas waktu.")}${num("tap_penalty", "Penalti salah ketuk (poin)", 0, 100)}</div>
        <div class="frow">${num("hint_max", "Maksimal bantuan huruf TTS", 0, 20)}${num("hint_penalty", "Penalti per bantuan huruf (poin)", 0, 100)}</div>
        <div class="ga-foot"><button type="submit" class="btn" id="ga-set-save">Simpan pengaturan</button><span class="fhelp">Pengaturan langsung berlaku (tidak perlu Terbitkan).</span></div>
      </form>`;
    $("#ga-set").addEventListener("submit", saveSettings);
  }
  async function saveSettings(e) {
    e.preventDefault();
    const f = $("#ga-set"), v = k => $(`[data-s="${k}"]`, f).value;
    const upd = { company: v("company").trim().slice(0, 120), tz: v("tz"), sequential: v("sequential") === "true", rank_basis: v("rank_basis"), tiebreak: v("tiebreak"), updated_at: new Date().toISOString() };
    const seen = new Set();
    upd.departments = v("departments").split(/\r?\n/).map(x => x.trim().slice(0, 60)).filter(x => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()));
    upd.active_levels = $$("[data-lv]", f).filter(c => c.checked).map(c => +c.dataset.lv);
    if (!upd.active_levels.length) return note("err", "Pilih minimal satu level aktif.");
    for (const k of ["pass_score", "max_attempts", "q_count", "timer_mcq", "timer_sign", "hazard_time", "tap_penalty", "hint_max", "hint_penalty"]) {
      const el = $(`[data-s="${k}"]`, f), n = Number(el.value);
      if (el.value.trim() === "" || !Number.isInteger(n) || n < +el.min || n > +el.max) { el.focus(); return note("err", `"${el.closest("label").childNodes[0].textContent.trim()}" harus bilangan bulat ${el.min} sampai ${el.max}.`); }
      upd[k] = n;
    }
    const b = $("#ga-set-save"); b.disabled = true;
    const r = await Auth.client.from("game_settings").update(upd).eq("id", 1).select("id");
    b.disabled = false;
    if (r.error) return note("err", friendly(r.error.message));
    if (!r.data || !r.data.length) return note("err", friendly("permission denied"));
    note("ok", "Pengaturan SHEGAMES tersimpan.");
  }

  /* ---------- Soal pilihan ganda ---------- */
  const viewOf = q => (q.pending_op === "edit" && q.pending) ? { q: q.pending.q, opts: q.pending.opts, key: q.pending.key, expl: q.pending.expl } : { q: q.q, opts: q.opts, key: q.key, expl: q.expl };
  function status(q) {
    if (!q.live) return '<span class="chip pending">Draf baru</span>';
    if (q.pending_op === "edit") return '<span class="chip pending">Diubah, belum terbit</span>';
    if (q.pending_op === "delete") return '<span class="chip rejected">Akan dihapus</span>';
    return '<span class="chip approved">Tayang</span>';
  }
  async function drawQuestions() {
    if (IMPORT) return drawImport();
    const r = await Auth.client.from("game_questions").select("*").order("created_at", { ascending: true });
    if (r.error) throw new Error(friendly(r.error.message));
    QS = r.data || [];
    const live = QS.filter(q => q.live && q.pending_op !== "delete").length;
    $("#ga-body").innerHTML = `
      <div class="tools ga-tools">
        <button type="button" class="btn sm" id="ga-q-add">Tambah soal</button>
        <label class="btn ghost sm ga-file">Impor dari dokumen<input type="file" id="ga-q-file" accept=".docx,.xlsx,.csv,.pdf,.txt" class="sr"></label>
        <button type="button" class="btn ghost sm" id="ga-q-tpl">Unduh templat Excel</button>
        <input type="search" id="ga-q-s" placeholder="Cari soal" aria-label="Cari soal">
      </div>
      <p class="fhelp">Berkas yang didukung: Word (.docx), Excel (.xlsx), CSV, PDF berisi teks, dan TXT. Berkas dibaca di komputer Anda, tidak diunggah. Total ${QS.length} soal, ${live} akan tayang setelah diterbitkan. Minimal 3 soal.</p>
      <p id="ga-q-st" class="upst" role="status"></p>
      <div class="ga-scroll" tabindex="0" role="region" aria-label="Daftar soal pilihan ganda"><table class="tbl" id="ga-q-tbl"><thead><tr><th>Soal</th><th>Kunci</th><th>Status</th><th>Aksi</th></tr></thead><tbody></tbody></table></div>`;
    const fill = () => {
      const s = $("#ga-q-s").value.trim().toLowerCase();
      const rows = QS.filter(q => !s || viewOf(q).q.toLowerCase().includes(s));
      $("#ga-q-tbl tbody").innerHTML = rows.map(q => { const v = viewOf(q); return `<tr data-id="${esc(q.id)}"${q.pending_op === "delete" ? ' class="ga-del"' : ""}>
        <td><strong>${esc(v.q)}</strong><div class="ga-opts">${v.opts.map((o, i) => `<span${i === v.key ? ' class="k"' : ""}>${LET[i]}. ${esc(o)}</span>`).join("")}</div></td>
        <td>${LET[v.key] || "-"}</td><td>${status(q)}</td>
        <td class="acts">${q.pending_op === "delete" ? `<button type="button" class="btn ghost sm" data-act="restore">Pulihkan</button>` : `<button type="button" class="btn ghost sm" data-act="edit">Ubah</button><button type="button" class="btn ghost sm" data-act="del">Hapus</button>`}</td></tr>`; }).join("") || `<tr><td colspan="4" class="empty">${QS.length ? "Tidak ada soal yang cocok." : "Belum ada soal. Tambah satu per satu atau impor dari dokumen."}</td></tr>`;
    };
    fill();
    $("#ga-q-s").addEventListener("input", fill);
    $("#ga-q-add").addEventListener("click", () => editDialog(null));
    $("#ga-q-tpl").addEventListener("click", template);
    $("#ga-q-file").addEventListener("change", onFile);
    $("#ga-q-tbl").addEventListener("click", async e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const q = QS.find(x => x.id === b.closest("tr").dataset.id); if (!q) return;
      try {
        if (b.dataset.act === "edit") return editDialog(q);
        if (b.dataset.act === "del") { if (!window.confirm("Hapus soal ini? Soal yang sudah tayang baru hilang setelah Terbitkan.")) return; await rpc("game_admin_delete_item", { p_kind: "question", p_id: q.id }); }
        if (b.dataset.act === "restore") await rpc("game_admin_save_item", { p_kind: "question", p_id: q.id, p_data: { q: q.q, opts: q.opts, key: q.key, expl: q.expl } });
        await draw();
      } catch (err) { note("err", err.message); }
    });
  }
  function template() {
    const u8 = window.GamesParse.makeXlsx(window.GamesParse.TEMPLATE, "Soal");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([u8], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.download = "templat-soal-shegames.xlsx"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* Editor satu soal (dipakai untuk tambah, ubah, dan tiap butir pratinjau impor) */
  function itemFields(it, idx) {
    const opts = it.opts.length ? it.opts : ["", ""];
    return `<label>Soal<textarea class="iq" rows="2" maxlength="500">${esc(it.q)}</textarea></label>
      <div class="ga-optlist">${opts.map((o, i) => `<div class="ga-opt"><label class="ga-key"><input type="radio" name="key-${idx}" value="${i}"${it.key === i ? " checked" : ""}><span>${LET[i]}</span><span class="sr">Jadikan kunci jawaban</span></label><input class="io" value="${esc(o)}" maxlength="200" aria-label="Pilihan ${LET[i]}"><button type="button" class="btn ghost sm" data-rmopt aria-label="Hapus pilihan ${LET[i]}"${opts.length <= 2 ? " disabled" : ""}>&times;</button></div>`).join("")}</div>
      <button type="button" class="linkbtn" data-addopt${opts.length >= 5 ? " hidden" : ""}>+ Tambah pilihan</button>
      <label>Penjelasan (tampil setelah pemain menjawab)<textarea class="ie" rows="2" maxlength="600">${esc(it.expl)}</textarea></label>`;
  }
  function readItem(box) {
    const key = $('input[type=radio]:checked', box);
    return { q: $(".iq", box).value.trim(), opts: $$(".io", box).map(i => i.value.trim()), key: key ? +key.value : null, expl: $(".ie", box).value.trim() };
  }
  function wireItem(box, idx, onChange) {
    box.addEventListener("click", e => {
      if (e.target.closest("[data-addopt]")) { const it = readItem(box); it.opts.push(""); box.querySelector(".ga-fields").innerHTML = itemFields(it, idx); onChange(); }
      const rm = e.target.closest("[data-rmopt]");
      if (rm) { const it = readItem(box), i = $$("[data-rmopt]", box).indexOf(rm); it.opts.splice(i, 1); if (it.key === i) it.key = null; else if (it.key > i) it.key -= 1; box.querySelector(".ga-fields").innerHTML = itemFields(it, idx); onChange(); }
    });
    box.addEventListener("input", onChange); box.addEventListener("change", onChange);
  }
  function editDialog(q) {
    let d = $("#ga-dlg");
    if (!d) { d = document.createElement("dialog"); d.id = "ga-dlg"; d.className = "cdlg"; d.setAttribute("aria-label", "Formulir soal"); document.body.appendChild(d); }
    const it = q ? viewOf(q) : { q: "", opts: ["", "", "", ""], key: null, expl: "" };
    d.innerHTML = `<form id="ga-qf" novalidate><div class="chead"><h2>${q ? "Ubah soal" : "Tambah soal"}</h2></div><div class="ga-fields">${itemFields(it, "dlg")}</div>
      <p class="msg" id="ga-qf-msg" role="alert"></p><div class="foot"><button type="button" class="btn ghost" id="ga-qf-x">Batal</button><button type="submit" class="btn">Simpan sebagai draf</button></div></form>`;
    const f = $("#ga-qf"); wireItem(f, "dlg", () => {});
    const close = () => { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); };
    $("#ga-qf-x").addEventListener("click", close);
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const v = readItem(f), probs = window.GamesParse.validate(v), m = $("#ga-qf-msg");
      if (probs.length) { m.className = "msg show err"; m.textContent = probs.join(". ") + "."; return; }
      try { await rpc("game_admin_save_item", { p_kind: "question", p_id: q ? q.id : null, p_data: v }); close(); note("ok", "Soal disimpan sebagai draf. Klik Terbitkan agar berlaku bagi pemain."); await draw(); }
      catch (err) { m.className = "msg show err"; m.textContent = err.message; }
    });
    if (typeof d.showModal === "function") d.showModal(); else { d.classList.add("polyfill"); d.setAttribute("open", ""); }
    setTimeout(() => $(".iq", d).focus(), 30);
  }

  /* ---------- Impor dokumen: baca, urai, pratinjau yang bisa diedit ---------- */
  async function onFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const st = $("#ga-q-st"); st.className = "upst"; st.textContent = `Membaca ${file.name}...`;
    try {
      const doc = await window.GamesParse.readFile(file);
      const items = window.GamesParse.parseQuestions(doc);
      if (!items.length) throw new Error("Tidak ada soal yang dikenali di berkas ini. Pakai format \"1. Soal / A. ... / B. ... / Jawaban: B\" atau tabel berkolom Soal, A, B, C, D, Jawaban, Penjelasan. Unduh templat Excel untuk contoh.");
      IMPORT = { name: file.name, items: items.slice(0, 300), mode: "add", cut: items.length > 300 };
      drawImport();
    } catch (err) { st.className = "upst err"; st.textContent = err.message || "Berkas tidak dapat dibaca."; }
    e.target.value = "";
  }
  function drawImport() {
    const V = window.GamesParse.validate, body = $("#ga-body");
    body.innerHTML = `
      <div class="ga-imp-head">
        <h3>Pratinjau impor: ${esc(IMPORT.name)}</h3>
        <p id="ga-imp-sum" class="fhelp" role="status"></p>
        ${IMPORT.cut ? '<p class="warnbox">Hanya 300 soal pertama yang ditampilkan.</p>' : ""}
        <fieldset class="ga-mode"><legend>Cara menyimpan</legend>
          <label class="fchk"><input type="radio" name="ga-mode" value="add"${IMPORT.mode === "add" ? " checked" : ""}> Tambahkan ke soal yang sudah ada</label>
          <label class="fchk"><input type="radio" name="ga-mode" value="replace"${IMPORT.mode === "replace" ? " checked" : ""}> Ganti semua soal yang ada dengan soal ini</label>
        </fieldset>
      </div>
      <div id="ga-imp-list">${IMPORT.items.map((it, i) => `<div class="ga-item" data-i="${i}"><div class="ga-item-head"><strong>Soal ${i + 1}</strong><span class="ga-probs"></span><button type="button" class="btn ghost sm" data-drop>Buang</button></div><div class="ga-fields">${itemFields(it, i)}</div></div>`).join("")}</div>
      <p class="msg" id="ga-imp-msg" role="alert"></p>
      <div class="ga-foot"><button type="button" class="btn ghost" id="ga-imp-x">Batal impor</button><button type="button" class="btn" id="ga-imp-save">Simpan sebagai draf</button></div>`;
    const refresh = () => {
      let good = 0, badN = 0;
      $$(".ga-item", body).forEach(box => {
        const p = V(readItem(box)); box.classList.toggle("bad", p.length > 0);
        $(".ga-probs", box).innerHTML = p.map(x => `<span class="chip rejected">${esc(x)}</span>`).join("");
        if (p.length) badN++; else good++;
      });
      $("#ga-imp-sum").textContent = `${good + badN} soal terbaca: ${good} siap disimpan, ${badN} perlu diperbaiki. Periksa dan perbaiki langsung di bawah; soal yang masih bermasalah tidak ikut disimpan.`;
      const b = $("#ga-imp-save"); b.textContent = good ? `Simpan ${good} soal sebagai draf` : "Belum ada soal yang siap"; b.disabled = !good;
    };
    $$(".ga-item", body).forEach(box => wireItem(box, box.dataset.i, refresh));
    $("#ga-imp-list").addEventListener("click", e => { const d = e.target.closest("[data-drop]"); if (d) { d.closest(".ga-item").remove(); refresh(); } });
    $$('input[name="ga-mode"]', body).forEach(r => r.addEventListener("change", () => { IMPORT.mode = r.value; }));
    $("#ga-imp-x").addEventListener("click", () => { IMPORT = null; draw(); });
    $("#ga-imp-save").addEventListener("click", async () => {
      const items = $$(".ga-item", body).map(readItem).filter(it => !V(it).length), m = $("#ga-imp-msg"), b = $("#ga-imp-save");
      if (!items.length) return;
      if (IMPORT.mode === "replace" && !window.confirm(`Ganti SEMUA soal yang ada dengan ${items.length} soal ini? Perubahan baru berlaku setelah Terbitkan.`)) return;
      b.disabled = true; let done = 0;
      try {
        if (IMPORT.mode === "replace") await rpc("game_admin_clear", { p_kind: "question" });
        for (const it of items) { b.textContent = `Menyimpan ${done + 1} dari ${items.length}...`; await rpc("game_admin_save_item", { p_kind: "question", p_id: null, p_data: it }); done++; }
        IMPORT = null; note("ok", `${done} soal disimpan sebagai draf. Klik Terbitkan agar berlaku bagi pemain.`); await draw();
      } catch (err) { m.className = "msg show err"; m.textContent = `${done} soal tersimpan, lalu terhenti: ${err.message}`; b.disabled = false; pending(); }
    });
    refresh();
  }

  /* ---------- Peserta dan skor ---------- */
  async function drawPeople() {
    const rows = await rpc("game_admin_participants");
    const fmt = t => t ? new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
    $("#ga-body").innerHTML = `
      <div class="tools ga-tools"><input type="search" id="ga-p-s" placeholder="Cari nama, NIK, atau departemen" aria-label="Cari peserta">
        <button type="button" class="btn ghost sm" id="ga-r-week">Hapus skor minggu ini</button><button type="button" class="btn danger sm" id="ga-r-all">Hapus semua skor</button></div>
      <p class="fhelp">${rows.length} akun disetujui, ${rows.filter(r => r.attempts > 0).length} sudah bermain. Menghapus skor tidak menghapus akun.</p>
      <div class="ga-scroll" tabindex="0" role="region" aria-label="Daftar peserta"><table class="tbl" id="ga-p-tbl"><thead><tr><th>Nama</th><th>NIK</th><th>Departemen</th><th>Percobaan</th><th>Level lulus</th><th>Terakhir main</th><th>Aksi</th></tr></thead><tbody></tbody></table></div>`;
    const fill = () => {
      const s = $("#ga-p-s").value.trim().toLowerCase();
      $("#ga-p-tbl tbody").innerHTML = rows.filter(r => !s || [r.full_name, r.employee_id, r.department].join(" ").toLowerCase().includes(s)).map(r => `<tr data-id="${esc(r.user_id)}"><td>${esc(r.full_name || "(tanpa nama)")}</td><td>${esc(r.employee_id || "-")}</td><td>${esc(r.department || "-")}</td><td>${r.attempts}</td><td>${r.passed_levels}</td><td>${fmt(r.last_played)}</td><td class="acts"><button type="button" class="btn ghost sm" data-reset${r.attempts ? "" : " disabled"}>Hapus skor</button></td></tr>`).join("") || '<tr><td colspan="7" class="empty">Tidak ada peserta yang cocok.</td></tr>';
    };
    fill(); $("#ga-p-s").addEventListener("input", fill);
    const reset = async (scope, user, text) => {
      if (!window.confirm(text)) return;
      try { const n = await rpc("game_admin_reset_scores", { p_scope: scope, p_user: user || null }); note("ok", `${n} catatan permainan dihapus.`); await draw(); } catch (e) { note("err", e.message); }
    };
    $("#ga-r-week").addEventListener("click", () => reset("week", null, "Hapus semua skor MINGGU INI untuk semua peserta? Tindakan ini tidak bisa dibatalkan."));
    $("#ga-r-all").addEventListener("click", () => reset("all", null, "Hapus SEMUA skor seluruh peserta sepanjang waktu? Tindakan ini tidak bisa dibatalkan."));
    $("#ga-p-tbl").addEventListener("click", e => { const b = e.target.closest("[data-reset]"); if (!b) return; const tr = b.closest("tr"); reset("user", tr.dataset.id, `Hapus semua skor milik ${tr.children[0].textContent}? Tindakan ini tidak bisa dibatalkan.`); });
  }

  window.AdminGames = { show };
})();
