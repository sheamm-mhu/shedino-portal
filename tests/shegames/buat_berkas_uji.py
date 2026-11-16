"""Membuat berkas contoh untuk uji SHEGAMES (dokumen soal, daftar kata, gambar).
Kebutuhan: pip install python-docx openpyxl reportlab pillow scikit-image
Pemakaian: python buat_berkas_uji.py [folder tujuan]   (bawaan: folder 'fixtures' di sebelah berkas ini)"""
import os, sys
import docx, openpyxl
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from PIL import Image, ImageDraw

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
os.makedirs(os.path.join(OUT, 'img'), exist_ok=True)
P = lambda *a: os.path.join(OUT, *a)

def pdf(path, text):
    c = canvas.Canvas(path, pagesize=A4); y = 800
    for line in text.split("\n"):
        c.setFont("Helvetica", 11); c.drawString(60, y, line); y -= 16
    c.save()

# ---------- soal pilihan ganda ----------
SOAL = """BANK SOAL K3 - Departemen Produksi

1. Apa kepanjangan APD?
A. Alat Pelindung Diri
B. Alat Pemadam Darurat
C. Area Parkir Dalam
D. Alat Pengangkut Darurat
Jawaban: A
Penjelasan: APD adalah alat pelindung diri.

2. Warna dasar rambu larangan adalah...
A. Biru  B. Hijau  C. Merah  D. Kuning
Jawaban : c

3) Helm wajib dipakai di area...
a) Kantin
*b) Tambang
c) Parkir tamu

4. Soal ini sengaja tanpa kunci?
A. Ya
B. Tidak
"""
open(P('soal.txt'), 'w', encoding='utf-8').write(SOAL)
d = docx.Document()
for line in SOAL.split("\n"): d.add_paragraph(line)
d.save(P('soal_teks.docx'))
d = docx.Document()
def numbered(text, num_id, bold=False):
    p = d.add_paragraph(); r = p.add_run(text); r.bold = bold
    pPr = p._p.get_or_add_pPr(); numPr = OxmlElement("w:numPr")
    il = OxmlElement("w:ilvl"); il.set(qn("w:val"), "0"); ni = OxmlElement("w:numId"); ni.set(qn("w:val"), str(num_id))
    numPr.append(il); numPr.append(ni); pPr.append(numPr)
