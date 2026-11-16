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
  function wrapLines(ctx, text, maxW) {
    const out = [];
    for (const para of String(text).split(/\n/)) {
      const words = para.split(/\s+/).filter(Boolean); let line = "";
      if (!words.length) { out.push(""); continue; }
      for (const w of words) { const t = line ? line + " " + w : w; if (!line || ctx.measureText(t).width <= maxW) line = t; else { out.push(line); line = w; } }
      out.push(line);
    }
    return out;
  }
  function fitText(ctx, text, f, W, H) {
    const bw = f.w / 100 * W, bh = f.h / 100 * H, start = f.size / 100 * H, min = start * 0.62, t = f.upper ? String(text).toUpperCase() : String(text);
    for (let px = start; px >= min; px -= Math.max(0.75, start * 0.03)) {
      ctx.font = fontStr(f, px); const lines = wrapLines(ctx, t, bw), lh = px * 1.22;
      const widest = Math.max(0, ...lines.map(l => ctx.measureText(l).width));
      if (lines.length <= f.maxlines && lines.length * lh <= bh * 1.03 && widest <= bw * 1.001) return { lines, px, lh, cut: false };
    }
    ctx.font = fontStr(f, min); let lines = wrapLines(ctx, t, bw).slice(0, f.maxlines), last = lines[lines.length - 1] || "";
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
    if (bboxCache.has(src)) return bboxCache.get(src);
    const W = src.width || src.naturalWidth, H = src.height || src.naturalHeight, k = Math.min(1, 256 / Math.max(W, H)), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 24) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const box = x1 < 0 ? { x: 0, y: 0, w: W, h: H } : { x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k };
    bboxCache.set(src, box); return box;
  }
  function drawPerson(ctx, T, p, W, H) {
    const sx = T.photo.x / 100 * W, sy = T.photo.y / 100 * H, sw = T.photo.w / 100 * W, sh = T.photo.h / 100 * H, z = clamp(p.zoom || 1, 0.3, 4);
    if (p.cut) {
      const b = personBox(p.src), s = Math.min(sw / b.w, sh / b.h) * z, dw = b.w * s, dh = b.h * s;
      ctx.drawImage(p.src, b.x, b.y, b.w, b.h, sx + sw / 2 - dw / 2 + (p.dx || 0) * sw, sy + sh - dh + (p.dy || 0) * sh, dw, dh);
    } else {
      const iw = p.src.width || p.src.naturalWidth, ih = p.src.height || p.src.naturalHeight, s = Math.max(sw / iw, sh / ih) * z, dw = iw * s, dh = ih * s;
      ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
      ctx.drawImage(p.src, sx + sw / 2 - dw / 2 + (p.dx || 0) * sw, sy + sh / 2 - dh / 2 + (p.dy || 0) * sh, dw, dh); ctx.restore();
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
  async function cutout(photo, base) {
    const ss = await getSegmenter(base || "assets/vendor/mediapipe/"), W = photo.width, H = photo.height;
    const got = new Promise((res, rej) => { ss.onResults(res); setTimeout(() => rej(new Error("Penghapusan latar terlalu lama.")), 60000); });
    await ss.send({ image: photo }); const r = await got;
    const m = document.createElement("canvas"); m.width = W; m.height = H; const mx = m.getContext("2d", { willReadFrequently: true }); mx.drawImage(r.segmentationMask, 0, 0, W, H);
    const md = mx.getImageData(0, 0, W, H).data, out = document.createElement("canvas"); out.width = W; out.height = H; const ox = out.getContext("2d", { willReadFrequently: true });
    ox.drawImage(photo, 0, 0); const od = ox.getImageData(0, 0, W, H); let kept = 0;
    for (let i = 0; i < od.data.length; i += 4) { const a = smooth(0.3, 0.7, md[i + 3] / 255); od.data[i + 3] = Math.round(255 * a); if (a > 0.5) kept++; }
    ox.putImageData(od, 0, 0); const share = kept / (W * H);
    if (share < 0.04) throw new Error("Orang pada foto tidak terdeteksi. Gunakan foto yang menampakkan wajah dan badan dengan jelas.");
    return out;
  }

  root.DQ = { FONTS, todayText, loadImage, ensureFonts, fitText, render, toJpegBlob, prepPhoto, hasTransparency, cutout, personBox, clamp };
})(typeof self !== "undefined" ? self : this);
