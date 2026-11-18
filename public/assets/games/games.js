/* SHEGAMES: lobi, permainan, peringkat. Semua penilaian dilakukan server (fungsi game_* di Supabase). */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const view = $("#g-view");
  const reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- Level ---------- */
  const LV = {
    1: { name: "Teka-teki silang JSA", desc: "Isi kotak dengan istilah K3 dari petunjuk mendatar dan menurun.", shape: "square", c: "#2563EB", built: true },
    2: { name: "Tebak rambu", desc: "Lihat rambu keselamatan, lalu pilih nama yang tepat.", shape: "triangle", c: "#D97706", built: true },
    3: { name: "Pilihan ganda", desc: "Jawab soal pengetahuan K3 dan pelajari penjelasannya.", shape: "circle", c: "#0D9488", built: true },
    4: { name: "Tebak bahaya", desc: "Temukan titik berbahaya pada foto area kerja.", shape: "octagon", c: "#E11D48", built: true }
  };
  function shape(n) {
    const c = LV[n].c, f = `style="fill:${c}"`;
    const s = {
      square: `<rect x="5" y="5" width="48" height="48" rx="11" ${f}/><path d="M16 16h8v8h-8zM26 16h8v8h-8zM36 16h6v8h-6zM16 26h8v8h-8zM26 36h8v6h-8z" fill="#fff" opacity=".95"/>`,
      triangle: `<path d="M29 5.5 54 50.5H4z" ${f} stroke-linejoin="round"/><rect x="26.8" y="20" width="4.4" height="16" rx="2.2" fill="#fff"/><circle cx="29" cy="42.5" r="2.8" fill="#fff"/>`,
      circle: `<circle cx="29" cy="29" r="25" ${f}/><path d="M22.5 23.5a6.5 6.5 0 1 1 9.3 5.9c-1.8.9-2.8 2.2-2.8 4.1v1.2" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="29" cy="42" r="2.7" fill="#fff"/>`,
      octagon: `<polygon points="19,4 39,4 54,19 54,39 39,54 19,54 4,39 4,19" ${f}/><circle cx="29" cy="29" r="9.5" fill="none" stroke="#fff" stroke-width="3.5"/><circle cx="29" cy="29" r="3.2" fill="#fff"/><path d="M29 12v6M29 40v6M12 29h6M40 29h6" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`
    }[LV[n].shape];
    return `<svg viewBox="0 0 58 58" aria-hidden="true">${s}</svg>`;
  }

  /* ---------- Bantu ---------- */
  const fmtNum = v => v == null ? "-" : Number(v).toLocaleString("id-ID", { maximumFractionDigits: 1 });
  const fmtDur = ms => { if (ms == null) return "-"; const s = Math.round(ms / 1000), m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)} j ${m % 60} m` : `${m}:${String(s % 60).padStart(2, "0")}`; };
  const parseD = iso => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const isoD = d => d.toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = parseD(iso); d.setUTCDate(d.getUTCDate() + n); return isoD(d); };
  function isoWeek(iso) {                                        // [tahun ISO, nomor minggu ISO]
    const t = parseD(iso), day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y = t.getUTCFullYear();
    return [y, Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)];
  }
  const dShort = iso => parseD(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
  const weekRange = monday => `${dShort(monday)} - ${parseD(addDays(monday, 6)).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
  const monthStart = iso => String(iso).slice(0, 7) + "-01";
  const addMonths = (iso, n) => { const d = parseD(monthStart(iso)); d.setUTCMonth(d.getUTCMonth() + n); return isoD(d); };
  const monthLabel = iso => parseD(iso).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
  const initials = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "?";
  window.SG = { isoWeek, addDays, addMonths, monthStart, monthLabel, weekRange };   // untuk uji

  let toastT = null;
  function toast(msg) {
    const t = $("#g-toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4500);
  }
  const dlgOpen = d => { if (typeof d.showModal === "function") d.showModal(); else { d.classList.add("polyfill"); d.setAttribute("open", ""); } };
  const dlgClose = d => { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); };

  async function rpc(fn, args) {
    let res;
    try { res = await Auth.client.rpc(fn, args || {}); }
    catch (e) { throw new Error("Gagal terhubung ke server. Periksa koneksi internet Anda."); }
    if (res.error) {
      const m = res.error.message || "";
      if (/permission denied for (function|table|schema|relation)/i.test(m)) {
        // Database menolak: sesi berakhir (permintaan terkirim tanpa login) atau izin fungsi belum dipasang
        let session = null;
        try { session = (await Auth.client.auth.getSession()).data.session; } catch (e) { session = null; }
        if (!session) { const er = new Error("Sesi masuk Anda sudah berakhir. Silakan masuk lagi."); er.relogin = true; throw er; }
        throw new Error("Akun Anda belum mendapat izin menjalankan SHEGAMES di database. Minta admin menjalankan ulang supabase/games.sql di Supabase (SQL Editor).");
      }
      throw new Error(/fetch|network/i.test(m) ? "Gagal terhubung ke server. Periksa koneksi internet Anda." : (m || "Terjadi kesalahan. Coba lagi."));
    }
    return res.data;
  }

  /* ---------- Status & sidebar ---------- */
  let ST = null;
  async function refreshStatus() {
    ST = await rpc("game_my_status");
    const [y, w] = isoWeek(ST.week);
    $("#g-week-l").textContent = `Minggu ${w}, ${y}`;
    $("#g-week-r").textContent = weekRange(ST.week);
    $("#g-week").hidden = false;
    $("#g-av").textContent = initials(ST.profile && ST.profile.full_name);
    $("#g-nm").textContent = (ST.profile && ST.profile.full_name) || "Pemain";
    $("#g-dp").textContent = (ST.profile && ST.profile.department) || "Departemen belum diisi";
    $("#g-me").hidden = false;
    return ST;
  }
  function setNav(r) { $$(".g-nav a").forEach(a => { if (a.dataset.r === r) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }); }

  /* ---------- Departemen ---------- */
  function openDept() {
    const deps = (ST && ST.settings && ST.settings.departments) || [];
    const cur = (ST && ST.profile && ST.profile.department) || "";
    $("#g-dept-field").innerHTML = deps.length
      ? `<select id="g-dept-in"><option value="">Pilih departemen</option>${deps.map(d => `<option${d === cur ? " selected" : ""}>${esc(d)}</option>`).join("")}</select>`
      : `<input id="g-dept-in" value="${esc(cur)}" maxlength="60" placeholder="Contoh: Produksi">`;
    $("#g-dept-err").hidden = true;
    dlgOpen($("#g-dept"));
    setTimeout(() => $("#g-dept-in").focus(), 30);
  }
  $("#g-dept-x").addEventListener("click", () => dlgClose($("#g-dept")));
  $("#g-dept-btn").addEventListener("click", openDept);
  $("#g-dept-ok").addEventListener("click", async () => {
    const v = $("#g-dept-in").value.trim(), err = $("#g-dept-err");
    if (!v) { err.textContent = "Pilih atau isi departemen dulu."; err.hidden = false; return; }
    try { await rpc("game_set_department", { p_dept: v }); dlgClose($("#g-dept")); await refreshStatus(); toast("Departemen disimpan."); route(); }
    catch (e) { err.textContent = e.message; err.hidden = false; }
  });

  /* ---------- Pesan umum ---------- */
  function message(title, text, btn) {
    view.innerHTML = `<div class="g-card g-msg g-in"><img src="assets/games/shegames-logo.svg" alt="" width="72" height="72"><h1>${esc(title)}</h1><p>${text}</p>${btn || ""}</div>`;
  }

  /* ---------- Lobi ---------- */
  async function lobby() {
    setNav("lobi");
    const st = await refreshStatus();
    const s = st.settings, act = st.levels.filter(l => l.active);
    let rank = "-";
    try { const rows = await rpc("game_leaderboard", { p_week: null, p_dept: null, p_all: false, p_month: null }); const me = rows.find(r => r.is_me); if (me) rank = "#" + me.rank; } catch (e) { /* peringkat opsional */ }
    const passed = act.filter(l => l.passed).length;
    const total = act.reduce((a, l) => a + (l.passed ? Number(l.best) : 0), 0);
    const first = String((st.profile && st.profile.full_name) || "").split(/\s+/)[0];
    const cards = st.levels.map((l, i) => card(l, s)).join("");
    view.innerHTML = `
      <section class="g-hero g-in" aria-labelledby="g-hi">
        <h1 id="g-hi">Halo${first ? ", " + esc(first) : ""}! Siap uji pengetahuan K3?</h1>
        <p>Selesaikan level dengan nilai minimal ${esc(s.pass_score)} untuk masuk peringkat minggu ini.</p>
        <div class="g-stats">
          <div class="g-stat"><small>Level lulus</small><b>${passed}/${act.length}</b></div>
          <div class="g-stat"><small>Total skor minggu ini</small><b>${fmtNum(total)}</b></div>
          <div class="g-stat"><small>Peringkat minggu ini</small><b>${rank}</b></div>
        </div>
      </section>
      <h2 class="sr">Pilih level</h2>
      <div class="g-levels">${cards}</div>`;
  }
  function card(l, s) {
    const m = LV[l.level], max = s.max_attempts;
    let pill = "", btn = "", note = "";
    if (!m.built) { pill = `<span class="g-pill soon">Segera hadir</span>`; }
    else if (!l.active) { pill = `<span class="g-pill">Tidak aktif</span>`; }
    else if (!l.ready) { pill = `<span class="g-pill">Belum tersedia</span>`; note = "Soal belum diterbitkan admin."; }
    else if (!l.unlocked) { pill = `<span class="g-pill lock">Terkunci</span>`; note = "Lulus level sebelumnya minggu ini untuk membuka."; }
    else if (l.active_attempt) { btn = `<a class="g-btn" href="#/main/${l.level}">Lanjutkan</a>`; }
    else if (max > 0 && l.attempts >= max) { pill = `<span class="g-pill lock">Batas percobaan tercapai</span>`; }
    else { btn = `<a class="g-btn" href="#/main/${l.level}">${l.attempts ? "Main lagi" : "Main"}</a>`; }
    if (l.passed) pill = `<span class="g-pill ok">Lulus</span>` + pill;
    const off = !btn ? " is-off" : "";
    return `<article class="g-level g-in d${l.level}${off}" style="--lc:${m.c}">
      <div class="g-ltop"><div class="g-shape">${shape(l.level)}</div><div><div class="g-lv">Level ${l.level}</div><h2>${esc(m.name)}</h2></div></div>
      <p>${esc(m.desc)}${note ? " " + esc(note) : ""}</p>
      <div class="g-lmeta">${pill}<span class="g-pill">Percobaan ${l.attempts}${max > 0 ? "/" + max : ""}</span></div>
      <div class="g-lact"><div class="g-lbest">${fmtNum(l.best)}<small>Terbaik minggu ini</small></div>${btn}</div>
    </article>`;
  }

  /* ---------- Bantu hasil ---------- */
  function ringHTML(sc, passed) {
    const C = 2 * Math.PI * 80, col = passed ? "#0D9488" : "#E11D48";
    return `<div class="g-ring"><svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="80" fill="none" stroke="#E2E8F0" stroke-width="14"/>
      <circle cx="90" cy="90" r="80" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - Math.min(100, sc) / 100)).toFixed(2)}"/></svg>
      <div class="g-val" id="g-score">${fmtNum(sc)}<small>dari 100</small></div></div>`;
  }
  const badgeHTML = r => `<span class="g-badge ${r.passed ? "ok" : "no"}">${r.passed ? "Lulus" : "Belum lulus"} (nilai lulus ${esc(r.pass_score)})</span>`;
  const statsHTML = list => `<div class="g-rstats">${list.map(x => `<div><small>${esc(x[0])}</small><b>${esc(x[1])}</b></div>`).join("")}</div>`;
  const actsHTML = lvl => `<div class="g-acts"><button type="button" class="g-btn" id="g-again" data-lvl="${lvl}">Main lagi</button><a class="g-btn ghost" href="#/peringkat">Lihat peringkat</a><a class="g-btn ghost" href="#/">Kembali ke lobi</a></div>`;
  function wireAgain() { const b = $("#g-again"); if (b) b.addEventListener("click", () => play(+b.dataset.lvl)); }

  /* ---------- Level 2 dan 3: satu soal per layar ---------- */
  let G = null, H = null, X = null, timerId = null;
  const stopTimer = () => { clearInterval(timerId); timerId = null; };
  async function play(level) {
    setNav("lobi"); G = null; H = null; X = null; stopTimer();
    if (!LV[level]) { location.hash = "#/"; return; }
    view.innerHTML = `<p class="g-empty">Menyiapkan permainan...</p>`;
    let pl;
    try { pl = await rpc("game_start", { p_level: level }); }
    catch (e) { if (e.relogin) throw e; message("Belum bisa dimainkan", esc(e.message), `<a class="g-btn" href="#/">Kembali ke lobi</a>`); return; }
    if (level === 4) return startHazard(pl);
    if (level === 1) return startCrossword(pl);
    G = { pl, idx: pl.next || 0, res: Array.from({ length: pl.total }, (_, i) => (i < (pl.next || 0) ? "done" : null)), busy: false };
    if (G.idx >= pl.total) return finish();
    showQ();
  }
  function prog() {
    return `<div class="g-prog" aria-hidden="true">${G.res.map((r, i) => `<i class="${r === true ? "ok" : r === false ? "no" : r === "done" ? "now" : i === G.idx ? "now" : ""}"></i>`).join("")}</div>`;
  }
  function showQ() {
    stopTimer();
    const it = G.pl.items[G.idx], t = G.pl.timer, lvl = G.pl.level;
    G.busy = false;
    const head = lvl === 2
      ? `<div class="g-sign"><img src="${esc(it.image)}" alt="Gambar rambu keselamatan"></div><h2 class="g-q" id="g-q" tabindex="-1">Rambu apa ini?</h2>`
      : `<h2 class="g-q" id="g-q" tabindex="-1">${esc(it.q)}</h2>`;
    view.innerHTML = `<div class="g-play">
      <div class="g-bar"><a class="g-btn ghost" href="#/">&larr; Lobi</a>
        <h1 class="g-ttl">Level ${lvl} &middot; ${esc(LV[lvl].name)}<small>Soal ${G.idx + 1} dari ${G.pl.total}</small></h1>
        <div class="g-spacer"></div>${t > 0 ? `<span class="g-timer" id="g-timer"><span aria-hidden="true">&#9201;</span> <span id="g-t">${t}</span> dtk</span>` : ""}</div>
      ${prog()}
      <div class="g-card g-in">${head}
        <div class="g-opts" role="group" aria-labelledby="g-q">${it.opts.map((o, i) => `<button type="button" class="g-opt" data-i="${i}"><span class="g-key" aria-hidden="true">${"ABCDE"[i]}</span><span>${esc(o)}</span></button>`).join("")}</div>
        <div id="g-fb" aria-live="polite"></div>
      </div></div>`;
    $$(".g-opt").forEach(b => b.addEventListener("click", () => answer(+b.dataset.i)));
    $("#g-q").focus({ preventScroll: true });
    if (t > 0) {
      let left = t;
      timerId = setInterval(() => {
        left -= 1;
        const el = $("#g-t"); if (el) el.textContent = Math.max(0, left);
        const tm = $("#g-timer"); if (tm) tm.classList.toggle("low", left <= 5);
        if (left <= 0) { stopTimer(); answer(-1); }
      }, 1000);
    }
  }
  async function answer(i) {
    if (!G || G.busy) return;
    G.busy = true; stopTimer();
    const btns = $$(".g-opt"); btns.forEach(b => { b.disabled = true; });
    let r;
    try { r = await rpc("game_answer", { p_attempt: G.pl.attempt_id, p_item: G.idx, p_choice: i }); }
    catch (e) { toast(e.message); btns.forEach(b => { b.disabled = false; }); G.busy = false; return; }
    if (btns[r.correct_index]) btns[r.correct_index].classList.add("right");
    if (!r.correct && i >= 0 && btns[i]) btns[i].classList.add("wrong");
    G.res[G.idx] = !!r.correct;
    const head = r.correct ? "Benar!" : r.timed_out ? "Waktu habis" : "Kurang tepat";
    const detail = G.pl.level === 2 ? `<p><strong>${esc(r.name)}.</strong> ${esc(r.meaning)}</p>` : (r.explanation ? `<p>${esc(r.explanation)}</p>` : "");
    $("#g-fb").innerHTML = `<div class="g-fb ${r.correct ? "ok" : "no"}"><b>${head}</b>${detail}</div>
      <div class="g-next"><button type="button" class="g-btn" id="g-nx">${r.done ? "Lihat hasil" : "Soal berikutnya"} &rarr;</button></div>`;
    const pr = $(".g-prog"); if (pr) pr.outerHTML = prog();
    $("#g-nx").addEventListener("click", () => { if (r.done) finish(); else { G.idx += 1; showQ(); } });
    $("#g-nx").focus({ preventScroll: true });
  }
  async function finish() {
    stopTimer();
    view.innerHTML = `<p class="g-empty">Menghitung skor...</p>`;
    const lvl = G.pl.level; let r;
    try { r = await rpc("game_finish", { p_attempt: G.pl.attempt_id }); }
    catch (e) { message("Skor belum tersimpan", esc(e.message), `<a class="g-btn" href="#/">Kembali ke lobi</a>`); return; }
    view.innerHTML = `<div class="g-result g-in"><h1 class="sr">Hasil level ${esc(r.level)}</h1>${ringHTML(Number(r.score), r.passed)}${badgeHTML(r)}
      ${statsHTML([["Benar", `${r.correct}/${r.total}`], ["Waktu", fmtDur(r.duration_ms)], ["Terbaik minggu ini", fmtNum(r.best_week)]])}${actsHTML(lvl)}</div>`;
    wireAgain(); G = null; refreshStatus().catch(() => {});
  }

  /* ---------- Level 4: tebak bahaya ---------- */
  const r2 = n => Math.round(Math.max(0, Math.min(100, n)) * 100) / 100;
  function startHazard(pl) {
    H = { pl, found: new Map(), wrong: pl.wrong || 0, busy: false, ended: false, cur: { x: 50, y: 50 }, deadline: null };
    (pl.found || []).slice().sort((a, b) => a.idx - b.idx).forEach((f, i) => H.found.set(f.idx, Object.assign({ order: i + 1 }, f)));
    if (pl.time_limit > 0) H.deadline = performance.now() + (pl.time_limit * 1000 - (pl.now_ms - pl.started_ms));
    drawHazard();
    if (H.deadline) { timerId = setInterval(tickH, 500); tickH(); }
  }
  function tickH() {
    const left = Math.max(0, Math.ceil((H.deadline - performance.now()) / 1000)), el = $("#g-t"), tm = $("#g-timer");
    if (el) el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    if (tm) tm.classList.toggle("low", left <= 15);
    if (left <= 0 && !H.ended) { toast("Waktu habis."); endHazard(); }
  }
  const markHTML = (f, cls, sym) => `<div class="g-mark ${cls}" style="left:${f.x}%;top:${f.y}%;width:${f.r * 2}%"><span>${sym}</span></div>`;
  function drawHazard() {
    const sc = H.pl.scene, n = H.pl.total_points;
    view.innerHTML = `<div class="g-play g-wide">
      <div class="g-bar"><a class="g-btn ghost" href="#/">&larr; Lobi</a>
        <h1 class="g-ttl">Level 4 &middot; ${esc(LV[4].name)}<small id="g-hs"></small></h1><div class="g-spacer"></div>
        ${H.deadline ? '<span class="g-timer" id="g-timer"><span aria-hidden="true">&#9201;</span> <span id="g-t"></span></span>' : ""}</div>
      <p class="g-prompt">${esc(sc.prompt || "Temukan semua bahaya pada foto ini.")}</p>
      <div class="g-scene" id="g-scene" tabindex="0" role="application" aria-label="Foto area kerja. Ketuk bagian yang berbahaya. Pengguna papan ketik: gunakan tombol panah untuk menggeser bidik, lalu Enter untuk menandai." style="aspect-ratio:${sc.w}/${sc.h}">
        <img src="${esc(sc.image)}" alt="" draggable="false"><div id="g-marks"></div><div class="g-cross" id="g-cross" hidden></div></div>
      <p class="g-kb">Papan ketik: fokuskan foto, geser bidik dengan tombol panah (Shift = lompatan besar), tandai dengan Enter atau Spasi.</p>
      <div id="g-live" class="sr" aria-live="polite"></div>
      <div id="g-found" class="g-foundlist"></div>
      <div class="g-next"><button type="button" class="g-btn" id="g-h-done">Selesai dan lihat hasil</button></div></div>`;
    const scene = $("#g-scene");
    scene.addEventListener("click", e => { const rc = scene.getBoundingClientRect(); tapAt((e.clientX - rc.left) / rc.width * 100, (e.clientY - rc.top) / rc.height * 100); });
    scene.addEventListener("focus", () => { const c = $("#g-cross"); c.hidden = false; moveCross(0, 0); });
    scene.addEventListener("blur", () => { $("#g-cross").hidden = true; });
    scene.addEventListener("keydown", e => {
      const st = e.shiftKey ? 8 : 2, d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
      if (d) { e.preventDefault(); moveCross(d[0], d[1]); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapAt(H.cur.x, H.cur.y); }
    });
    $("#g-h-done").addEventListener("click", () => {
      if (H.found.size < n && !window.confirm(`Baru ${H.found.size} dari ${n} bahaya ditemukan. Selesai sekarang?`)) return;
      endHazard();
    });
    renderHazard();
  }
  function moveCross(dx, dy) {
    H.cur.x = r2(H.cur.x + dx); H.cur.y = r2(H.cur.y + dy);
    const c = $("#g-cross"); if (c) { c.style.left = H.cur.x + "%"; c.style.top = H.cur.y + "%"; }
  }
  function renderHazard() {
    const arr = Array.from(H.found.values());
    $("#g-marks").innerHTML = arr.map(f => markHTML(f, "ok", f.order)).join("");
    $("#g-hs").textContent = `${H.found.size} dari ${H.pl.total_points} ditemukan \u00b7 ${H.wrong} salah ketuk`;
    $("#g-found").innerHTML = arr.map(f => `<article class="g-fcard"><span class="g-fnum">${f.order}</span><div><h3>${esc(f.name)}</h3><p><b>Risiko:</b> ${esc(f.risk || "-")}</p><p><b>Pengendalian:</b> ${esc(f.control || "-")}</p></div></article>`).join("");
  }
  async function tapAt(x, y) {
    if (!H || H.busy || H.ended) return;
    H.busy = true; let r;
    try { r = await rpc("game_tap", { p_attempt: H.pl.attempt_id, p_x: r2(x), p_y: r2(y) }); }
    catch (e) { toast(e.message); H.busy = false; return; }
    if (r.expired) { H.busy = false; toast("Waktu habis."); return endHazard(); }
    const live = $("#g-live");
    if (r.hit) {
      H.found.set(r.idx, Object.assign({ order: H.found.size + 1 }, r)); renderHazard();
      if (live) live.textContent = `Benar. ${r.name}. ${r.found} dari ${r.total} ditemukan.`;
    } else if (r.dup) { toast("Titik ini sudah Anda temukan."); }
    else {
      H.wrong = r.wrong; renderHazard();
      const m = document.createElement("div"); m.className = "g-miss"; m.style.left = r2(x) + "%"; m.style.top = r2(y) + "%"; m.textContent = "\u00d7";
      $("#g-scene").appendChild(m); setTimeout(() => m.remove(), 900);
      toast(`Salah ketuk. Penalti ${r.penalty} poin.`);
      if (live) live.textContent = `Salah ketuk. Penalti ${r.penalty} poin.`;
    }
    H.busy = false;
    if (r.done) setTimeout(endHazard, 900);
  }
  async function endHazard() {
    if (!H || H.ended) return;
    H.ended = true; stopTimer();
    const pl = H.pl; view.innerHTML = `<p class="g-empty">Menghitung skor...</p>`; let r;
    try { r = await rpc("game_finish", { p_attempt: pl.attempt_id }); }
    catch (e) { H.ended = false; message("Skor belum tersimpan", esc(e.message), `<a class="g-btn" href="#/">Kembali ke lobi</a>`); return; }
    const sc = pl.scene, found = r.reveal.filter(p => p.found).length;
    view.innerHTML = `<div class="g-result g-wideres g-in"><h1 class="sr">Hasil level 4</h1>${ringHTML(Number(r.score), r.passed)}${badgeHTML(r)}
      ${statsHTML([["Ditemukan", `${found}/${r.total}`], ["Salah ketuk", r.wrong_taps], ["Waktu", fmtDur(r.duration_ms)]])}
      <div class="g-scene g-scene-res" style="aspect-ratio:${sc.w}/${sc.h}"><img src="${esc(sc.image)}" alt="Foto area kerja dengan penanda bahaya">${r.reveal.map((p, i) => markHTML(p, p.found ? "ok" : "miss", p.found ? "\u2713" : "!")).join("")}</div>
      <p class="g-legend"><span class="g-lg ok"></span> Ditemukan <span class="g-lg miss"></span> Terlewat</p>
      <div class="g-foundlist g-left">${r.reveal.map((p, i) => `<article class="g-fcard ${p.found ? "" : "missed"}"><span class="g-fnum">${p.found ? "\u2713" : "!"}</span><div><h3>${esc(p.name)} <span class="g-pill ${p.found ? "ok" : "lock"}">${p.found ? "Ditemukan" : "Terlewat"}</span></h3><p><b>Risiko:</b> ${esc(p.risk || "-")}</p><p><b>Pengendalian:</b> ${esc(p.control || "-")}</p></div></article>`).join("")}</div>
      ${actsHTML(4)}</div>`;
    wireAgain(); H = null; refreshStatus().catch(() => {});
  }

  /* ---------- Level 1: teka-teki silang ---------- */
  const cwKey = (r, c) => r + "," + c;
  function startCrossword(pl) {
    const cells = new Map(), items = pl.items.map((it, i) => Object.assign({ i }, it));
    items.forEach(it => {
      const dr = it.dir === "D" ? 1 : 0, dc = 1 - dr; it.cells = [];
      for (let k = 0; k < it.len; k++) {
        const r = it.row + dr * k, c = it.col + dc * k, kk = cwKey(r, c);
        let cell = cells.get(kk); if (!cell) { cell = { r, c, A: -1, D: -1, num: 0, letter: "", hint: false }; cells.get(kk) || cells.set(kk, cell); }
        cell[it.dir] = it.i; if (k === 0) cell.num = it.num; it.cells.push(cell);
      }
    });
    X = { pl, items, cells, sel: null, dir: "A", hintsUsed: pl.hints_used || 0, store: "sg-cw-" + pl.attempt_id, busy: false };
    (pl.hinted || []).forEach(h => { const cell = cells.get(cwKey(h.row, h.col)); if (cell) { cell.letter = h.letter; cell.hint = true; } });
    try { const sv = JSON.parse(sessionStorage.getItem(X.store) || "{}"); Object.keys(sv).forEach(k => { const cell = cells.get(k); if (cell && !cell.hint && /^[A-Z]$/.test(sv[k])) cell.letter = sv[k]; }); } catch (e) { /* abaikan */ }
    const first = items.slice().sort((a, b) => a.num - b.num || (a.dir === "A" ? -1 : 1))[0];
    X.dir = first.dir; X.sel = first.cells[0];
    drawCrossword();
  }
  const cwItem = () => { const c = X.sel; if (!c) return null; const i = c[X.dir] >= 0 ? c[X.dir] : (c.A >= 0 ? c.A : c.D); return i >= 0 ? X.items[i] : null; };
  function cwSave() { try { const o = {}; X.cells.forEach((c, k) => { if (c.letter && !c.hint) o[k] = c.letter; }); sessionStorage.setItem(X.store, JSON.stringify(o)); } catch (e) { /* abaikan */ } }
  function drawCrossword() {
    const pl = X.pl, left = pl.hint_max - X.hintsUsed;
    const clueList = d => X.items.filter(i => i.dir === d).sort((a, b) => a.num - b.num).map(i => `<li><button type="button" class="g-clue" data-i="${i.i}"><b>${i.num}.</b> ${esc(i.clue)} <span>(${i.len} huruf)</span></button></li>`).join("");
    view.innerHTML = `<div class="g-play g-wide">
      <div class="g-bar"><a class="g-btn ghost" href="#/">&larr; Lobi</a>
        <h1 class="g-ttl">Level 1 &middot; ${esc(LV[1].name)}<small id="g-cw-fill"></small></h1><div class="g-spacer"></div>
        <button type="button" class="g-btn ghost" id="g-cw-hint"></button></div>
      <div class="g-cwclue" id="g-cw-clue" aria-live="polite"></div>
      <div class="g-cwwrap" id="g-cw-wrap"><div class="g-cw" id="g-cw" role="presentation"></div></div>
      <input id="g-cw-in" class="g-cwin" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="2" aria-label="Isi huruf pada kotak yang dipilih. Panah untuk berpindah, Spasi untuk mengganti arah.">
      <p class="g-kb">Ketuk kotak lalu ketik huruf. Spasi atau ketuk lagi kotak yang sama mengganti arah. Bantuan huruf mengurangi ${esc(pl.hint_penalty)} poin tiap kotak.</p>
      <div class="g-cwlists"><section aria-labelledby="g-cwa"><h2 id="g-cwa">Mendatar</h2><ul>${clueList("A")}</ul></section><section aria-labelledby="g-cwd"><h2 id="g-cwd">Menurun</h2><ul>${clueList("D")}</ul></section></div>
      <div class="g-next"><button type="button" class="g-btn" id="g-cw-done">Selesai dan lihat hasil</button></div></div>`;
    const grid = $("#g-cw");
    let html = "";
    for (let r = 0; r < pl.rows; r++) for (let c = 0; c < pl.cols; c++) {
      const cell = X.cells.get(cwKey(r, c));
      html += cell ? `<div class="g-cell" data-r="${r}" data-c="${c}">${cell.num ? `<i>${cell.num}</i>` : ""}<b></b></div>` : `<div class="g-blk"></div>`;
    }
    grid.innerHTML = html; grid.style.gridTemplateColumns = `repeat(${pl.cols}, var(--cs))`;
    sizeCw(); window.addEventListener("resize", sizeCw);
    grid.addEventListener("click", e => {
      const el = e.target.closest(".g-cell"); if (!el) return;
      const cell = X.cells.get(cwKey(+el.dataset.r, +el.dataset.c));
      if (X.sel === cell) { if (cell.A >= 0 && cell.D >= 0) X.dir = X.dir === "A" ? "D" : "A"; }
      else { X.sel = cell; if (cell[X.dir] < 0) X.dir = cell.A >= 0 ? "A" : "D"; }
      cwFocus(); cwRender();
    });
    $$(".g-clue").forEach(b => b.addEventListener("click", () => { const it = X.items[+b.dataset.i]; X.dir = it.dir; X.sel = it.cells.find(c => !c.letter) || it.cells[0]; cwFocus(); cwRender(); }));
    const inp = $("#g-cw-in");
    inp.addEventListener("input", () => {
      const ch = (inp.value.match(/[A-Za-z]/g) || []).pop(); inp.value = "";
      if (!ch || !X.sel) return;
      if (!X.sel.hint) { X.sel.letter = ch.toUpperCase(); cwSave(); }
      cwStep(1); cwRender();
    });
    inp.addEventListener("keydown", cwKeys);
    $("#g-cw-hint").addEventListener("click", cwHint);
    $("#g-cw-done").addEventListener("click", cwDone);
    cwRender();
    if (window.matchMedia && matchMedia("(pointer: fine)").matches) cwFocus();   // di komputer ketikan langsung masuk; di ponsel papan ketik hanya muncul saat kotak diketuk
  }
  function sizeCw() {
    const wrap = $("#g-cw-wrap"); if (!wrap || !X) return;
    const avail = wrap.clientWidth - 18 - (X.pl.cols - 1) * 2;   // bantalan 2 x 8 px + 2 px jarak antar kotak
    const cs = Math.max(22, Math.min(46, Math.floor(avail / X.pl.cols)));
    $("#g-cw").style.setProperty("--cs", cs + "px"); $("#g-cw").style.fontSize = Math.round(cs * 0.55) + "px";
  }
  function cwFocus() { const i = $("#g-cw-in"); if (i) i.focus({ preventScroll: true }); }
  function cwStep(d) {
    const it = cwItem(); if (!it) return;
    const k = it.cells.indexOf(X.sel), nx = it.cells[k + d];
    if (nx) X.sel = nx;
  }
  function cwMove(dr, dc) {
    let r = X.sel.r + dr, c = X.sel.c + dc;
    while (r >= 0 && c >= 0 && r < X.pl.rows && c < X.pl.cols) { const cell = X.cells.get(cwKey(r, c)); if (cell) { X.sel = cell; if (cell[X.dir] < 0) X.dir = cell.A >= 0 ? "A" : "D"; return; } r += dr; c += dc; }
  }
  function cwKeys(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === "ArrowLeft") { e.preventDefault(); if (X.dir === "D" && X.sel.A >= 0) X.dir = "A"; cwMove(0, -1); }
    else if (k === "ArrowRight") { e.preventDefault(); if (X.dir === "D" && X.sel.A >= 0) X.dir = "A"; cwMove(0, 1); }
    else if (k === "ArrowUp") { e.preventDefault(); if (X.dir === "A" && X.sel.D >= 0) X.dir = "D"; cwMove(-1, 0); }
    else if (k === "ArrowDown") { e.preventDefault(); if (X.dir === "A" && X.sel.D >= 0) X.dir = "D"; cwMove(1, 0); }
    else if (k === " " || k === "Enter") { e.preventDefault(); if (X.sel.A >= 0 && X.sel.D >= 0) X.dir = X.dir === "A" ? "D" : "A"; }
    else if (k === "Backspace") { e.preventDefault(); if (!X.sel.letter || X.sel.hint) cwStep(-1); const c = X.sel; if (!c.hint) { c.letter = ""; cwSave(); } }
    else if (k === "Delete") { e.preventDefault(); if (!X.sel.hint) { X.sel.letter = ""; cwSave(); } }
    else if (k === "Tab") {
      const list = X.items.slice().sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === "A" ? -1 : 1)), cur = cwItem(), idx = list.indexOf(cur), nx = list[(idx + (e.shiftKey ? list.length - 1 : 1)) % list.length];
      if (nx && !(idx < 0)) { e.preventDefault(); X.dir = nx.dir; X.sel = nx.cells.find(c => !c.letter) || nx.cells[0]; }
    } else return;
    cwRender();
  }
  function cwRender() {
    const it = cwItem(), inWord = new Set(it ? it.cells : []);
    $$(".g-cell").forEach(el => {
      const cell = X.cells.get(cwKey(+el.dataset.r, +el.dataset.c));
      el.className = "g-cell" + (cell === X.sel ? " sel" : inWord.has(cell) ? " inw" : "") + (cell.hint ? " hint" : "");
      el.lastChild.textContent = cell.letter;
    });
    $$(".g-clue").forEach(b => b.classList.toggle("on", it && +b.dataset.i === it.i));
    const filled = Array.from(X.cells.values()).filter(c => c.letter).length;
    $("#g-cw-fill").textContent = `${filled} dari ${X.cells.size} kotak terisi`;
    $("#g-cw-clue").innerHTML = it ? `<b>${it.num} ${it.dir === "A" ? "Mendatar" : "Menurun"}</b> ${esc(it.clue)} <span>(${it.len} huruf)</span>` : "";
    const left = X.pl.hint_max - X.hintsUsed, hb = $("#g-cw-hint");
    hb.textContent = `Bantuan huruf (sisa ${Math.max(0, left)})`; hb.disabled = left <= 0 && !(X.sel && X.sel.hint) || X.busy;
    const cur = $(".g-cell.sel"); if (cur && cur.scrollIntoView && window.innerWidth < 700) cur.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  async function cwHint() {
    if (!X || X.busy || !X.sel) return;
    if (X.sel.hint) { toast("Huruf ini sudah dibuka."); return; }
    if (X.pl.hint_max - X.hintsUsed <= 0) { toast("Bantuan huruf sudah habis."); return; }
    X.busy = true; cwRender();
    try {
      const r = await rpc("game_hint", { p_attempt: X.pl.attempt_id, p_row: X.sel.r, p_col: X.sel.c });
      X.sel.letter = r.letter; X.sel.hint = true; X.hintsUsed = r.hints_used; cwSave();
      toast(r.charged ? `Huruf dibuka. Penalti ${r.penalty} poin.` : "Huruf ini sudah dibuka.");
    } catch (e) { toast(e.message); }
    X.busy = false; cwRender(); cwFocus();
  }
  async function cwDone() {
    if (!X || X.busy) return;
    const empty = Array.from(X.cells.values()).filter(c => !c.letter).length;
    if (empty && !window.confirm(`Masih ada ${empty} kotak kosong. Selesai sekarang?`)) return;
    X.busy = true; const answers = {};
    X.items.forEach(it => { answers[it.num + it.dir] = it.cells.map(c => c.letter || "").join(""); });
    view.innerHTML = `<p class="g-empty">Menghitung skor...</p>`; let r;
    try { r = await rpc("game_finish", { p_attempt: X.pl.attempt_id, p_answers: answers }); }
    catch (e) { X.busy = false; drawCrossword(); toast(e.message); return; }
    try { sessionStorage.removeItem(X.store); } catch (e) { /* abaikan */ }
    window.removeEventListener("resize", sizeCw);
    const rv = r.reveal, ok = rv.filter(w => w.correct).length;
    view.innerHTML = `<div class="g-result g-wideres g-in"><h1 class="sr">Hasil level 1</h1>${ringHTML(Number(r.score), r.passed)}${badgeHTML(r)}
      ${statsHTML([["Kata benar", `${ok}/${r.total}`], ["Bantuan huruf", r.hints], ["Waktu", fmtDur(r.duration_ms)]])}
      <div class="g-foundlist g-left">${["A", "D"].map(d => `<section><h2 class="g-h2">${d === "A" ? "Mendatar" : "Menurun"}</h2>${rv.filter(w => w.dir === d).sort((a, b) => a.num - b.num).map(w => `<article class="g-fcard ${w.correct ? "" : "missed"}"><span class="g-fnum">${w.correct ? "\u2713" : "!"}</span><div><h3>${w.num}. ${esc(w.word)} <span class="g-pill ${w.correct ? "ok" : "lock"}">${w.correct ? "Benar" : "Belum tepat"}</span></h3><p>${esc(w.clue)}</p></div></article>`).join("")}</section>`).join("")}</div>
      ${actsHTML(1)}</div>`;
    wireAgain(); X = null; refreshStatus().catch(() => {});
  }

  document.addEventListener("keydown", e => {
    if (!G || G.busy || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase(), i = "12345".indexOf(k) >= 0 ? "12345".indexOf(k) : "abcde".indexOf(k);
    const btns = $$(".g-opt");
    if (i >= 0 && btns[i] && !btns[i].disabled && !/input|select|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); answer(i); }
  });

  /* ---------- Peringkat ---------- */
  const LB = { mode: "week", week: null, month: null, dept: "", q: "" };
  async function board() {
    setNav("peringkat");
    const st = ST || await refreshStatus();
    LB.week = LB.week || st.week; LB.month = LB.month || monthStart(st.today || st.week);
    const deps = st.settings.departments || [];
    const weeks = Array.from({ length: 12 }, (_, i) => addDays(st.week, -7 * i));
    const months = Array.from({ length: 12 }, (_, i) => addMonths(st.today || st.week, -i));
    view.innerHTML = `
      <div class="g-head g-in"><div><h1>Peringkat</h1><p>Skor terbaik tiap level yang lulus. Seri dipecahkan oleh level tertinggi dan waktu.</p></div></div>
      <div class="g-filters g-in d1">
        <div class="g-seg" role="group" aria-label="Periode peringkat">
          <button type="button" data-m="week" aria-pressed="${LB.mode === "week"}">Mingguan</button>
          <button type="button" data-m="month" aria-pressed="${LB.mode === "month"}">Bulanan</button>
          <button type="button" data-m="all" aria-pressed="${LB.mode === "all"}">Semua waktu</button>
        </div>
        <label class="sr" for="g-pw">Pilih minggu</label>
        <select id="g-pw" ${LB.mode === "week" ? "" : "hidden"}>${weeks.map(w => { const [y, n] = isoWeek(w); return `<option value="${w}"${w === LB.week ? " selected" : ""}>Minggu ${n}, ${y} (${weekRange(w)})</option>`; }).join("")}</select>
        <label class="sr" for="g-pm">Pilih bulan</label>
        <select id="g-pm" ${LB.mode === "month" ? "" : "hidden"}>${months.map(m => `<option value="${m}"${m === LB.month ? " selected" : ""}>${esc(monthLabel(m))}</option>`).join("")}</select>
        <label class="sr" for="g-pd">Departemen</label>
        <select id="g-pd"><option value="">Semua departemen</option>${deps.map(d => `<option${d === LB.dept ? " selected" : ""}>${esc(d)}</option>`).join("")}</select>
        <label class="sr" for="g-ps">Cari nama</label>
        <input id="g-ps" type="search" placeholder="Cari nama" value="${esc(LB.q)}">
      </div>
      <div id="g-lb" class="g-in d2"><p class="g-empty">Memuat peringkat...</p></div>`;
    $$(".g-seg button").forEach(b => b.addEventListener("click", () => { LB.mode = b.dataset.m; board(); }));
    $("#g-pw").addEventListener("change", e => { LB.week = e.target.value; loadBoard(); });
    $("#g-pm").addEventListener("change", e => { LB.month = e.target.value; loadBoard(); });
    $("#g-pd").addEventListener("change", e => { LB.dept = e.target.value; loadBoard(); });
    $("#g-ps").addEventListener("input", e => { LB.q = e.target.value; drawBoard(); });
    loadBoard();
  }
  let ROWS = [];
  async function loadBoard() {
    const box = $("#g-lb"); if (!box) return;
    try {
      ROWS = await rpc("game_leaderboard", {
        p_week: LB.mode === "week" ? LB.week : null, p_dept: LB.dept || null,
        p_all: LB.mode === "all", p_month: LB.mode === "month" ? LB.month : null
      });
    } catch (e) { box.innerHTML = `<p class="g-empty">${esc(e.message)}</p>`; return; }
    drawBoard();
  }
  function periodText() {
    if (LB.mode === "all") return "sepanjang waktu";
    if (LB.mode === "month") return monthLabel(LB.month);
    const [y, n] = isoWeek(LB.week); return `minggu ${n}, ${y}`;
  }
  function drawBoard() {
    const box = $("#g-lb"); if (!box) return;
    const lv = (ST.settings.active_levels || [1, 2, 3, 4]).slice().sort();
    const q = LB.q.trim().toLowerCase();
    const rows = q ? ROWS.filter(r => String(r.full_name).toLowerCase().includes(q)) : ROWS;
    const me = ROWS.find(r => r.is_me);
    if (!ROWS.length) { box.innerHTML = `<div class="g-card g-empty">Belum ada skor lulus untuk ${esc(periodText())}${LB.dept ? " di departemen " + esc(LB.dept) : ""}. Jadilah yang pertama!</div>`; return; }
    const pod = ROWS.slice(0, 3);
    const podHTML = q ? "" : `<div class="g-podium">${[1, 0, 2].filter(i => pod[i]).map(i => { const r = pod[i]; return `<div class="g-pod p${i + 1}"><div class="g-medal">${r.rank}</div><div class="g-nm2">${esc(r.full_name)}</div><div class="g-dp2">${esc(r.department || "-")}</div><div class="g-sc">${fmtNum(r.total)}</div></div>`; }).join("")}</div>`;
    box.innerHTML = `
      ${me ? `<div class="g-mine"><div><small>Posisi Anda (${esc(periodText())})</small><br><b>#${me.rank}</b> <small>dari ${ROWS.length} pemain</small></div><div><small>Total skor</small><br><b>${fmtNum(me.total)}</b></div><div><small>Level lulus</small><br><b>${me.passed_levels}</b></div></div>` : ""}
      ${podHTML}
      <div class="g-table-wrap" tabindex="0" role="region" aria-label="Tabel peringkat ${esc(periodText())}">
        <table class="g-table"><thead><tr><th>Peringkat</th><th>Nama</th><th>Departemen</th><th class="num">Lulus</th>${lv.map(n => `<th class="num">L${n}</th>`).join("")}<th class="num">Total</th><th class="num">Waktu</th></tr></thead>
        <tbody>${rows.map(r => `<tr class="${r.is_me ? "me" : ""}"${r.is_me ? ' aria-current="true"' : ""}><td><span class="g-rank">${r.rank}</span></td><td>${esc(r.full_name)}${r.is_me ? " (Anda)" : ""}</td><td>${esc(r.department || "-")}</td><td class="num">${r.passed_levels}</td>${lv.map(n => `<td class="num">${fmtNum(r["s" + n])}</td>`).join("")}<td class="num"><b>${fmtNum(r.total)}</b></td><td class="num">${fmtDur(r.time_ms)}</td></tr>`).join("") || `<tr><td colspan="${6 + lv.length}" class="g-empty">Tidak ada nama yang cocok.</td></tr>`}</tbody></table>
      </div>`;
  }

  /* ---------- Cara main ---------- */
  function help() {
    setNav("cara-main");
    const s = (ST && ST.settings) || {};
    view.innerHTML = `
      <div class="g-head g-in"><div><h1>Cara main</h1><p>Empat level, satu tujuan: kerja aman setiap hari.</p></div></div>
      <div class="g-levels">${[1, 2, 3, 4].map(n => `<article class="g-level g-in d${n}" style="--lc:${LV[n].c}"><div class="g-ltop"><div class="g-shape">${shape(n)}</div><div><div class="g-lv">Level ${n}</div><h2>${esc(LV[n].name)}</h2></div></div><p>${esc(LV[n].desc)}</p></article>`).join("")}</div>
      <div class="g-card g-help g-in d2"><h2 style="font-family:var(--display);margin:0">Aturan skor dan peringkat</h2><ol>
        <li>Nilai lulus tiap level adalah ${esc(s.pass_score != null ? s.pass_score : 60)}. Hanya level yang lulus yang masuk peringkat.</li>
        <li>Teka-teki silang: maksimal ${esc(s.hint_max != null ? s.hint_max : 3)} bantuan huruf, masing-masing mengurangi ${esc(s.hint_penalty != null ? s.hint_penalty : 5)} poin.</li>
        <li>Tebak bahaya: setiap salah ketuk mengurangi ${esc(s.tap_penalty != null ? s.tap_penalty : 5)} poin.</li>
        <li>${s.sequential ? "Level dibuka berurutan: lulus level sebelumnya pada minggu yang sama untuk membuka level berikutnya." : "Semua level bisa dimainkan dalam urutan apa pun."}</li>
        <li>Peringkat tersedia per minggu (Senin sampai Minggu), per bulan, dan sepanjang waktu. Skor yang dihitung adalah skor terbaik tiap level pada periode itu.</li>
        <li>${s.max_attempts > 0 ? `Setiap level bisa dicoba ${esc(s.max_attempts)} kali per minggu.` : "Tidak ada batas percobaan."}</li>
      </ol></div>`;
  }

  /* ---------- Rute ---------- */
  async function route() {
    stopTimer();
    const h = location.hash || "#/";
    try {
      const m = h.match(/^#\/main\/(\d)$/);
      if (m) await play(+m[1]);
      else if (h === "#/peringkat") await board();
      else if (h === "#/cara-main") help();
      else await lobby();
    } catch (e) {
      if (e.relogin) message("Sesi berakhir", esc(e.message), `<a class="g-btn" href="masuk.html?next=shegames.html">Masuk lagi</a>`);
      else message("Terjadi kendala", esc(e.message), `<button type="button" class="g-btn" onclick="location.reload()">Muat ulang</button>`);
    }
    const main = $("#g-main"); if (main && !/main\//.test(h)) main.scrollTop = 0;
  }
  window.addEventListener("hashchange", () => { if (!/^#\/main\//.test(location.hash)) { G = null; H = null; if (X) window.removeEventListener("resize", sizeCw); X = null; } route(); });

  async function boot() {
    if (!window.Auth || !Auth.configured) { message("SHEGAMES belum aktif", "Fitur akun situs belum dikonfigurasi. Hubungi admin.", `<a class="g-btn" href="index.html">Kembali ke SHEDINO</a>`); return; }
    let st = null;
    try { st = await Auth.getState(); } catch (e) { st = null; }
    if (!st) { message("Masuk untuk bermain", "SHEGAMES hanya untuk karyawan yang sudah punya akun dan disetujui admin.", `<a class="g-btn" href="masuk.html?next=shegames.html">Masuk atau daftar</a>`); return; }
    if (!st.profile || st.profile.status !== "approved") { message("Akun menunggu persetujuan", "Akun Anda sudah terdaftar tetapi belum disetujui admin. Coba lagi setelah disetujui.", `<a class="g-btn ghost" href="index.html">Kembali ke SHEDINO</a>`); return; }
    if (!Auth.can(st, "games")) { message("Tidak ada akses ke SHEGAMES", "Akun Anda tidak memiliki akses untuk bermain SHEGAMES. Hubungi admin bila Anda memerlukannya.", `<a class="g-btn ghost" href="index.html">Kembali ke SHEDINO</a>`); return; }
    try { await refreshStatus(); }
    catch (e) {
      if (e.relogin) { message("Sesi berakhir", esc(e.message), `<a class="g-btn" href="masuk.html?next=shegames.html">Masuk lagi</a>`); return; }
      message("SHEGAMES belum siap", esc(e.message), `<a class="g-btn ghost" href="index.html">Kembali ke SHEDINO</a>`); return;
    }
    if (!ST.profile || !ST.profile.department) openDept();
    route();
  }
  boot();
})();