d.add_paragraph("Kuis Keselamatan")
numbered("Siapa yang berhak menghentikan pekerjaan tidak aman?", 1)
for t, b in [("Hanya supervisor", False), ("Setiap pekerja", True), ("Hanya manajer", False)]: numbered(t, 2, b)
numbered("Alat untuk memadamkan api kecil disebut...", 1)
for t, b in [("APAR", True), ("APD", False), ("LOTO", False), ("JSA", False)]: numbered(t, 2, b)
d.save(P('soal_auto.docx'))
d = docx.Document(); d.add_paragraph("Daftar soal")
rows = [["No", "Pertanyaan", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci", "Pembahasan"],
        ["1", "Titik kumpul dipakai untuk...", "Makan siang", "Menghitung orang saat evakuasi", "Parkir", "Menyimpan APAR", "B", "Memastikan semua selamat."],
        ["2", "Kondisi aman ditandai rambu berwarna...", "Hijau", "Merah", "Kuning", "Biru", "Hijau", ""]]
t = d.add_table(rows=3, cols=8)
for i, r in enumerate(rows):
    for j, c in enumerate(r): t.cell(i, j).text = c
d.save(P('soal_tabel.docx'))
wb = openpyxl.Workbook(); ws = wb.active
for r in [["Soal", "A", "B", "C", "D", "Jawaban", "Penjelasan"],
          ["Near miss adalah...", "Kecelakaan fatal", "Nyaris celaka", "Kerusakan alat", "Cuti", "B", "Peringatan dini."],
          ["LOTO dipakai untuk...", "Mengunci sumber energi", "Mencatat absen", "Mengukur debu", "Menguji ban", 1, ""],
          ["Soal tanpa kunci di Excel", "x", "y", "", "", "", ""],
          ["Simbol & < > \" kutip", "A&B", "<tag>", "c", "d", "A", "é ü 日本"]]: ws.append(r)
wb.save(P('soal.xlsx'))
open(P('soal.csv'), "w", encoding="utf-8-sig").write('Soal;A;B;C;D;Jawaban;Penjelasan\n"APAR untuk api listrik; pilih yang tepat";Air;"CO2 atau ""serbuk"" kering";Busa;Pasir;B;"Tidak menghantarkan listrik"\nRisiko adalah...;Sumber bahaya;Kemungkinan x keparahan;;;B;\n')
pdf(P('soal.pdf'), SOAL)
c = canvas.Canvas(P('scan.pdf'), pagesize=A4); c.rect(50, 500, 300, 200, fill=1); c.save()

# ---------- daftar kata teka-teki silang ----------
KATA = """DAFTAR KATA TTS
HAZARD | Sumber atau situasi yang berpotensi menimbulkan cedera
APD | Alat pelindung diri
1. Evakuasi - Perpindahan orang ke tempat aman
2) lock out: Penguncian sumber energi
Kata Salah 1 | petunjuk dengan angka
X | satu huruf tidak sah
HAZARD | kata kembar
CATATAN TANPA PEMISAH
"""
open(P('kata.txt'), "w", encoding="utf-8").write(KATA)
open(P('kata.csv'), "w", encoding="utf-8-sig").write("Jawaban;Petunjuk\nhazard;Sumber bahaya\nAPD;Alat pelindung diri\nIsolasi;\"Pemisahan energi; lockout\"\n")
open(P('kata_baru.csv'), "w", encoding="utf-8-sig").write('Jawaban;Petunjuk\nErgonomi;Ilmu menyesuaikan pekerjaan dengan pekerja\nDebu;Partikel halus di udara\nBising;Suara berlebihan\n')
wb = openpyxl.Workbook(); ws = wb.active
for r in [["No", "Kata", "Clue"], [1, "Risiko", "Gabungan kemungkinan dan keparahan"], [2, "Helm", "APD kepala"], [3, "Sepatu Safety", "APD kaki"]]: ws.append(r)
wb.save(P('kata.xlsx'))
d = docx.Document(); d.add_paragraph("Kosakata")
t = d.add_table(rows=3, cols=2)
for i, r in enumerate([["Jawaban", "Petunjuk"], ["APAR", "Alat pemadam api ringan"], ["Toolbox", "Pertemuan singkat sebelum kerja"]]):
    for j, c in enumerate(r): t.cell(i, j).text = c
d.save(P('kata.docx'))
pdf(P('kata.pdf'), KATA)

# ---------- gambar ----------
def sign(name, color, fmt, size=(800, 800), shape='circle'):
    im = Image.new('RGBA', size, (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    if shape == 'circle': dr.ellipse([20, 20, size[0] - 20, size[1] - 20], fill=color)
    else: dr.rectangle([20, 20, size[0] - 20, size[1] - 20], fill=color)
    dr.rectangle([size[0] // 2 - 40, size[1] // 2 - 200, size[0] // 2 + 40, size[1] // 2 + 200], fill=(255, 255, 255, 255))
    if fmt == 'JPEG': im = im.convert('RGB')
    im.save(P('img', name), fmt, **({'quality': 90} if fmt in ('JPEG', 'WEBP') else {}))
sign('wajib-masker.png', (37, 99, 235, 255), 'PNG'); sign('dilarang-parkir.jpg', (220, 38, 38, 255), 'JPEG'); sign('awas-api.webp', (251, 191, 36, 255), 'WEBP', shape='rect')
open(P('img', 'kartu.svg'), 'w').write('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')
open(P('img', 'rusak.png'), 'wb').write(b'bukan gambar sungguhan, hanya teks')
sc = Image.new('RGB', (2000, 1200), (203, 213, 225)); dr = ImageDraw.Draw(sc)
dr.rectangle([0, 760, 2000, 1200], fill=(148, 163, 184)); dr.rectangle([300, 200, 700, 760], fill=(217, 119, 6)); dr.rectangle([1300, 300, 1500, 760], fill=(220, 38, 38)); dr.ellipse([900, 900, 1300, 1100], fill=(51, 65, 85))
sc.save(P('img', 'area-baru.jpg'), 'JPEG', quality=88)
# foto orang untuk uji Daily Quotes: foto astronaut domain publik (NASA) dari pustaka scikit-image
try:
    import skimage.data
    im = Image.fromarray(skimage.data.astronaut()); im.save(P('img', 'orang.png'))
    rgba = im.convert('RGBA'); mask = Image.new('L', im.size, 0); ImageDraw.Draw(mask).ellipse([60, 10, 460, 505], fill=255); rgba.putalpha(mask); rgba.save(P('img', 'orang-transparan.png'))
except ImportError:
    print('scikit-image tidak terpasang: uji Daily Quotes yang memakai foto orang akan dilewati (pip install scikit-image)')
print('Berkas uji dibuat di', OUT)
