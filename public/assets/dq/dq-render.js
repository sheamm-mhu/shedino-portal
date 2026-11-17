/* Daily Quotes: menyusun poster di canvas (latar, orang, lapisan depan, teks) dan menghapus latar foto di browser.
   Semua pemrosesan berjalan di perangkat pengguna. Foto tidak dikirim ke server mana pun, kecuali poster jadi yang sengaja dikirim. */
(function (root) {
  "use strict";
  const FONTS = { display: '"Bricolage Grotesque","Segoe UI",system-ui,Arial,sans-serif', body: '"Figtree","Segoe UI",system-ui,Arial,sans-serif', serif: 'Georgia,"Times New Roman",serif' };
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
  const todayText = (d = new Date()) => String(d.getDate()).padStart(2, "0") + "/" + MONTHS[d.getMonth()] + "/" + String(d.getFullYear()).slice(2);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fontStr = (f, px) => `${f.italic ? "italic " : ""}${f.weight} ${Math.round(px * 100) / 100}px ${FONTS[f.font] || FONTS.body}`;

  function loadImage(src) {
    return new Promise((res, rej) => {
      const i = new Image(); if (/^https?:/i.test(src)) i.crossOrigin = "anonymous";
      i.onload = () => res(i); i.onerror = () => rej(new Error("Gambar tidak dapat dimuat.")); i.src = src;
    });
  }
  async function ensureFonts() {
    try { await Promise.all([document.fonts.load('800 32px "Bricolage Grotesque"'), document.fonts.load('600 32px "Figtree"'), document.fonts.load('italic 500 32px "Figtree"')]); } catch (e) { /* pakai font cadangan */ }
  }

  /* ---------- Teks: pecah baris dan kecilkan huruf sampai muat di kotak ---------- */
  function breakWord(ctx, w, maxW) {   // kata yang lebih lebar dari kotak dipatahkan per huruf
    const parts = []; let cur = "";
    for (const ch of w) { const t = cur + ch; if (cur && ctx.measureText(t).width > maxW) { parts.push(cur); cur = ch; } else cur = t; }
    if (cur) parts.push(cur); return parts;
  }
  function wrapLines(ctx, text, maxW, brk) {
    const out = [];
    for (const para of String(text).split(/\n/)) {
      const words = para.split(/\s+/).filter(Boolean); let line = "";
      if (!words.length) { out.push(""); continue; }
      for (const w of words) {
        if (brk && ctx.measureText(w).width > maxW) {
          if (line) { out.push(line); line = ""; }
          const ps = breakWord(ctx, w, maxW); for (let i = 0; i < ps.length - 1; i++) out.push(ps[i]); line = ps[ps.length - 1]; continue;
        }
        const t = line ? line + " " + w : w; if (!line || ctx.measureText(t).width <= maxW) line = t; else { out.push(line); line = w; }
      }
      out.push(line);
    }
    return out;
  }
  /* Urutan: (1) kata utuh, huruf boleh dikecilkan sampai 80%; (2) bila ada kata yang tetap terlalu panjang, patahkan per huruf ke baris berikutnya,
     huruf dikecilkan seperlunya sampai 62%; (3) bila masih tidak muat, potong dengan tanda elipsis dan beri tahu. */
  function fitText(ctx, text, f, W, H) {
    const bw = f.w / 100 * W, bh = f.h / 100 * H, start = f.size / 100 * H, t = f.upper ? String(text).toUpperCase() : String(text);
    const tryFit = (brk, lowest) => {
      for (let px = start; px >= start * lowest - 0.01; px -= Math.max(0.75, start * 0.03)) {
        ctx.font = fontStr(f, px); const lines = wrapLines(ctx, t, bw, brk), lh = px * 1.22, widest = Math.max(0, ...lines.map(l => ctx.measureText(l).width));
        if (lines.length <= f.maxlines && lines.length * lh <= bh * 1.03 && widest <= bw * 1.001) return { lines, px, lh, cut: false };
      }
      return null;
    };
    const r = tryFit(false, 0.8) || tryFit(true, 0.62); if (r) return r;
    const min = start * 0.62; ctx.font = fontStr(f, min); let lines = wrapLines(ctx, t, bw, true).slice(0, f.maxlines), last = lines[lines.length - 1] || "";
    while (last && ctx.measureText(last + "\u2026").width > bw) last = last.slice(0, -1);
    lines[lines.length - 1] = last + "\u2026";
    return { lines, px: min, lh: min * 1.22, cut: true };
  }
  function drawField(ctx, f, text, W, H) {
    if (!String(text || "").trim()) return null;
    const fit = fitText(ctx, text, f, W, H), bx = f.x / 100 * W, by = f.y / 100 * H, bw = f.w / 100 * W, bh = f.h / 100 * H;
    ctx.save(); ctx.font = fontStr(f, fit.px); ctx.fillStyle = f.color; ctx.textBaseline = "middle"; ctx.textAlign = f.align;
    if (f.shadow) { ctx.shadowColor = "rgba(0,0,0,.65)"; ctx.shadowBlur = fit.px * 0.18; ctx.shadowOffsetY = fit.px * 0.05; }
    const total = fit.lines.length * fit.lh, x = f.align === "left" ? bx : f.align === "right" ? bx + bw : bx + bw / 2;
    fit.lines.forEach((l, i) => ctx.fillText(l, x, by + (bh - total) / 2 + fit.lh * (i + 0.5)));
    ctx.restore(); return fit;
  }

  /* ---------- Orang ---------- */
  const bboxCache = new WeakMap();
  function personBox(src) {
    if (src.dq) return src.dq.box;
    if (bboxCache.has(src)) return bboxCache.get(src);
    const W = src.width || src.naturalWidth, H = src.height || src.naturalHeight, k = Math.min(1, 256 / Math.max(W, H)), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 24) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const box = x1 < 0 ? { x: 0, y: 0, w: W, h: H } : { x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k };
    bboxCache.set(src, box); return box;
  }
  let _fadeTmp = null;
  function drawFaded(ctx, draw, x, y, w, h, frac) {   // gambar dengan bagian bawah memudar halus (mulus, bukan garis potong keras)
    w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h)); if (!_fadeTmp) _fadeTmp = document.createElement("canvas");
    if (_fadeTmp.width < w || _fadeTmp.height < h) { _fadeTmp.width = Math.max(_fadeTmp.width, w); _fadeTmp.height = Math.max(_fadeTmp.height, h); }
    const t = _fadeTmp.getContext("2d"); t.globalCompositeOperation = "source-over"; t.clearRect(0, 0, _fadeTmp.width, _fadeTmp.height); draw(t);
    const y0 = h * (1 - frac), g = t.createLinearGradient(0, y0, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.35, "rgba(0,0,0,0.12)"); g.addColorStop(0.7, "rgba(0,0,0,0.55)"); g.addColorStop(1, "rgba(0,0,0,1)");
    t.globalCompositeOperation = "destination-out"; t.fillStyle = g; t.fillRect(0, y0, w, h - y0 + 1); t.globalCompositeOperation = "source-over";
    ctx.drawImage(_fadeTmp, 0, 0, w, h, x, y, w, h);
  }
  function drawPerson(ctx, T, p, W, H) {
    const sx = T.photo.x / 100 * W, sy = T.photo.y / 100 * H, sw = T.photo.w / 100 * W, sh = T.photo.h / 100 * H, z = clamp(p.zoom || 1, 0.3, 4);
    if (p.cut) {
      const b = personBox(p.src), s = Math.min(sw / b.w, sh / b.h) * z, dw = b.w * s, dh = b.h * s;
      const px0 = sx + sw / 2 - dw / 2 + (p.dx || 0) * sw, py0 = sy + sh - dh + (p.dy || 0) * sh, fr = clamp(p.fade || 0, 0, 100) / 100 * 0.4;
      if (fr > 0.001) drawFaded(ctx, t => t.drawImage(p.src, b.x, b.y, b.w, b.h, 0, 0, Math.ceil(dw), Math.ceil(dh)), px0, py0, dw, dh, fr);
      else ctx.drawImage(p.src, b.x, b.y, b.w, b.h, px0, py0, dw, dh);
    } else {
      const iw = p.src.width || p.src.naturalWidth, ih = p.src.height || p.src.naturalHeight, s = Math.max(sw / iw, sh / ih) * z, dw = iw * s, dh = ih * s;
      const fr = clamp(p.fade || 0, 0, 100) / 100 * 0.4, ox = sw / 2 - dw / 2 + (p.dx || 0) * sw, oy = sh / 2 - dh / 2 + (p.dy || 0) * sh;
      if (fr > 0.001) drawFaded(ctx, t => { t.beginPath(); t.rect(0, 0, Math.ceil(sw), Math.ceil(sh)); t.save(); t.clip(); t.drawImage(p.src, ox, oy, dw, dh); t.restore(); }, sx, sy, sw, sh, fr);
      else { ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip(); ctx.drawImage(p.src, sx + ox, sy + oy, dw, dh); ctx.restore(); }
    }
  }
  function placeholder(ctx, T, W, H) {   // siluet contoh untuk pratinjau templat bila belum ada foto
    const sx = T.photo.x / 100 * W, sy = T.photo.y / 100 * H, sw = T.photo.w / 100 * W, sh = T.photo.h / 100 * H, cx = sx + sw / 2, hd = Math.min(sw, sh) * 0.17;
    ctx.save(); ctx.fillStyle = "rgba(148,163,184,.55)"; ctx.beginPath(); ctx.arc(cx, sy + sh * 0.28, hd, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - sw * 0.34, sy + sh); ctx.quadraticCurveTo(cx - sw * 0.34, sy + sh * 0.5, cx, sy + sh * 0.5); ctx.quadraticCurveTo(cx + sw * 0.34, sy + sh * 0.5, cx + sw * 0.34, sy + sh); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  /* ---------- Poster ---------- */
  function render(canvas, T, assets, state, opts) {
    opts = opts || {}; const W = Math.round(opts.width || T.w), H = Math.round(W * T.h / T.w);
    if (canvas.width !== W) canvas.width = W; if (canvas.height !== H) canvas.height = H;
    const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#0F172A"; ctx.fillRect(0, 0, W, H);
    if (assets.back) ctx.drawImage(assets.back, 0, 0, W, H);
    if (state.person) drawPerson(ctx, T, state.person, W, H); else if (opts.placeholder) placeholder(ctx, T, W, H);
    if (assets.front) ctx.drawImage(assets.front, 0, 0, W, H);
    const cut = [];
    for (const f of T.fields) { const txt = (state.texts && state.texts[f.key] != null && state.texts[f.key] !== "") ? state.texts[f.key] : (opts.samples ? f.sample : ""); const r = drawField(ctx, f, txt, W, H); if (r && r.cut) cut.push(f.key); }
    return { cut };
  }
  async function toJpegBlob(canvas, maxBytes) {
    for (const q of [0.92, 0.86, 0.8, 0.74, 0.68, 0.6, 0.5, 0.4]) {
      const b = await new Promise(r => canvas.toBlob(r, "image/jpeg", q));
      if (!b) throw new Error("Gambar tidak dapat dibuat di perangkat ini.");
      if (!maxBytes || b.size <= maxBytes) return b;
    }
    throw new Error("Ukuran gambar terlalu besar.");
  }

  /* ---------- Foto: siapkan dan hapus latar ---------- */
  async function prepPhoto(file, maxSide) {
    maxSide = maxSide || 1280;
    if (!file || !/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type || "image/jpeg") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || "")) throw new Error("Gunakan foto JPG, PNG, atau WebP.");
    if (file.size > 25 * 1024 * 1024) throw new Error("Ukuran foto melebihi 25 MB.");
    let src;
    try { src = await createImageBitmap(file); } catch (e) {
      src = await new Promise((res, rej) => { const i = new Image(), u = URL.createObjectURL(file); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error("Foto tidak dapat dibaca. Coba foto lain.")); }; i.src = u; });
    }
    const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight, k = Math.min(1, maxSide / Math.max(w0, h0));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k)); c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    if (src.close) src.close(); return c;
  }
  function hasTransparency(c) {
    const k = Math.min(1, 128 / Math.max(c.width, c.height)), w = Math.max(1, Math.round(c.width * k)), h = Math.max(1, Math.round(c.height * k)), t = document.createElement("canvas"); t.width = w; t.height = h;
    const x = t.getContext("2d", { willReadFrequently: true }); x.drawImage(c, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data; let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) n++;
    return n / (w * h) > 0.02;
  }
  let _seg = null, _segP = null;
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Mesin hapus latar tidak dapat dimuat.")); document.head.appendChild(s); });
  async function getSegmenter(base) {
    if (_seg) return _seg;
    if (!_segP) _segP = (async () => {
      if (!root.SelfieSegmentation) await loadScript(base + "selfie_segmentation.js");
      const ss = new root.SelfieSegmentation({ locateFile: f => base + f }); ss.setOptions({ modelSelection: 0 }); await ss.initialize(); _seg = ss; return ss;
    })().catch(e => { _segP = null; throw e; });
    return _segP;
  }
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- Penghalusan tepi: filter berpemandu (tepi topeng mengikuti tepi foto asli) ---------- */
  function boxFilter(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      const row = y * w; let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) { tmp[row + x] = acc / n; acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) { out[y * w + x] = acc / n; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
    }
    return out;
  }
  function guided(I, p, w, h, r, eps) {
    const N = w * h, Ip = new Float32Array(N), II = new Float32Array(N);
    for (let i = 0; i < N; i++) { Ip[i] = I[i] * p[i]; II[i] = I[i] * I[i]; }
    const mI = boxFilter(I, w, h, r), mp = boxFilter(p, w, h, r), mIp = boxFilter(Ip, w, h, r), mII = boxFilter(II, w, h, r), a = new Float32Array(N), b = new Float32Array(N);
    for (let i = 0; i < N; i++) { const v = mII[i] - mI[i] * mI[i], c = mIp[i] - mI[i] * mp[i]; a[i] = c / (v + eps); b[i] = mp[i] - a[i] * mI[i]; }
    const ma = boxFilter(a, w, h, r), mb = boxFilter(b, w, h, r), q = new Float32Array(N);
    for (let i = 0; i < N; i++) q[i] = clamp(ma[i] * I[i] + mb[i], 0, 1);
    return q;
  }
  /* Komponen terhubung pada topeng biner kecil: buang serpihan terpisah, tutup lubang kecil */
  function components(bin, w, h, wantBg) {
    const lab = new Int32Array(w * h), areas = [0]; let n = 0; const st = [];
    for (let s0 = 0; s0 < w * h; s0++) {
      if (lab[s0] || (bin[s0] ? 0 : 1) !== (wantBg ? 1 : 0)) continue;
      n++; let area = 0; st.push(s0); lab[s0] = n;
      while (st.length) {
        const i = st.pop(); area++; const x = i % w, y = (i / w) | 0;
        if (x > 0 && !lab[i - 1] && (bin[i - 1] ? 0 : 1) === (wantBg ? 1 : 0)) { lab[i - 1] = n; st.push(i - 1); }
        if (x < w - 1 && !lab[i + 1] && (bin[i + 1] ? 0 : 1) === (wantBg ? 1 : 0)) { lab[i + 1] = n; st.push(i + 1); }
        if (y > 0 && !lab[i - w] && (bin[i - w] ? 0 : 1) === (wantBg ? 1 : 0)) { lab[i - w] = n; st.push(i - w); }
        if (y < h - 1 && !lab[i + w] && (bin[i + w] ? 0 : 1) === (wantBg ? 1 : 0)) { lab[i + w] = n; st.push(i + w); }
      }
      areas.push(area);
    }
    return { lab, areas, n };
  }
  function cleanZone(m, W, H) {   // m: topeng penuh 0..1. Hasil: daerah yang boleh terisi (1) dan kotak orang
    const k = Math.min(1, 320 / Math.max(W, H)), w = Math.max(8, Math.round(W * k)), h = Math.max(8, Math.round(H * k)), bin = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bin[y * w + x] = m[Math.min(H - 1, Math.round(y / k)) * W + Math.min(W - 1, Math.round(x / k))] > 0.5 ? 1 : 0;
    const fg = components(bin, w, h, false); let big = 0; for (let i = 1; i <= fg.n; i++) if (fg.areas[i] > big) big = fg.areas[i];
    const keep = new Uint8Array(fg.n + 1); for (let i = 1; i <= fg.n; i++) keep[i] = fg.areas[i] >= big * 0.06 ? 1 : 0;
    const zone = new Uint8Array(w * h); let fgArea = 0; for (let i = 0; i < w * h; i++) if (fg.lab[i] && keep[fg.lab[i]]) { zone[i] = 1; fgArea++; }
    const bg = components(zone, w, h, true), border = new Set();
    for (let x = 0; x < w; x++) { border.add(bg.lab[x]); border.add(bg.lab[(h - 1) * w + x]); } for (let y = 0; y < h; y++) { border.add(bg.lab[y * w]); border.add(bg.lab[y * w + w - 1]); }
    for (let i = 0; i < w * h; i++) { const l = bg.lab[i]; if (l && !border.has(l) && bg.areas[l] <= fgArea * 0.004) zone[i] = 1; }   // lubang kecil ditutup
    const c = document.createElement("canvas"); c.width = w; c.height = h; const cx = c.getContext("2d"), id = cx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = zone[i] ? 255 : 0; } cx.putImageData(id, 0, 0);
    const f = document.createElement("canvas"); f.width = W; f.height = H; const fx = f.getContext("2d", { willReadFrequently: true }); fx.imageSmoothingQuality = "high"; fx.drawImage(c, 0, 0, W, H);
    const fd = fx.getImageData(0, 0, W, H).data, out = new Float32Array(W * H); for (let i = 0; i < W * H; i++) out[i] = fd[i * 4 + 3] > 20 ? 1 : 0;
    return out;
  }

  /* ---------- Hasil potong: lapisan alfa dasar + coretan manual, disusun ulang bila penggeser atau kuas berubah ---------- */
  function boxOf(alpha, W, H) {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x] > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? { x: 0, y: 0, w: W, h: H } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  function attach(canvas, base, off) {
    const W = canvas.width, H = canvas.height, ctx = canvas.getContext("2d", { willReadFrequently: true }), img = ctx.getImageData(0, 0, W, H);
    const meta = { W, H, base, er: new Uint8Array(W * H), ke: new Uint8Array(W * H), img, edge: 0, off: off == null ? 0.56 : off, box: boxOf(base, W, H) };
    canvas.dq = meta; recompose(canvas); return meta;
  }
  function recompose(canvas, rect) {
    const m = canvas.dq, W = m.W, H = m.H, t = m.off + m.edge * 0.05, lo = t - 0.1, hi = t + 0.1, r = rect || { x: 0, y: 0, w: W, h: H }, d = m.img.data;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const i = y * W + x; let a = smooth(lo, hi, m.base[i]); const e = m.er[i] / 255, k = m.ke[i] / 255; a = Math.max(k, Math.min(a, 1 - e)); d[i * 4 + 3] = Math.round(a * 255);
    }
    canvas.getContext("2d").putImageData(m.img, 0, 0, r.x, r.y, r.w, r.h);
  }
  function setEdge(canvas, edge) { if (canvas.dq) { canvas.dq.edge = clamp(edge, -3, 3); recompose(canvas); } }
  function paint(canvas, cx, cy, rad, mode) {   // mode: "erase" atau "restore"; koordinat dalam piksel foto
    const m = canvas.dq; if (!m) return; const W = m.W, H = m.H, x0 = Math.max(0, Math.floor(cx - rad)), y0 = Math.max(0, Math.floor(cy - rad)), x1 = Math.min(W - 1, Math.ceil(cx + rad)), y1 = Math.min(H - 1, Math.ceil(cy + rad));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy); if (d > rad) continue; const v = Math.round(255 * clamp((1 - d / rad) * 2.2, 0, 1)), i = y * W + x;
      if (mode === "erase") { if (v > m.er[i]) m.er[i] = v; if (255 - v < m.ke[i]) m.ke[i] = 255 - v; } else { if (v > m.ke[i]) m.ke[i] = v; if (255 - v < m.er[i]) m.er[i] = 255 - v; }
    }
    if (x1 >= x0 && y1 >= y0) recompose(canvas, { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  function resetBrush(canvas) { const m = canvas.dq; if (m) { m.er.fill(0); m.ke.fill(0); recompose(canvas); } }
  function brushUsed(canvas) { const m = canvas.dq; if (!m) return false; for (let i = 0; i < m.er.length; i += 7) if (m.er[i] || m.ke[i]) return true; return false; }
  function wrapTransparent(canvas) {   // PNG yang sudah tanpa latar: pakai alfanya sebagai dasar supaya kuas dan penggeser tetap bekerja
    const W = canvas.width, H = canvas.height, d = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data, base = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) base[i] = d[i * 4 + 3] / 255; attach(canvas, base, 0.5); return canvas;
  }
  function personMap(T, p, W, H) {   // kebalikan dari drawPerson (mode potong): titik pratinjau -> piksel foto
    const sx = T.photo.x / 100 * W, sy = T.photo.y / 100 * H, sw = T.photo.w / 100 * W, sh = T.photo.h / 100 * H, z = clamp(p.zoom || 1, 0.3, 4), b = personBox(p.src), s = Math.min(sw / b.w, sh / b.h) * z, dw = b.w * s, dh = b.h * s;
    const left = sx + sw / 2 - dw / 2 + (p.dx || 0) * sw, top = sy + sh - dh + (p.dy || 0) * sh; return { s, px: x => b.x + (x - left) / s, py: y => b.y + (y - top) / s };
  }

  /* ---------- Hapus latar: dua tahap + pembersihan + penghalusan tepi ---------- */
  async function maskOf(ss, canvas) {
    const got = new Promise((res, rej) => { ss.onResults(res); setTimeout(() => rej(new Error("Penghapusan latar terlalu lama.")), 60000); });
    await ss.send({ image: canvas }); const r = await got, S = canvas.width, Hh = canvas.height, m = document.createElement("canvas"); m.width = S; m.height = Hh;
    const x = m.getContext("2d", { willReadFrequently: true }); x.drawImage(r.segmentationMask, 0, 0, S, Hh); return m;
  }
  const alphaOf = c => { const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data, a = new Float32Array(c.width * c.height); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255; return a; };
  async function cutout(photo, base, opts) {
    opts = Object.assign({ div: 70, eps: 3e-3, pre: 4, edge: 0 }, opts || {});
    const ss = await getSegmenter(base || "assets/vendor/mediapipe/"), W = photo.width, H = photo.height;
    const m1c = await maskOf(ss, photo); let m = alphaOf(m1c);
    let share = 0; for (let i = 0; i < m.length; i += 5) if (m[i] > 0.5) share++; share = share * 5 / (W * H);
    if (share < 0.04) throw new Error("Orang pada foto tidak terdeteksi. Gunakan foto yang menampakkan wajah dan badan dengan jelas.");
    // tahap 2: potong ulang hanya pada area sekitar orang, supaya tepinya jauh lebih tajam
    const zone1 = cleanZone(m, W, H); const b1 = boxOf(zone1, W, H), padx = Math.round(b1.w * 0.1), pady = Math.round(b1.h * 0.08);
    const cx0 = Math.max(0, b1.x - padx), cy0 = Math.max(0, b1.y - pady), cw = Math.min(W, b1.x + b1.w + padx) - cx0, ch = Math.min(H, b1.y + b1.h + pady) - cy0;
    if (cw * ch < W * H * 0.85) {
      const S = Math.min(1024, Math.max(cw, ch)), sc = S / Math.max(cw, ch), sq = document.createElement("canvas"); sq.width = S; sq.height = S; const sx = sq.getContext("2d");
      sx.fillStyle = "#808080"; sx.fillRect(0, 0, S, S); const ox = (S - cw * sc) / 2, oy = (S - ch * sc) / 2; sx.drawImage(photo, cx0, cy0, cw, ch, ox, oy, cw * sc, ch * sc);
      const m2c = await maskOf(ss, sq), full = document.createElement("canvas"); full.width = W; full.height = H; const fx = full.getContext("2d", { willReadFrequently: true }); fx.imageSmoothingQuality = "high";
      fx.drawImage(m2c, ox, oy, cw * sc, ch * sc, cx0, cy0, cw, ch); const m2 = alphaOf(full);
      let a1 = 0, a2 = 0; for (let y = cy0; y < cy0 + ch; y += 2) for (let x = cx0; x < cx0 + cw; x += 2) { const i = y * W + x; if (m[i] > 0.5) a1++; if (m2[i] > 0.5) a2++; }
      if (a1 > 0 && a2 > a1 * 0.6 && a2 < a1 * 1.6) m = m2;   // hasil tahap 2 dipakai bila masuk akal; bila tidak, tetap tahap 1
    }
    // bersihkan serpihan dan lubang kecil, lalu haluskan tepi mengikuti garis tepi foto asli
    const zone = cleanZone(m, W, H), g = new Float32Array(W * H), pd = photo.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    for (let i = 0; i < W * H; i++) g[i] = (0.299 * pd[i * 4] + 0.587 * pd[i * 4 + 1] + 0.114 * pd[i * 4 + 2]) / 255;
    if (opts.pre > 0) { m = boxFilter(boxFilter(m, W, H, opts.pre), W, H, opts.pre); }
    const q = guided(g, m, W, H, Math.max(4, Math.round(Math.max(W, H) / opts.div)), opts.eps), baseA = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) baseA[i] = q[i] * zone[i];
    const out = document.createElement("canvas"); out.width = W; out.height = H; out.getContext("2d").drawImage(photo, 0, 0); const meta = attach(out, baseA); if (opts.edge) { meta.edge = opts.edge; recompose(out); } return out;
  }

  root.DQ = { setEdge, paint, resetBrush, brushUsed, wrapTransparent, personMap, FONTS, todayText, loadImage, ensureFonts, fitText, render, toJpegBlob, prepPhoto, hasTransparency, cutout, personBox, clamp };
})(typeof self !== "undefined" ? self : this);
