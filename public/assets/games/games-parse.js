/* SHEGAMES: pembaca dokumen soal (.docx, .xlsx, .csv, .txt, .pdf) dan pengurai soal pilihan ganda.
   Semua dibaca di browser admin; berkas tidak diunggah ke server. Tanpa pustaka luar, kecuali pdf.js untuk PDF. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GamesParse = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const dec = u8 => new TextDecoder("utf-8").decode(u8);
  const unxml = s => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&");
  const MAX_ENTRY = 40 * 1024 * 1024;

  /* ---------- ZIP (docx dan xlsx adalah berkas ZIP) ---------- */
  async function inflateRaw(u8) {
    if (typeof DecompressionStream === "function" && typeof Blob === "function" && typeof Response === "function") {
      try { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()); }
      catch (e) { if (typeof require !== "function") throw new Error("Berkas rusak atau tidak dapat dibuka."); }
    }
    if (typeof require === "function") return new Uint8Array(require("zlib").inflateRawSync(Buffer.from(u8)));
    throw new Error("Browser ini belum mendukung pembacaan berkas .docx atau .xlsx. Gunakan Chrome, Edge, Safari, atau Firefox versi terbaru.");
  }
  function zipEntries(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("Berkas ini bukan dokumen Word atau Excel yang valid.");
    const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    const out = new Map();
    for (let i = 0; i < n && p + 46 <= u8.length; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      out.set(dec(u8.subarray(p + 46, p + 46 + nl)), { method, csize, usize, off });
      p += 46 + nl + el + cl;
    }
    return { u8, dv, map: out };
  }
  async function zipRead(z, name) {
    const e = z.map.get(name);
    if (!e) return null;
    if (e.usize > MAX_ENTRY) throw new Error("Dokumen terlalu besar untuk dibaca.");
    const nl = z.dv.getUint16(e.off + 26, true), el = z.dv.getUint16(e.off + 28, true), start = e.off + 30 + nl + el;
    const raw = z.u8.subarray(start, start + e.csize);
    if (e.method === 0) return raw;
    if (e.method === 8) return inflateRaw(raw);
    throw new Error("Format kompresi dokumen tidak didukung.");
  }

  /* ---------- DOCX ---------- */
  function para(x) {
    let text = "", m;
    const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/?>|<w:cr\s*\/>/g;
    while ((m = re.exec(x))) text += m[1] != null ? unxml(m[1]) : m[0].startsWith("<w:tab") ? "\t" : "\n";
    const num = /<w:numPr>[\s\S]*?<\/w:numPr>/.exec(x);
    let numId = null, lvl = 0;
    if (num) { const a = /<w:numId w:val="(\d+)"/.exec(num[0]), b = /<w:ilvl w:val="(\d+)"/.exec(num[0]); numId = a ? a[1] : "0"; lvl = b ? +b[1] : 0; }
    // seluruh teks tebal atau disorot = kemungkinan penanda kunci jawaban
    const runs = x.match(/<w:r[ >][\s\S]*?<\/w:r>/g) || [];
    const tr = runs.filter(r => /<w:t(?:\s[^>]*)?>[\s\S]*?\S[\s\S]*?<\/w:t>/.test(r));
    const marked = tr.length > 0 && tr.every(r => /<w:b(?:\s[^>]*)?\/>|<w:highlight\s/.test(r) && !/<w:b w:val="(?:0|false)"/.test(r));
    return { text: text.replace(/\u00a0/g, " "), numId, lvl, marked };
  }
  async function readDocx(buf) {
    const z = zipEntries(buf), d = await zipRead(z, "word/document.xml");
    if (!d) throw new Error("Berkas ini bukan dokumen Word (.docx) yang valid.");
    const xml = dec(d), tables = [], lines = [];
    const re = /<w:tbl[ >][\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g;
    let m, qNum = null, qn = 0, on = 0;
    const OPT = /^\s*\*?\s*\(?[A-Ea-e][.)]\s+\S/, QUE = /^\s*(?:soal\s*)?\d{1,3}\s*[.)]\s+\S/i;
    while ((m = re.exec(xml))) {
      const x = m[0];
      if (x.startsWith("<w:tbl")) {
        const rows = (x.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).map(r => (r.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) || [])
          .map(c => (c.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(p => para(p).text.trim()).filter(Boolean).join("\n")));
        if (rows.length) tables.push(rows);
        continue;
      }
      const p = para(x); let t = p.text.trim();
      if (!t) { lines.push(""); continue; }
      // Penomoran otomatis Word tidak tersimpan sebagai teks: daftar pertama dianggap soal, daftar lain dianggap pilihan
      if (p.numId != null && !QUE.test(t) && !OPT.test(t)) {
        if (qNum == null) qNum = p.numId + ":" + p.lvl;
        if (p.numId + ":" + p.lvl === qNum) { qn += 1; on = 0; t = qn + ". " + t; }
        else if (qn > 0 && on < 5) { t = "ABCDE"[on] + ". " + t; on += 1; }
      } else if (QUE.test(t)) { qn += 1; on = 0; }
      if (p.marked && OPT.test(t) && !/^\s*\*/.test(t)) t = "*" + t;
      t.split("\n").forEach(l => lines.push(l));
    }
    return { text: lines.join("\n"), tables, boldKeys: true };
  }

  /* ---------- XLSX ---------- */
  const colIdx = ref => { let n = 0; for (const ch of String(ref).replace(/\d+/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  async function readXlsx(buf) {
    const z = zipEntries(buf);
    const names = Array.from(z.map.keys()).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
    if (!names.length) throw new Error("Berkas ini bukan lembar kerja Excel (.xlsx) yang valid.");
    const ssRaw = await zipRead(z, "xl/sharedStrings.xml");
    const shared = ssRaw ? (dec(ssRaw).match(/<si>[\s\S]*?<\/si>|<si\/>/g) || []).map(si => (si.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g) || []).map(t => unxml(t.replace(/<[^>]+>/g, ""))).join("")) : [];
    const xml = dec(await zipRead(z, names[0])), rows = [];
    for (const r of xml.match(/<row[ >][\s\S]*?<\/row>/g) || []) {
      const row = []; let m; const re = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      while ((m = re.exec(r))) {
        const ref = (/\br="([A-Z]+\d+)"/.exec(m[1]) || [])[1], t = (/\bt="(\w+)"/.exec(m[1]) || [])[1], inner = m[2] || "";
        const v = (/<v>([\s\S]*?)<\/v>/.exec(inner) || [])[1];
        let val = "";
        if (t === "s") val = shared[+v] || "";
        else if (t === "inlineStr") val = (inner.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g) || []).map(x => unxml(x.replace(/<[^>]+>/g, ""))).join("");
        else if (v != null) val = unxml(v);
        const ci = ref ? colIdx(ref) : row.length;
        while (row.length < ci) row.push("");
        row[ci] = String(val).trim();
      }
      if (row.some(c => c !== "")) rows.push(row);
    }
    return { rows };
  }

  /* ---------- CSV ---------- */
  function parseCsv(text) {
    text = String(text).replace(/^\uFEFF/, "");
    const first = text.split(/\r?\n/)[0] || "";
    const cnt = d => { let n = 0, q = false; for (const ch of first) { if (ch === '"') q = !q; else if (ch === d && !q) n++; } return n; };
    const delim = [",", ";", "\t"].sort((a, b) => cnt(b) - cnt(a))[0];
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur.trim()); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur.trim()); cur = ""; if (row.some(c => c !== "")) rows.push(row); row = []; }
      else cur += ch;
    }
    row.push(cur.trim()); if (row.some(c => c !== "")) rows.push(row);
    return { rows };
  }

  /* ---------- PDF (hanya di browser; memakai pdf.js yang disimpan di situs) ---------- */
  async function readPdf(buf) {
    const base = document.baseURI;
    const lib = await import(new URL("assets/vendor/pdfjs/pdf.min.mjs", base).href);
    lib.GlobalWorkerOptions.workerSrc = new URL("assets/vendor/pdfjs/pdf.worker.min.mjs", base).href;
    const doc = await lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    const lines = [];
    for (let n = 1; n <= Math.min(doc.numPages, 80); n++) {
      const tc = await (await doc.getPage(n)).getTextContent();
      const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0 }));
      items.sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);
      let cur = [], y = null;
      const flush = () => { if (cur.length) { cur.sort((a, b) => a.x - b.x); let t = ""; cur.forEach((i, k) => { if (k && i.x - (cur[k - 1].x + cur[k - 1].w) > 1.5 && !/\s$/.test(t)) t += " "; t += i.s; }); lines.push(t.trim()); } cur = []; };
      for (const i of items) { if (y != null && Math.abs(i.y - y) > 3) flush(); cur.push(i); y = i.y; }
      flush(); lines.push("");
    }
    const text = lines.join("\n");
    if (text.replace(/\s/g, "").length < 20) throw new Error("PDF ini berupa gambar atau hasil scan, sehingga teksnya tidak bisa dibaca. Gunakan PDF yang dibuat dari Word atau Excel, atau salin soalnya ke berkas .docx, .xlsx, atau .txt.");
    return { text };
  }

  /* ---------- Pengurai soal ---------- */
  const LET = "ABCDE";
  function validate(it) {
    const p = [];
    if (!String(it.q || "").trim()) p.push("Soal kosong");
    else if (it.q.length > 500) p.push("Soal lebih dari 500 karakter");
    const opts = (it.opts || []).map(o => String(o).trim());
    if (opts.filter(Boolean).length < 2) p.push("Pilihan kurang dari 2");
    if (opts.length > 5) p.push("Lebih dari 5 pilihan");
    if (opts.some(o => !o)) p.push("Ada pilihan kosong");
    if (opts.some(o => o.length > 200)) p.push("Ada pilihan lebih dari 200 karakter");
    if (new Set(opts.map(o => o.toLowerCase())).size !== opts.length) p.push("Pilihan kembar");
    if (it.key == null || it.key < 0 || it.key >= opts.length) p.push(it.multiKey ? "Lebih dari satu pilihan ditandai sebagai kunci" : "Tanpa kunci jawaban");
    if (String(it.expl || "").length > 600) p.push("Penjelasan lebih dari 600 karakter");
    return p;
  }
  const finish = it => { const o = { q: String(it.q || "").trim(), opts: (it.opts || []).map(x => String(x).trim()), key: it.key == null ? null : it.key, expl: String(it.expl || "").trim() }; if (it.multiKey) o.multiKey = true; o.problems = validate(o); return o; };

  function parseQuestionsText(text) {
    const QRE = /^\s*(?:soal\s*)?(\d{1,3})\s*[.)]\s+(.+)$/i;
    const ORE = /^\s*(\*?)\s*\(?([A-Ea-e])[.)]\s*(.+?)\s*(\*?)\s*$/;
    const KRE = /^\s*(?:jawaban|kunci(?:\s+jawaban)?|answer)\s*[:=]\s*\(?([A-Ea-e1-5])\)?[.)]?(?:\s+.*)?$/i;
    const ERE = /^\s*(?:penjelasan|pembahasan|alasan|explanation)\s*[:=]\s*(.*)$/i;
    const INL = /(?:^|\s)(\*?)\(?([A-E])[.)]\s+/g;
    const items = []; let cur = null, mode = "";
    const push = () => {
      if (!cur) return;
      const stars = cur.letters.map((l, i) => cur.star[i] ? i : -1).filter(i => i >= 0);
      if (cur.keyLetter != null) { const i = /\d/.test(cur.keyLetter) ? +cur.keyLetter - 1 : cur.letters.indexOf(cur.keyLetter.toUpperCase()); cur.key = i >= 0 && i < cur.opts.length ? i : null; }
      else if (stars.length === 1) cur.key = stars[0];
      else if (stars.length > 1) { cur.key = null; cur.multiKey = true; }
      items.push(finish(cur)); cur = null;
    };
    const addOpt = (star, letter, body) => { cur.opts.push(body.replace(/\s*\*$/, "").trim()); cur.letters.push(letter.toUpperCase()); cur.star.push(!!star); mode = "o"; };
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.replace(/\t/g, " ").trim();
      if (!line) continue;
      let m;
      if ((m = QRE.exec(line)) && !(cur && mode === "" && false)) { push(); cur = { q: m[2].trim(), opts: [], letters: [], star: [], key: null, keyLetter: null, expl: "" }; mode = "q";
        // pilihan sebaris di baris soal yang sama, mis. "1. Soal? A. x B. y"
        const idx = cur.q.search(/\s\*?\(?A[.)]\s+\S/);
        if (idx > 0 && /\s\*?\(?B[.)]\s+\S/.test(cur.q.slice(idx))) { const tail = cur.q.slice(idx); cur.q = cur.q.slice(0, idx).trim(); splitInline(tail); }
        continue; }
      if (!cur) continue;
      if ((m = KRE.exec(line))) { cur.keyLetter = m[1]; mode = "k"; continue; }
      if ((m = ERE.exec(line))) { cur.expl = m[1].trim(); mode = "e"; continue; }
      if (splitInline(line)) continue;
      if ((m = ORE.exec(line)) && (mode === "q" || mode === "o")) { addOpt(m[1] || m[4], m[2], m[3]); continue; }
      if (mode === "e") cur.expl += " " + line;
      else if (mode === "o" && cur.opts.length) cur.opts[cur.opts.length - 1] += " " + line;
      else if (mode === "q") cur.q += " " + line;
    }
    push();
    return items;
    function splitInline(line) {
      const marks = []; let m; INL.lastIndex = 0;
      while ((m = INL.exec(line))) marks.push({ at: m.index, end: INL.lastIndex, star: m[1], letter: m[2] });
      if (marks.length < 2 || marks[0].letter !== "A" || line.slice(0, marks[0].at).trim()) return false;
      for (let i = 0; i < marks.length; i++) if (marks[i].letter !== LET[i]) return false;
      marks.forEach((k, i) => { let body = line.slice(k.end, i + 1 < marks.length ? marks[i + 1].at : line.length).trim(); const st = k.star || /\*$/.test(body); addOpt(st, k.letter, body); });
      return true;
    }
  }

  function parseQuestionsRows(rows) {
    rows = (rows || []).map(r => r.map(c => String(c == null ? "" : c).trim()));
    const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    let h = -1, map = null;
    for (let i = 0; i < Math.min(rows.length, 6) && h < 0; i++) {
      const c = rows[i].map(norm), q = c.findIndex(x => /^(soal|pertanyaan|question)/.test(x));
      if (q < 0) continue;
      const opt = L => c.findIndex(x => x === L || x === "opsi " + L || x === "pilihan " + L || x === "jawaban " + L);
      const o = ["a", "b", "c", "d", "e"].map(opt);
      if (o[0] < 0 || o[1] < 0) continue;
      h = i; map = { q, o: o.filter(x => x >= 0), key: c.findIndex(x => /^(jawaban|kunci)( benar| jawaban)?$/.test(x) || x === "jawaban" || x === "kunci"), expl: c.findIndex(x => /^(penjelasan|pembahasan|keterangan)/.test(x)) };
    }
    if (h < 0) { if (!rows.length || rows[0].length < 4) return []; map = { q: 0, o: [1, 2, 3, 4].filter(i => i < rows[0].length - 1), key: Math.min(5, rows[0].length - 1), expl: rows[0].length > 6 ? 6 : -1 }; if (rows[0].length === 4) { map.o = [1, 2]; map.key = 3; } }
    const out = [];
    for (let i = h + 1; i < rows.length; i++) {
      const r = rows[i]; if (!r.some(Boolean)) continue;
      let opts = map.o.map(k => r[k] || ""), star = -1;
      opts = opts.map((o, k) => { if (/^\*|\*$/.test(o)) { star = k; return o.replace(/^\*\s*|\s*\*$/g, ""); } return o; });
      while (opts.length && !opts[opts.length - 1]) opts.pop();
      let key = null; const kv = map.key >= 0 ? (r[map.key] || "").trim() : "";
      if (/^[A-Ea-e]$/.test(kv)) key = LET.indexOf(kv.toUpperCase());
      else if (/^[1-5]$/.test(kv)) key = +kv - 1;
      else if (kv) { const k = opts.findIndex(o => o.toLowerCase() === kv.toLowerCase()); key = k >= 0 ? k : null; }
      else if (star >= 0) key = star;
      if (key != null && key >= opts.length) key = null;
      out.push(finish({ q: r[map.q] || "", opts, key, expl: map.expl >= 0 ? (r[map.expl] || "") : "" }));
    }
    return out;
  }

  /* ---------- Menulis XLSX sederhana (templat dan ekspor) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zipStore(files) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, b) => a + b.length, 0), eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054b50, true); eo.setUint16(8, files.length, true); eo.setUint16(10, files.length, true); eo.setUint32(12, csize, true); eo.setUint32(16, off, true);
    const all = parts.concat(central, [new Uint8Array(eo.buffer)]), out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
    let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }
  const xesc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const colName = i => { let s = ""; i += 1; while (i > 0) { s = String.fromCharCode(65 + (i - 1) % 26) + s; i = Math.floor((i - 1) / 26); } return s; };
  function makeXlsx(rows, sheetName) {
    const body = rows.map((r, i) => `<row r="${i + 1}">${r.map((c, k) => typeof c === "number" && isFinite(c) ? `<c r="${colName(k)}${i + 1}"><v>${c}</v></c>` : `<c r="${colName(k)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xesc(c)}</t></is></c>`).join("")}</row>`).join("");
    return zipStore([
      { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
      { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xesc(sheetName || "Soal").slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
      { name: "xl/_rels/workbook.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
      { name: "xl/worksheets/sheet1.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>` }
    ]);
  }
  const TEMPLATE = [
    ["Soal", "A", "B", "C", "D", "Jawaban", "Penjelasan"],
    ["Rambu berbentuk lingkaran berwarna biru menandakan...", "Larangan", "Peringatan", "Kondisi aman", "Kewajiban", "D", "Lingkaran biru adalah rambu wajib."],
    ["Near miss adalah...", "Kecelakaan dengan korban", "Kejadian nyaris celaka tanpa cedera", "Kerusakan alat", "Pelanggaran jam kerja", "B", "Near miss adalah peringatan dini."]
  ];

  /* ---------- Pintu masuk: baca berkas lalu urai ---------- */
  async function readFile(file) {
    const name = String(file.name || "").toLowerCase(), ext = (name.match(/\.([a-z0-9]+)$/) || [])[1] || "";
    if (file.size > 15 * 1024 * 1024) throw new Error("Ukuran berkas melebihi 15 MB.");
    const buf = await file.arrayBuffer();
    if (ext === "docx") return readDocx(buf);
    if (ext === "xlsx") return readXlsx(buf);
    if (ext === "csv") return parseCsv(dec(new Uint8Array(buf)));
    if (ext === "txt") return { text: dec(new Uint8Array(buf)) };
    if (ext === "pdf") return readPdf(buf);
    if (ext === "doc" || ext === "xls") throw new Error("Format lama (." + ext + ") tidak didukung. Simpan ulang sebagai ." + ext + "x lewat Save As, lalu unggah lagi.");
    throw new Error("Jenis berkas tidak didukung. Gunakan .docx, .xlsx, .csv, .pdf, atau .txt.");
  }
  function parseQuestions(doc) {
    if (doc.rows) return parseQuestionsRows(doc.rows);
    for (const t of doc.tables || []) { const r = parseQuestionsRows(t); if (r.length && r.some(x => x.opts.length >= 2)) return r; }
    return parseQuestionsText(doc.text || "");
  }
  return { readFile, readDocx, readXlsx, readPdf, parseCsv, parseQuestions, parseQuestionsText, parseQuestionsRows, validate, makeXlsx, zipEntries, zipRead, TEMPLATE };
});
