const CW = require(require("path").join(__dirname, "..", "..", "public", "assets", "games", "games-cw.js"));
let ok = 0, bad = 0; const chk = (n, c, x) => { if (c) { ok++; console.log("PASS", n); } else { bad++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } };
const SEED = ["HAZARD","APD","INSIDEN","PENGENDALIAN","EVAKUASI","ISOLASI","RISIKO","KESELAMATAN","APAR","HELM","SEPATU","KACAMATA","TOOLBOX","LANGKAH","PELAPORAN"].map((w, i) => ({ id: "id" + i, word: w }));
let t0 = Date.now(), L = CW.generate(SEED, { seed: 7 }), dt = Date.now() - t0;
chk("W1 15 kata seed: semua tertempatkan, tidak ada yang tersisa", L.items.length === 15 && L.unplaced.length === 0, { n: L.items.length, un: L.unplaced });
chk("W2 hasil lolos pemeriksa independen (tabrakan, tumpang tindih, huruf bersebelahan, nomor)", CW.validate(L, SEED).length === 0, CW.validate(L, SEED).slice(0, 4));
chk("W3 ukuran wajar (kotak " + L.rows + "x" + L.cols + ") dan cepat (" + dt + " ms)", L.rows <= 24 && L.cols <= 24 && dt < 3000);
const again = CW.generate(SEED, { seed: 7 });
chk("W4 benih sama menghasilkan tata letak yang sama persis (semua pemain mendapat susunan sama)", JSON.stringify(again) === JSON.stringify(L));
chk("W5 benih berbeda menghasilkan susunan berbeda (tombol 'acak ulang')", JSON.stringify(CW.generate(SEED, { seed: 8 })) !== JSON.stringify(L));
const nums = L.items.map(i => i.num), cellsStart = {}; L.items.forEach(i => { const k = i.row + "," + i.col; (cellsStart[k] = cellsStart[k] || new Set()).add(i.num); });
const order = Object.keys(cellsStart).map(k => k.split(",").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(k => [...cellsStart[k.join(",")]][0]);
chk("W6 penomoran standar: 1, 2, 3, ... berurutan kiri-ke-kanan, atas-ke-bawah; mendatar dan menurun di kotak yang sama berbagi nomor", order.every((n, i) => n === i + 1) && Object.values(cellsStart).every(s => s.size === 1), order);
// sifat acak: 60 himpunan acak dari kata seed
let allOk = 0, worst = []; const rnd = CW.rng(99);
for (let n = 0; n < 60; n++) {
  const k = 4 + Math.floor(rnd() * 11), pool = SEED.slice().sort(() => rnd() - 0.5).slice(0, k), G = CW.generate(pool, { seed: n + 1 });
  const placedWords = pool.filter(w => !G.unplaced.includes(w.id)), errs = CW.validate(G, placedWords);
  if (!errs.length) allOk++; else worst.push(errs[0]);
}
chk("W7 60 himpunan kata acak (4 sampai 14 kata): semua tata letak sah menurut aturan server", allOk === 60, worst.slice(0, 3));
const un = CW.generate([{ id: "a", word: "HAZARD" }, { id: "b", word: "QQQQ" }, { id: "c", word: "HELM" }, { id: "d", word: "RISIKO" }], { seed: 3 });
chk("W8 kata tanpa huruf bersama (QQQQ) dilaporkan tak tertempatkan, tidak membuat susunan rusak", un.unplaced.length === 1 && un.unplaced[0] === "b" && CW.validate(un, [{ id: "a", word: "HAZARD" }, { id: "c", word: "HELM" }, { id: "d", word: "RISIKO" }]).length === 0, un);
const one = CW.generate([{ id: "x", word: "SATU" }]); chk("W9 satu kata: satu baris, nomor 1", one.items.length === 1 && one.rows * one.cols === 4 && one.items[0].num === 1, one);
const dp = CW.generate([{ id: "a", word: "helm" }, { id: "b", word: "HELM" }, { id: "c", word: "he lm!" }]); chk("W10 kata kembar (beda huruf besar/simbol) dibuang dan dilaporkan", dp.items.length === 1 && dp.duplicates.length === 2, dp);
chk("W11 daftar kosong atau kata terlalu pendek menghasilkan kosong tanpa galat", CW.generate([]).items.length === 0 && CW.generate([{ id: "z", word: "A" }]).items.length === 0);
const big = CW.generate(Array.from({ length: 40 }, (_, i) => ({ id: "w" + i, word: ["MESIN","BAHAYA","LISTRIK","RAMBU","HELM","SARUNG","TANGAN","KEBAKARAN","AMAN","SELAMAT","EVAKUASI","APAR","PINTU","DARURAT","JALUR","TITIK","KUMPUL","LANTAI","TUMPAH","KABEL"][i % 20] + (i >= 20 ? ["X","Y","Z","K","M","N","P","Q","R","S","T","U","V","W","B","C","D","F","G","J"][i - 20] : "") })), { seed: 5 });
chk("W12 40 kata: tetap sah dan selesai cepat; yang tak muat dilaporkan", CW.validate(big, big.items.map(i => ({ id: i.id, word: ["MESIN","BAHAYA","LISTRIK","RAMBU","HELM","SARUNG","TANGAN","KEBAKARAN","AMAN","SELAMAT","EVAKUASI","APAR","PINTU","DARURAT","JALUR","TITIK","KUMPUL","LANTAI","TUMPAH","KABEL"][+i.id.slice(1) % 20] + (+i.id.slice(1) >= 20 ? ["X","Y","Z","K","M","N","P","Q","R","S","T","U","V","W","B","C","D","F","G","J"][+i.id.slice(1) - 20] : "") }))).length === 0 && big.rows <= 24 && big.cols <= 24, [big.rows, big.cols, big.items.length, big.unplaced.length]);
console.log(`TOTAL PEMBUAT TTS: ${ok} lulus, ${bad} gagal`); process.exit(bad ? 1 : 0);
