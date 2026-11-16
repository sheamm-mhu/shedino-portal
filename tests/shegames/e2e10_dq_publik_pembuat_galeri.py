import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'e2e_base.py'), encoding='utf-8').read())
from playwright.sync_api import sync_playwright
from PIL import Image
FX = os.environ.get('SG_FIXTURES', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures') + os.sep) + 'img' + os.sep
ORANG = FX + 'orang.png'
if not os.path.exists(ORANG): print('SKIP: foto orang contoh tidak ada (pip install scikit-image lalu jalankan buat_berkas_uji.py)'); sys.exit(0)
AXE = open(os.environ.get('AXE_JS', 'axe.min.js')).read()
mkuser('emp@x', 'Budi', 'Produksi')
Q("insert into media_posts(id,title,category,excerpt,cta) values ('dsq','Daily Safety Quotes','Keselamatan Kerja','x',''),('biasa','Berita biasa','Keselamatan Kerja','x',''),('paksa','Artikel lain','Keselamatan Kerja','x','dailyquotes'),('mati','Daily Safety Quotes tanpa tombol','Keselamatan Kerja','x','none')")
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
def axe(pg, label, scope='document'):
    pg.wait_for_timeout(700); pg.evaluate(AXE); v = pg.evaluate(f"axe.run({scope},{{runOnly:{{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}},resultTypes:['violations']}})")['violations']
    chk(f'X {label}: aksesibilitas 0 pelanggaran', v == [], [(x['id'], x['impact'], x['nodes'][0]['target'][0]) for x in v][:4])
def ready(pg, tries=80):
    for _ in range(tries):
        if pg.evaluate("!!document.querySelector('#dq-st') && /Latar dihapus|sudah tanpa latar|utuh di dalam bingkai/.test(document.querySelector('#dq-st').textContent) || document.querySelector('#dq-msg.warn,#dq-msg.err')"): return
        pg.wait_for_timeout(500)
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); ctx = b.new_context(viewport={'width': 1366, 'height': 1000}, accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text[:160]) if m.type == 'error' and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None); wire(pg)
    # ===== tombol di artikel =====
    def cta(i): pg.goto(f'{BASE}/artikel.html?id={i}'); pg.wait_for_selector('#art h1'); pg.wait_for_timeout(300); return pg.locator('#cta-dq').count()
    chk('C1 artikel berjudul "Daily Safety Quotes" (pengaturan otomatis): tombol "Buat Daily Quotes" tampil', cta('dsq') == 1 and pg.inner_text('#cta-dq') == 'Buat Daily Quotes' and pg.get_attribute('#cta-dq', 'href') == 'daily-quotes.html')
    pg.screenshot(path=SHOT + 'v24_artikel.png')
    chk('C2 artikel biasa: tanpa tombol', cta('biasa') == 0)
    chk('C3 artikel lain yang diatur "selalu tampilkan": tombol tampil', cta('paksa') == 1)
    chk('C4 judul memuat Daily Safety Quotes tetapi diatur "jangan tampilkan": tombol tidak tampil', cta('mati') == 0)
    pg.goto(f'{BASE}/artikel.html?id=dsq'); pg.wait_for_selector('#cta-dq'); pg.click('#cta-dq'); pg.wait_for_url('**/daily-quotes.html'); pg.wait_for_selector('#dq-cv')
    chk('C5 mengklik tombol membuka halaman pembuat poster', 'daily-quotes.html' in pg.url)
    chk('C6 menu Media memuat tautan Daily Quotes', pg.evaluate("[...document.querySelectorAll('.dd-menu a')].some(a=>a.getAttribute('href')==='daily-quotes.html')"))
    # ===== pembuat poster (pengunjung tanpa akun) =====
    pg.wait_for_timeout(800); cv = pg.locator('#dq-cv').bounding_box()
    chk('P1 halaman dimuat: pratinjau berbentuk poster 4:5, 4 kolom teks, tanggal hari ini terisi otomatis, 1 templat (tanpa pemilih)', abs(cv['height'] / cv['width'] - 1.25) < 0.01 and pg.locator('#dq-app [data-k]').count() == 4 and pg.input_value('[data-k=date]') == pg.evaluate("DQ.todayText()") and pg.locator('.dq-tpl').count() == 0)
    pg.click('#dq-dl'); pg.wait_for_timeout(200)
    chk('P2 klik Unduh tanpa foto: pesan jelas dan fokus pindah ke tombol unggah', 'Unggah foto' in pg.inner_text('#dq-msg') and pg.evaluate("document.activeElement.id") == 'dq-file')
    pg.set_input_files('#dq-file', FX + 'tanpa-orang.jpg') if os.path.exists(FX + 'tanpa-orang.jpg') else pg.set_input_files('#dq-file', FX + 'area-baru.jpg')
    ready(pg); chk('P3 foto tanpa orang: penghapusan latar gagal dengan pesan yang jelas, foto tetap dipakai utuh (tidak macet)', 'tidak terdeteksi' in pg.inner_text('#dq-msg') and pg.is_visible('#dq-ctl'), pg.inner_text('#dq-msg'))
    pg.set_input_files('#dq-file', ORANG); ready(pg); pg.wait_for_timeout(800)
    chk('P4 foto orang: latar dihapus otomatis, kontrol ukuran dan posisi tampil, pesan peringatan hilang', 'Latar dihapus' in pg.inner_text('#dq-st') and pg.is_visible('#dq-ctl') and 'tidak bisa' not in pg.inner_text('#dq-msg'), (pg.inner_text('#dq-st'), pg.inner_text('#dq-msg')))
    h0 = pg.evaluate("(()=>{const c=document.getElementById('dq-cv');return c.toDataURL().length})()")
    pg.fill('#dq-zoom', '1.6'); pg.wait_for_timeout(300); h1 = pg.evaluate("document.getElementById('dq-cv').toDataURL().length")
    chk('P5 geser Ukuran: pratinjau berubah', h0 != h1)
    pg.click('[data-mv=l]'); pg.click('[data-mv=u]'); pg.wait_for_timeout(250); h2 = pg.evaluate("document.getElementById('dq-cv').toDataURL().length")
    pg.click('#dq-center'); pg.wait_for_timeout(300); h3 = pg.evaluate("document.getElementById('dq-cv').toDataURL().length")
    chk('P6 tombol geser mengubah posisi; Pusatkan mengembalikan ukuran 1 dan posisi tengah (sama seperti awal)', h2 != h1 and h3 == h0 and pg.input_value('#dq-zoom') == '1', (h0, h1, h2, h3))
    bb = pg.locator('#dq-cv').bounding_box(); pg.mouse.move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.mouse.down(); pg.mouse.move(bb['x'] + bb['width'] / 2 + 60, bb['y'] + bb['height'] / 2 + 20, steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
    chk('P7 menyeret langsung di pratinjau menggeser foto', pg.evaluate("document.getElementById('dq-cv').toDataURL().length") != h0)
    pg.click('#dq-center')
    pg.fill('[data-k=name]', 'Eileen Collins'); pg.fill('[data-k=job]', 'Astronaut, Departemen Penerbangan'); pg.fill('[data-k=quote]', 'Keselamatan bukan pilihan, tetapi tanggung jawab kita bersama setiap hari.'); pg.wait_for_timeout(400)
    chk('P8 hitung karakter tampil per kolom (Nama 14/80)', '14/80' in pg.inner_text('[data-c=name]'))
    pg.fill('[data-k=name]', 'Nama Yang Sangat Panjang Sekali ' * 3); pg.wait_for_timeout(400)
    chk('P9 teks terlalu panjang: pembuat memberi tahu bahwa teks dipotong (bukan diam-diam)', 'dipotong' in pg.inner_text('#dq-pnote'), pg.inner_text('#dq-pnote'))
    pg.fill('[data-k=name]', 'Eileen Collins'); pg.wait_for_timeout(300)
    chk('P9b teks diperpendek: peringatan hilang', 'dipotong' not in pg.inner_text('#dq-pnote'))
    pg.screenshot(path=SHOT + 'v24_buat.png', full_page=True)
    with pg.expect_download() as dl: pg.click('#dq-dl')
    path = SHOT + 'unduh.jpg'; dl.value.save_as(path); im = Image.open(path).convert('RGB'); W, H = im.size
    chk('P10 unduh: berkas JPEG 1080x1350 bernama sesuai nama orang, ukuran wajar', dl.value.suggested_filename == 'daily-quotes-eileen-collins.jpg' and (W, H) == (1080, 1350) and os.path.getsize(path) < 3 * 1024 * 1024, (dl.value.suggested_filename, im.size, os.path.getsize(path)))
    px = im.load(); orange = sum(1 for y in range(int(H * .45), int(H * .78), 6) for x in range(int(W * .25), int(W * .75), 6) if px[x, y][0] > 200 and 80 < px[x, y][1] < 160 and px[x, y][2] < 90)
    white = sum(1 for y in range(int(H * .895), int(H * .96), 2) for x in range(int(W * .08), int(W * .92), 2) if min(px[x, y]) > 235)
    gold = sum(1 for y in range(int(H * .86), int(H * .885), 2) for x in range(int(W * .06), int(W * .94), 2) if px[x, y][0] > 220 and px[x, y][1] > 150 and px[x, y][2] < 90)
    chk('P11 isi gambar hasil: jas oranye astronaut terlihat di tengah poster (orang benar-benar tertempel), kutipan putih dan jabatan emas tercetak di panel', orange > 150 and white > 80 and gold > 15, (orange, white, gold))
    bg = im.getpixel((int(W * .06), int(H * .5)))
    chk('P12 latar foto asli (bendera dan roket) hilang: sisi kiri poster tetap latar templat gelap, bukan foto', max(bg) < 90, bg)
    # ===== foto sudah transparan dan tanpa hapus latar =====
    pg.set_input_files('#dq-file', FX + 'orang-transparan.png'); ready(pg); pg.wait_for_timeout(500)
    chk('P13 foto PNG yang sudah transparan dipakai apa adanya (tanpa menjalankan penghapus latar)', 'sudah tanpa latar' in pg.inner_text('#dq-st'), pg.inner_text('#dq-st'))
    pg.set_input_files('#dq-file', ORANG); ready(pg); pg.uncheck('#dq-cut'); pg.wait_for_timeout(1200)
    chk('P14 mematikan "Hapus latar": foto dipakai utuh di dalam bingkai (proses ulang dari foto asli)', 'utuh di dalam bingkai' in pg.inner_text('#dq-st'), pg.inner_text('#dq-st'))
    pg.check('#dq-cut'); ready(pg); pg.wait_for_timeout(600)
    pg.set_input_files('#dq-file', {'name': 'x.txt', 'mimeType': 'text/plain', 'buffer': b'bukan gambar'}); pg.wait_for_timeout(500)
    chk('P15 berkas bukan gambar ditolak dengan pesan jelas', 'JPG, PNG, atau WebP' in pg.inner_text('#dq-msg') or 'tidak dapat dibaca' in pg.inner_text('#dq-msg'), pg.inner_text('#dq-msg'))
    axe(pg, 'pembuat poster')
    # ===== kirim =====
    pg.click('#dq-send'); pg.wait_for_selector('#dq-sf'); pg.click('#dq-sgo'); pg.wait_for_timeout(300)
    chk('S1 kirim tanpa mencentang izin ditolak dengan pesan jelas; belum ada yang tersimpan', 'izin' in pg.inner_text('#dq-sm') and Q1("select count(*) from dq_submissions") == 0)
    axe(pg, 'dialog kirim')
    pg.fill('#dq-sender', 'Pak Andi'); pg.check('#dq-consent'); pg.click('#dq-sgo'); pg.wait_for_selector('#dq-sdone', timeout=30000)
    row = Q("select status,name,job,quote,sender,template_id is not null,image from dq_submissions")[0]
    chk('S2 terkirim: baris "pending" memuat nama, jabatan, kutipan, pengirim, templat; gambar poster terunggah', row[:5] == ('pending', 'Eileen Collins', 'Astronaut, Departemen Penerbangan', 'Keselamatan bukan pilihan, tetapi tanggung jawab kita bersama setiap hari.', 'Pak Andi') and row[5] and '/dq-submissions/p/' in row[6] and any(k.startswith('dq-submissions/p/') and v[1] == 'image/jpeg' for k, v in STORE.items()), row)
    key = [k for k in STORE if k.startswith('dq-submissions/')][0]; up = Image.open(__import__('io').BytesIO(STORE[key][0]))
    chk('S3 gambar yang diunggah adalah JPEG poster utuh di bawah 1 MB (batas bucket)', up.size == (1080, 1350) and len(STORE[key][0]) < 1024 * 1024, (up.size, len(STORE[key][0])))
    chk('S4 pesan konfirmasi menyebut menunggu persetujuan admin', 'persetujuan' in pg.inner_text('#dq-send-dlg') + pg.inner_text('#dq-msg') and Q1("select count(*) from dq_submissions where status='approved'") == 0)
    pg.click('#dq-sdone')
    # jebakan bot
    pg.click('#dq-send'); pg.wait_for_selector('#dq-sf'); pg.check('#dq-consent'); pg.evaluate("document.getElementById('dq-hp').value='http://spam'"); pg.click('#dq-sgo'); pg.wait_for_selector('#dq-sdone', timeout=30000); pg.click('#dq-sdone')
    chk('S5 jebakan bot terisi: tampak berhasil tetapi tidak ada baris baru tersimpan', Q1("select count(*) from dq_submissions") == 1)
    # batas harian
    Q("update dq_settings set per_token_daily=1"); pg.click('#dq-send'); pg.wait_for_selector('#dq-sf'); pg.check('#dq-consent'); pg.click('#dq-sgo'); pg.wait_for_function("!/Menyiapkan/.test(document.getElementById('dq-sm').textContent)", timeout=30000)
    chk('S6 batas pengiriman per perangkat tercapai: pesan jelas ditampilkan di dialog', 'Batas pengiriman' in pg.inner_text('#dq-sm'), pg.inner_text('#dq-sm')); Q("update dq_settings set per_token_daily=5"); pg.click('#dq-sx')
    # wajib login
    Q("update dq_settings set require_login=true"); pg.click('#dq-send'); pg.wait_for_selector('#dq-sf'); pg.check('#dq-consent'); pg.click('#dq-sgo'); pg.wait_for_function("!/Menyiapkan/.test(document.getElementById('dq-sm').textContent)", timeout=30000)
    chk('S7 admin mewajibkan login: pengunjung tanpa akun ditolak dengan pesan yang mengarahkan masuk', 'masuk' in pg.inner_text('#dq-sm').lower(), pg.inner_text('#dq-sm')); Q("update dq_settings set require_login=false"); pg.click('#dq-sx')
    # ===== galeri =====
    pg.click('#dq-tab-galeri'); pg.wait_for_selector('#dq-gs'); pg.wait_for_timeout(700)
    chk('G1 galeri sebelum ada yang disetujui: kosong dengan ajakan, kiriman "pending" tidak tampil', pg.locator('.dq-card').count() == 0 and 'Belum ada karya' in pg.inner_text('#dq-gs'))
    Q("update dq_submissions set status='approved'"); pg.reload(); pg.wait_for_selector('.dq-card'); pg.wait_for_timeout(700)
    g2 = (pg.locator('.dq-card').count(), 'Eileen Collins' in pg.inner_text('.dq-card'), pg.get_attribute('#dq-tab-galeri', 'aria-selected'), pg.evaluate("[...document.querySelectorAll('.dq-card img')].map(i=>[i.complete,i.naturalWidth])"))
    chk('G2 setelah disetujui admin: poster tampil di galeri dengan nama dan jabatan; URL #galeri membuka tab Galeri', g2[0] == 1 and g2[1] and g2[2] == 'true' and all(c and w > 0 for c, w in g2[3]), g2)
    axe(pg, 'galeri')
    pg.click('.dq-card'); pg.wait_for_selector('#dq-view[open]'); pg.wait_for_timeout(400)
    chk('G3 dialog poster: gambar besar, kutipan, tautan WhatsApp memuat nama, tombol Unduh dan Tutup', 'Keselamatan bukan pilihan' in pg.inner_text('#dq-view') and 'Eileen' in pg.get_attribute('#dq-view a[href^="https://wa.me"]', 'href').replace('%20', ' ') and pg.locator('#dq-vdl').count() == 1)
    axe(pg, 'dialog poster', "document.getElementById('dq-view')")
    with pg.expect_download() as dl2: pg.click('#dq-vdl')
    chk('G4 unduh dari galeri menghasilkan berkas JPEG', dl2.value.suggested_filename.endswith('.jpg')); pg.click('#dq-vx')
    # ===== dinonaktifkan =====
    Q("update dq_settings set enabled=false"); pg.goto(BASE + '/daily-quotes.html?lagi=1#buat'); pg.wait_for_function("document.querySelector('#dq-app').textContent.includes('dinonaktifkan')", timeout=15000)
    chk('Z1 fitur dimatikan admin: pembuat menampilkan pesan, tanpa formulir', 'dinonaktifkan' in pg.inner_text('#dq-app') and pg.locator('#dq-cv').count() == 0); Q("update dq_settings set enabled=true")
    chk('Z2 tanpa error JS (desktop)', errs == [], errs[:3]); ctx.close()
    # ===== ponsel =====
    m = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2); mp = m.new_page(); me = []; mp.on('pageerror', lambda e: me.append(str(e))); wire(mp)
    mp.goto(BASE + '/daily-quotes.html'); mp.wait_for_selector('#dq-cv'); mp.wait_for_timeout(800)
    over = lambda: mp.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth")
    mp.set_input_files('#dq-file', ORANG); ready(mp); mp.wait_for_timeout(600)
    small = mp.evaluate("[...document.querySelectorAll('#dq-app button,#dq-app select,#dq-app .btn,#dq-app input[type=range]')].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height<44).length")
    chk('M1 ponsel 390px: pembuat tanpa scroll samping; semua tombol dan penggeser ≥44px; pratinjau selebar layar', not over() and small == 0 and mp.locator('#dq-cv').bounding_box()['width'] > 300, (over(), small))
    chk('M2 di perangkat sentuh, menyeret di pratinjau dimatikan bawaannya (agar layar tetap bisa digulir); tombol geser tersedia', 'drag' not in (mp.get_attribute('#dq-stage', 'class') or '') and mp.get_attribute('#dq-drag', 'aria-pressed') == 'false')
    mp.screenshot(path=SHOT + 'v24_buat_m.png'); mp.click('#dq-tab-galeri'); mp.wait_for_timeout(600)
    chk('M3 galeri di ponsel tanpa scroll samping dan tanpa error JS', not over() and me == [], me[:2]); m.close(); b.close()
done()
