const fs = require("fs"), P = require(require("path").join(__dirname, "..", "..", "public", "assets", "games", "games-parse.js"));
let ok = 0, bad = 0; const chk = (n, c, x) => { if (c) { ok++; console.log("PASS", n); } else { bad++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } };
const ab = f => { const b = fs.readFileSync((process.env.SG_FIXTURES || "/tmp/fx/") + f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const brief = a => a.map(i => [i.q.slice(0, 24), i.opts.length, i.key, i.problems.join("|")]);
(async () => {
  // ---- teks
  const T = fs.readFileSync((process.env.SG_FIXTURES || "/tmp/fx/") + "soal.txt", "utf8"); let r = P.parseQuestionsText(T);
  chk("U1 teks: 4 soal terbaca, judul di atas diabaikan", r.length === 4, brief(r));
  chk("U2 soal 1: 4 pilihan per baris, 'Jawaban: A', penjelasan", r[0].q === "Apa kepanjangan APD?" && r[0].opts.length === 4 && r[0].key === 0 && r[0].expl === "APD adalah alat pelindung diri." && !r[0].problems.length, r[0]);
  chk("U3 soal 2: pilihan sebaris 'A. Biru  B. Hijau  C. Merah  D. Kuning' + 'Jawaban : c' (huruf kecil, spasi)", JSON.stringify(r[1].opts) === '["Biru","Hijau","Merah","Kuning"]' && r[1].key === 2, r[1]);
  chk("U4 soal 3: gaya '3)' dan 'a)' dengan kunci bertanda bintang (*b)", r[2].opts.length === 3 && r[2].key === 1 && r[2].opts[1] === "Tambang", r[2]);
  chk("U5 soal 4: tanpa kunci ditandai bermasalah", r[3].key === null && r[3].problems.includes("Tanpa kunci jawaban"), r[3]);
  r = P.parseQuestionsText("10. Soal panjang yang\nbersambung ke baris kedua?\nA. Pilihan satu yang\n   bersambung\nB. Dua *\nC. Tiga\nD. Empat\nE. Lima\nKunci Jawaban: E\nPembahasan: baris satu\nbaris dua A. bukan pilihan\n11. Berikutnya? A. x *B. y C. z\n12. Angka\nA. p\nB. q\nJawaban: 2");
  chk("U6 soal dan pilihan multi-baris, 5 pilihan, 'Kunci Jawaban: E', pembahasan multi-baris (teks 'A.' di dalamnya bukan pilihan)", r[0].q === "Soal panjang yang bersambung ke baris kedua?" && r[0].opts[0] === "Pilihan satu yang bersambung" && r[0].opts.length === 5 && r[0].key === 4 && r[0].expl === "baris satu baris dua A. bukan pilihan", r[0]);
  chk("U7 soal + pilihan dalam satu baris dengan bintang di tengah", r[1].q === "Berikutnya?" && JSON.stringify(r[1].opts) === '["x","y","z"]' && r[1].key === 1, r[1]);
  chk("U8 kunci berupa angka (Jawaban: 2 = pilihan kedua)", r[2].key === 1, r[2]);
  r = P.parseQuestionsText("1. Dua bintang?\n*A. satu\n*B. dua\nC. tiga\n2. Kembar?\nA. Sama\nB. sama\nJawaban: A\n3. Kunci luar?\nA. a\nB. b\nJawaban: D\n4. Satu pilihan\nA. saja\nJawaban: A");
  chk("U9 masalah terdeteksi: dua kunci, pilihan kembar, kunci di luar pilihan, pilihan kurang dari 2", r[0].problems.includes("Lebih dari satu pilihan ditandai sebagai kunci") && r[1].problems.includes("Pilihan kembar") && r[2].problems.includes("Tanpa kunci jawaban") && r[3].problems.includes("Pilihan kurang dari 2"), brief(r));
  chk("U10 teks tanpa soal menghasilkan daftar kosong (bukan galat)", P.parseQuestionsText("Halo\nIni bukan soal").length === 0 && P.parseQuestionsText("").length === 0);
  // ---- docx
  let d = await P.readDocx(ab("soal_teks.docx")); r = P.parseQuestions(d);
  chk("U11 Word (.docx) bernomor ketik: hasil sama dengan teks (4 soal, kunci 0, 2, 1, kosong)", r.length === 4 && r.map(x => x.key).join() === "0,2,1," && r[0].expl.startsWith("APD"), brief(r));
  d = await P.readDocx(ab("soal_auto.docx")); r = P.parseQuestions(d);
  chk("U12 Word bernomor OTOMATIS (nomor tidak tersimpan sebagai teks) + kunci dicetak tebal: 2 soal, kunci B dan A", r.length === 2 && r[0].q.startsWith("Siapa yang berhak") && r[0].opts.length === 3 && r[0].key === 1 && r[1].opts.length === 4 && r[1].key === 0 && !r[0].problems.length, [d.text, brief(r)]);
  d = await P.readDocx(ab("soal_tabel.docx")); r = P.parseQuestions(d);
  chk("U13 tabel Word dengan judul kolom Pertanyaan/Opsi A-D/Kunci/Pembahasan; kunci berupa huruf ATAU teks pilihan", r.length === 2 && r[0].key === 1 && r[0].expl === "Memastikan semua selamat." && r[1].key === 0 && r[1].opts.length === 4, brief(r));
  // ---- xlsx
  let x = await P.readXlsx(ab("soal.xlsx")); r = P.parseQuestions(x);
  chk("U14 Excel (.xlsx): 4 baris; kunci huruf dan angka; baris tanpa kunci ditandai; sel kosong di akhir dibuang", r.length === 4 && r[0].key === 1 && r[1].key === 0 && r[2].key === null && r[2].opts.length === 2 && r[2].problems.includes("Tanpa kunci jawaban"), brief(r));
  chk("U15 Excel: simbol & < > kutip dan huruf non-Latin terbaca utuh", r[3].q === 'Simbol & < > " kutip' && r[3].opts[0] === "A&B" && r[3].opts[1] === "<tag>" && r[3].expl === "é ü 日本", r[3]);
  // ---- csv
  let c = P.parseCsv(fs.readFileSync((process.env.SG_FIXTURES || "/tmp/fx/") + "soal.csv", "utf8")); r = P.parseQuestions(c);
  chk("U16 CSV pemisah titik koma, BOM, kutip ganda, dan titik koma di dalam kutip", r.length === 2 && r[0].q === "APAR untuk api listrik; pilih yang tepat" && r[0].opts[1] === 'CO2 atau "serbuk" kering' && r[0].key === 1 && r[1].opts.length === 2 && r[1].key === 1, brief(r));
  r = P.parseQuestions(P.parseCsv("Soal A?,x,y,z,w,C,penjelasan\nSoal B?,p,q,r,s,p,"));
  chk("U17 CSV pemisah koma tanpa baris judul (urutan Soal, A, B, C, D, Jawaban, Penjelasan)", r.length === 2 && r[0].key === 2 && r[0].expl === "penjelasan" && r[1].key === 0, brief(r));
  // ---- templat bolak-balik
  const tpl = P.makeXlsx(P.TEMPLATE, "Soal"); fs.writeFileSync((process.env.SG_FIXTURES || "/tmp/fx/") + "templat.xlsx", Buffer.from(tpl));
  r = P.parseQuestions(await P.readXlsx(tpl.buffer.slice(tpl.byteOffset, tpl.byteOffset + tpl.byteLength)));
  chk("U18 templat Excel buatan situs bisa dibaca kembali: 2 soal contoh valid", r.length === 2 && r.every(i => !i.problems.length) && r[0].key === 3, brief(r));
  // ---- berkas rusak
  let e1 = ""; try { await P.readDocx(new TextEncoder().encode("bukan zip sama sekali, hanya teks biasa yang cukup panjang").buffer); } catch (e) { e1 = e.message; }
  let e2 = ""; try { await P.readDocx(ab("soal.xlsx")); } catch (e) { e2 = e.message; }
  chk("U19 berkas rusak atau salah jenis ditolak dengan pesan jelas (bukan galat teknis)", /bukan dokumen/.test(e1) && /bukan dokumen Word/.test(e2), [e1, e2]);
  console.log(`TOTAL PENGURAI: ${ok} lulus, ${bad} gagal`); process.exit(bad ? 1 : 0);
})();
