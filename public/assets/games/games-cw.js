/* SHEGAMES: pembuat kotak teka-teki silang otomatis.
   Menempatkan semua kata dengan perpotongan huruf, memastikan tidak ada huruf bersebelahan yang membentuk kata tak sengaja,
   dan memberi nomor kotak. Aturan di sini sama dengan pemeriksaan server (game_check_layout). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GamesCW = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function rng(seed) {                                   // mulberry32: hasil sama untuk benih yang sama
    let a = (seed >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const key = (r, c) => r + "," + c;

  function attempt(words, rand, maxSize) {
    const cells = new Map();                             // "r,c" -> { ch, A: idx|-1, D: idx|-1 }
    const placed = [];                                   // { w, row, col, dir }
    let minR = 0, maxR = 0, minC = 0, maxC = 0;
    const bbox = (r0, c0, dir, len) => ({
      minR: Math.min(minR, r0), maxR: Math.max(maxR, dir === "D" ? r0 + len - 1 : r0),
      minC: Math.min(minC, c0), maxC: Math.max(maxC, dir === "A" ? c0 + len - 1 : c0)
    });
    function check(word, r0, c0, dir) {
      const dr = dir === "D" ? 1 : 0, dc = 1 - dr, len = word.length;
      const b = bbox(r0, c0, dir, len);
      if (b.maxR - b.minR + 1 > maxSize || b.maxC - b.minC + 1 > maxSize) return -1;
      const before = cells.get(key(r0 - dr, c0 - dc)), after = cells.get(key(r0 + dr * len, c0 + dc * len));
      if (before || after) return -1;                    // ujung kata harus kosong
      let cross = 0;
      for (let i = 0; i < len; i++) {
        const r = r0 + dr * i, c = c0 + dc * i, cell = cells.get(key(r, c));
        if (cell) {
          if (cell.ch !== word[i]) return -1;            // huruf bertabrakan
          if ((dir === "A" ? cell.A : cell.D) >= 0) return -1;   // kata sejenis bertumpuk
          cross++;
        } else {
          const n1 = cells.get(key(r + dc, c + dr)), n2 = cells.get(key(r - dc, c - dr));
          if (n1 || n2) return -1;                       // menempel di samping huruf lain
        }
      }
      return cross;
    }
    function put(wi, word, r0, c0, dir) {
      const dr = dir === "D" ? 1 : 0, dc = 1 - dr;
      for (let i = 0; i < word.length; i++) {
        const k = key(r0 + dr * i, c0 + dc * i); let cell = cells.get(k);
        if (!cell) { cell = { ch: word[i], A: -1, D: -1 }; cells.set(k, cell); }
        cell[dir] = wi;
      }
      const b = bbox(r0, c0, dir, word.length); minR = b.minR; maxR = b.maxR; minC = b.minC; maxC = b.maxC;
      placed.push({ wi, row: r0, col: c0, dir });
    }
    // urutan: kata panjang dulu, dengan sedikit pengacakan
    const order = words.map((w, i) => i).sort((a, b) => (words[b].word.length - words[a].word.length) + (rand() - 0.5) * 5);
    const first = order[0];
    put(first, words[first].word, 0, 0, rand() < 0.5 ? "A" : "D");
    let left = order.slice(1), progress = true;
    while (left.length && progress) {
      progress = false; const next = [];
      for (const wi of left) {
        const word = words[wi].word, cands = [];
        for (const [k, cell] of cells) {
          const [r, c] = k.split(",").map(Number);
          for (let i = 0; i < word.length; i++) {
            if (word[i] !== cell.ch) continue;
            if (cell.A >= 0 && cell.D < 0) { const cr = check(word, r - i, c, "D"); if (cr > 0) cands.push({ r: r - i, c, dir: "D", cr }); }
            if (cell.D >= 0 && cell.A < 0) { const cr = check(word, r, c - i, "A"); if (cr > 0) cands.push({ r, c: c - i, dir: "A", cr }); }
          }
        }
        if (!cands.length) { next.push(wi); continue; }
        let best = null, bestScore = -1e9;
        for (const cd of cands) {
          const b = bbox(cd.r, cd.c, cd.dir, word.length), area = (b.maxR - b.minR + 1) * (b.maxC - b.minC + 1);
          const ratio = Math.max(b.maxR - b.minR + 1, b.maxC - b.minC + 1) / Math.min(b.maxR - b.minR + 1, b.maxC - b.minC + 1);
          const score = cd.cr * 6 - area / 12 - ratio * 1.5 + rand() * 3;
          if (score > bestScore) { bestScore = score; best = cd; }
        }
        put(wi, word, best.r, best.c, best.dir); progress = true;
      }
      left = next;
    }
    const rows = maxR - minR + 1, cols = maxC - minC + 1;
    let crossings = 0; for (const c of cells.values()) if (c.A >= 0 && c.D >= 0) crossings++;
    return { placed, unplacedIdx: left, rows, cols, minR, minC, crossings };
  }

  /* words: [{id, word}]. opts: seed, tries, maxSize. */
  function generate(words, opts) {
    opts = opts || {};
    const seed = opts.seed == null ? 1 : opts.seed, tries = opts.tries || 220, maxSize = opts.maxSize || 24;
    const list = [], seen = new Set(), dup = [];
    for (const w of words || []) {
      const t = String(w.word || "").toUpperCase().replace(/[^A-Z]/g, "");
      if (t.length < 2) continue;
      if (seen.has(t)) { dup.push(w.id); continue; }
      seen.add(t); list.push({ id: w.id, word: t });
    }
    if (!list.length) return { rows: 0, cols: 0, items: [], unplaced: [], duplicates: dup };
    const rand = rng(seed); let best = null;
    for (let i = 0; i < tries; i++) {
      const a = attempt(list, rand, maxSize);
      const score = (list.length - a.unplacedIdx.length) * 100000 - a.rows * a.cols * 10 - Math.abs(a.rows - a.cols) * 8 + a.crossings * 25;
      a.score = score;
      if (!best || score > best.score) best = a;
      if (!a.unplacedIdx.length && i > 40 && best.score === score && i > tries * 0.6) break;
    }
    // penomoran standar: kiri ke kanan, atas ke bawah; mendatar dan menurun di kotak awal yang sama berbagi nomor
    const starts = new Map();
    for (const p of best.placed) {
      const r = p.row - best.minR, c = p.col - best.minC;
      starts.set(key(r, c), { r, c });
    }
    const sorted = Array.from(starts.values()).sort((a, b) => a.r - b.r || a.c - b.c), numOf = new Map();
    sorted.forEach((s, i) => numOf.set(key(s.r, s.c), i + 1));
    const items = best.placed.map(p => ({ id: list[p.wi].id, num: numOf.get(key(p.row - best.minR, p.col - best.minC)), row: p.row - best.minR, col: p.col - best.minC, dir: p.dir }))
      .sort((a, b) => a.num - b.num || (a.dir === "A" ? -1 : 1));
    return { rows: best.rows, cols: best.cols, items, unplaced: best.unplacedIdx.map(i => list[i].id), duplicates: dup };
  }

  /* Pemeriksa independen (aturan yang sama dengan server) untuk uji dan pratinjau */
  function validate(layout, words) {
    const errs = [], map = new Map(words.map(w => [String(w.id), String(w.word).toUpperCase()]));
    const R = layout.rows, C = layout.cols, cell = {}, A = {}, D = {}, seen = new Set(), nums = {}, starts = {};
    layout.items.forEach((it, n) => {
      const w = map.get(String(it.id));
      if (!w) { errs.push("kata tidak ada"); return; }
      if (seen.has(it.id)) errs.push("kata ganda " + w); seen.add(it.id);
      const dr = it.dir === "D" ? 1 : 0, dc = 1 - dr;
      if (it.row < 0 || it.col < 0 || it.row + dr * (w.length - 1) >= R || it.col + dc * (w.length - 1) >= C) { errs.push("keluar kotak " + w); return; }
      for (let k = 0; k < w.length; k++) {
        const kk = key(it.row + dr * k, it.col + dc * k);
        if (cell[kk] && cell[kk] !== w[k]) errs.push("bertabrakan " + w);
        cell[kk] = w[k];
        const tbl = dr ? D : A; if (tbl[kk] != null) errs.push("bertumpuk " + w); tbl[kk] = n + 1;
      }
      const sk = key(it.row, it.col);
      if (starts[sk] != null && starts[sk] !== it.num) errs.push("nomor tidak konsisten");
      starts[sk] = it.num;
      if (nums[it.num] != null && nums[it.num] !== sk) errs.push("nomor dobel");
      nums[it.num] = sk;
    });
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const k = key(r, c); if (!cell[k]) continue;
      if (cell[key(r, c + 1)] && (!A[k] || !A[key(r, c + 1)] || A[k] !== A[key(r, c + 1)])) errs.push(`bersebelahan ${r},${c}`);
      if (cell[key(r + 1, c)] && (!D[k] || !D[key(r + 1, c)] || D[k] !== D[key(r + 1, c)])) errs.push(`bertumpuk ${r},${c}`);
    }
    if (layout.items.length !== words.length) errs.push(`jumlah ${layout.items.length}/${words.length}`);
    return errs;
  }
  return { generate, validate, rng };
});
