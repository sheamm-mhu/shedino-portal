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
    1: { name: "Teka-teki silang JSA", desc: "Isi kotak dengan istilah K3 dari petunjuk mendatar dan menurun.", shape: "square", c: "#2563EB", built: false },
    2: { name: "Tebak rambu", desc: "Lihat rambu keselamatan, lalu pilih nama yang tepat.", shape: "triangle", c: "#D97706", built: false },
    3: { name: "Pilihan ganda", desc: "Jawab soal pengetahuan K3 dan pelajari penjelasannya.", shape: "circle", c: "#0D9488", built: true },
    4: { name: "Tebak bahaya", desc: "Temukan titik berbahaya pada foto area kerja.", shape: "octagon", c: "#E11D48", built: false }
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
    if (!l.active) { pill = `<span class="g-pill">Tidak aktif</span>`; }
    else if (!l.ready) { pill = `<span class="g-pill">Belum tersedia</span>`; note = "Soal belum diterbitkan admin."; }
    else if (!m.built) { pill = `<span class="g-pill soon">Segera hadir</span>`; }
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

  /* ---------- Level 3: pilihan ganda ---------- */
  let G = null, timerId = null;
  const stopTimer = () => { clearInterval(timerId); timerId = null; };
  async function play(level) {
    setNav("lobi");
    if (!LV[level]) { location.hash = "#/"; return; }
    if (!LV[level].built) { message(LV[level].name, "Level ini sedang disiapkan dan akan segera hadir.", `<a class="g-btn" href="#/">Kembali ke lobi</a>`); return; }
    view.innerHTML = `<p class="g-empty">Menyiapkan soal...</p>`;
    let pl;
    try { pl = await rpc("game_start", { p_level: level }); }
    catch (e) { message("Belum bisa dimainkan", esc(e.message), `<a class="g-btn" href="#/">Kembali ke lobi</a>`); return; }
    G = { pl, idx: pl.next || 0, res: Array.from({ length: pl.total }, (_, i) => (i < (pl.next || 0) ? "done" : null)), busy: false };
    if (G.idx >= pl.total) return finish();
    showQ();
  }
  function prog() {
    return `<div class="g-prog" aria-hidden="true">${G.res.map((r, i) => `<i class="${r === true ? "ok" : r === false ? "no" : r === "done" ? "now" : i === G.idx ? "now" : ""}"></i>`).join("")}</div>`;
  }
  function showQ() {
    stopTimer();
    const it = G.pl.items[G.idx], t = G.pl.timer;
    G.busy = false;
    view.innerHTML = `<div class="g-play">
      <div class="g-bar"><a class="g-btn ghost" href="#/">&larr; Lobi</a>
        <h1 class="g-ttl">Level 3 &middot; ${esc(LV[3].name)}<small>Soal ${G.idx + 1} dari ${G.pl.total}</small></h1>
        <div class="g-spacer"></div>${t > 0 ? `<span class="g-timer" id="g-timer"><span aria-hidden="true">&#9201;</span> <span id="g-t">${t}</span> dtk</span>` : ""}</div>
      ${prog()}
      <div class="g-card g-in">
        <h2 class="g-q" id="g-q" tabindex="-1">${esc(it.q)}</h2>
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
    $("#g-fb").innerHTML = `<div class="g-fb ${r.correct ? "ok" : "no"}"><b>${head}</b>${r.explanation ? `<p>${esc(r.explanation)}</p>` : ""}</div>
      <div class="g-next"><button type="button" class="g-btn" id="g-nx">${r.done ? "Lihat hasil" : "Soal berikutnya"} &rarr;</button></div>`;
    const pr = $(".g-prog"); if (pr) pr.outerHTML = prog();
    $("#g-nx").addEventListener("click", () => { if (r.done) finish(); else { G.idx += 1; showQ(); } });
    $("#g-nx").focus({ preventScroll: true });
  }
  async function finish() {
    stopTimer();
    view.innerHTML = `<p class="g-empty">Menghitung skor...</p>`;
    let r;
    try { r = await rpc("game_finish", { p_attempt: G.pl.attempt_id }); }
    catch (e) { message("Skor belum tersimpan", esc(e.message), `<a class="g-btn" href="#/">Kembali ke lobi</a>`); return; }
    const sc = Number(r.score), C = 2 * Math.PI * 80, col = r.passed ? "#0D9488" : "#E11D48";
    view.innerHTML = `<div class="g-result g-in"><h1 class="sr">Hasil level ${esc(r.level)}</h1>
      <div class="g-ring"><svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="80" fill="none" stroke="#E2E8F0" stroke-width="14"/>
        <circle cx="90" cy="90" r="80" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - Math.min(100, sc) / 100)).toFixed(2)}"/></svg>
        <div class="g-val" id="g-score">${fmtNum(sc)}<small>dari 100</small></div></div>
      <span class="g-badge ${r.passed ? "ok" : "no"}">${r.passed ? "Lulus" : "Belum lulus"} (nilai lulus ${esc(r.pass_score)})</span>
      <div class="g-rstats">
        <div><small>Benar</small><b>${r.correct}/${r.total}</b></div>
        <div><small>Waktu</small><b>${fmtDur(r.duration_ms)}</b></div>
        <div><small>Terbaik minggu ini</small><b>${fmtNum(r.best_week)}</b></div>
      </div>
      <div class="g-acts"><button type="button" class="g-btn" id="g-again">Main lagi</button><a class="g-btn ghost" href="#/peringkat">Lihat peringkat</a><a class="g-btn ghost" href="#/">Kembali ke lobi</a></div>
    </div>`;
    $("#g-again").addEventListener("click", () => play(G.pl.level));
    G = null;
    refreshStatus().catch(() => {});
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
    } catch (e) { message("Terjadi kendala", esc(e.message), `<a class="g-btn" href="#/">Muat ulang</a>`); }
    const main = $("#g-main"); if (main && !/main\//.test(h)) main.scrollTop = 0;
  }
  window.addEventListener("hashchange", () => { if (G && !/^#\/main\//.test(location.hash)) G = null; route(); });

  async function boot() {
    if (!window.Auth || !Auth.configured) { message("SHEGAMES belum aktif", "Fitur akun situs belum dikonfigurasi. Hubungi admin.", `<a class="g-btn" href="index.html">Kembali ke SHEDINO</a>`); return; }
    let st = null;
    try { st = await Auth.getState(); } catch (e) { st = null; }
    if (!st) { message("Masuk untuk bermain", "SHEGAMES hanya untuk karyawan yang sudah punya akun dan disetujui admin.", `<a class="g-btn" href="masuk.html?next=shegames.html">Masuk atau daftar</a>`); return; }
    if (!st.profile || st.profile.status !== "approved") { message("Akun menunggu persetujuan", "Akun Anda sudah terdaftar tetapi belum disetujui admin. Coba lagi setelah disetujui.", `<a class="g-btn ghost" href="index.html">Kembali ke SHEDINO</a>`); return; }
    try { await refreshStatus(); }
    catch (e) { message("SHEGAMES belum siap", esc(e.message) + " Pastikan admin sudah menjalankan supabase/games.sql.", `<a class="g-btn ghost" href="index.html">Kembali ke SHEDINO</a>`); return; }
    if (!ST.profile || !ST.profile.department) openDept();
    route();
  }
  boot();
})();
