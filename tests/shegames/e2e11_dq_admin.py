import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'e2e_base.py'), encoding='utf-8').read())
from playwright.sync_api import sync_playwright
from PIL import Image
FXD = os.environ.get('SG_FIXTURES', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures') + os.sep)
FX = FXD + 'img' + os.sep
AXE = open(os.environ.get('AXE_JS', 'axe.min.js')).read()
adm = mkuser('adm@x', 'Admin SHE', 'SHE', role='admin'); mkuser('emp@x', 'Budi', 'Produksi')
Q("insert into media_posts(id,title,category,excerpt) values ('biasa','Berita biasa','Keselamatan Kerja','x')")
jpg = open(FX + 'area-baru.jpg', 'rb').read(); TPL = Q1("select id::text from dq_templates")
for i, (nm, tok) in enumerate([('Andi Saputra', 'tokenandiandiandi01'), ('Bima Prakoso', 'tokenbimabimabima02'), ('Citra Lestari', 'tokencitracitracit03')], 1):
    k = f'dq-submissions/p/261116/kiriman00{i}.jpg'; STORE[k] = (jpg, 'image/jpeg')
    Q("insert into storage.objects(bucket_id,name) values ('dq-submissions',%s)", (f'p/261116/kiriman00{i}.jpg',))
    Q("insert into dq_submissions(template_id,image,name,job,quote,date_text,sender,token,user_id) values (%s,%s,%s,'Operator',%s,'03/NOV/26',%s,%s,%s)", (TPL, f'{FAKE}/storage/v1/object/public/{k}', nm, 'Selamat bekerja dengan aman ' + nm.split()[0], 'Pengirim ' + nm.split()[0], tok, adm if i == 1 else None))
def P(uid, q, p=None, role='anon'):   # jalankan sebagai peran anon (pengunjung) untuk memeriksa apa yang terlihat publik
    try:
        db.execute(f"set role {role}"); r = db.execute(q, p).fetchall(); return True, (r[0][0] if r and len(r[0]) == 1 else r)
    except Exception as e: return False, str(e)
    finally: db.execute("reset role")
def axe(pg, label):
    pg.wait_for_timeout(700); pg.evaluate(AXE); v = pg.evaluate("axe.run(document.getElementById('dq-panel'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},resultTypes:['violations']})")['violations']
    chk(f'X {label}: aksesibilitas 0 pelanggaran', v == [], [(x['id'], x['impact'], x['nodes'][0]['target'][0]) for x in v][:4])
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); ctx = b.new_context(viewport={'width': 1366, 'height': 1000}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept()); wire(pg)
    login(pg, 'adm@x', 'admin.html'); pg.wait_for_selector('#atabs:not(.hidden)'); pg.wait_for_timeout(700)
    msg = lambda: pg.inner_text('#dq-a-msg')
    chk('A1 lencana di tab Admin menunjukkan 3 kiriman menunggu', pg.inner_text('#atabs [data-tab=dq]') == 'Daily Quotes (3)', pg.inner_text('#atabs [data-tab=dq]'))
    pg.click('[data-tab=dq]'); pg.wait_for_selector('#dq-q-list .ga-card'); pg.wait_for_timeout(600)
    chk('A2 antrean: 3 kartu "Menunggu" dengan gambar, nama, jabatan, kutipan, pengirim, dan asal (akun atau tanpa akun); filter memuat jumlah', pg.locator('#dq-q-list .ga-card').count() == 3 and 'Menunggu (3)' in pg.inner_text('.ga-seg') and 'Disetujui (0)' in pg.inner_text('.ga-seg') and 'Pengirim Andi' in pg.inner_text('#dq-q-list') and 'akun SHEDINO' in pg.inner_text('#dq-q-list') and 'tanpa akun' in pg.inner_text('#dq-q-list') and pg.evaluate("[...document.querySelectorAll('#dq-q-list img')].every(i=>i.complete&&i.naturalWidth>0)"))
    pg.screenshot(path=SHOT + 'v25_antrean.png', full_page=True); axe(pg, 'antrean persetujuan')
    pg.locator('#dq-q-list .ga-card').first.locator('img').click(); pg.wait_for_selector('#dq-a-zoom[open]'); chk('A3 klik gambar membuka pratinjau besar', pg.locator('#dq-a-zoom img').count() == 1); pg.click('#dq-zx')
    card = lambda n: pg.locator('#dq-q-list .ga-card', has_text=n)
    card('Andi').locator('[data-a=ok]').click(); pg.wait_for_timeout(900)
    r = Q("select status, reviewed_by::text, reviewed_at is not null from dq_submissions where name='Andi Saputra'")[0]
    chk('A4 Setujui: status "approved", peninjau dan waktu tercatat, pesan konfirmasi, hitungan filter diperbarui (2, 1, 0), lencana tab berkurang', r == ('approved', str(adm), True) and 'disetujui' in msg() and 'Menunggu (2)' in pg.inner_text('.ga-seg') and 'Disetujui (1)' in pg.inner_text('.ga-seg') and pg.inner_text('#atabs [data-tab=dq]') == 'Daily Quotes (2)', (r, msg()))
    ok, n = P(None, "select count(*) from dq_submissions", role='anon'); chk('A5 poster yang disetujui langsung terlihat publik (1); yang menunggu tidak', ok and n == 1, n)
    card('Bima').locator('[data-a=no]').click(); pg.wait_for_selector('#dq-rf'); pg.fill('#dq-rr', 'Foto buram'); pg.click('#dq-rf button[type=submit]'); pg.wait_for_timeout(900)
    chk('A6 Tolak dengan alasan: tersimpan dan hanya admin yang melihat; kartu pindah ke tab Ditolak', Q("select status, reason from dq_submissions where name='Bima Prakoso'")[0] == ('rejected', 'Foto buram') and 'Ditolak (1)' in pg.inner_text('.ga-seg'))
    pg.click('.ga-seg [data-f=rejected]'); pg.wait_for_selector('#dq-q-list .ga-card'); chk('A7 tab Ditolak menampilkan alasan dan tombol Setujui', 'Foto buram' in pg.inner_text('#dq-q-list') and pg.locator('[data-a=ok]').count() == 1)
    pg.click('.ga-seg [data-f=approved]'); pg.wait_for_selector('#dq-q-list .ga-card'); pg.locator('[data-a=unpub]').click(); pg.wait_for_timeout(900)
    chk('A8 Batalkan tayang: kembali ke antrean menunggu dan hilang dari publik', Q1("select status from dq_submissions where name='Andi Saputra'") == 'pending' and P(None, "select count(*) from dq_submissions", role='anon')[1] == 0)
    pg.click('.ga-seg [data-f=pending]'); pg.wait_for_selector('#dq-q-list .ga-card'); card('Citra').locator('[data-a=del]').click(); pg.wait_for_timeout(900)
    chk('A9 Hapus (dengan konfirmasi): baris hilang dari database', Q1("select count(*) from dq_submissions where name='Citra Lestari'") == 0 and card('Citra').count() == 0)
    # ===== templat =====
    pg.click('.ga-tabs [data-s=tpl]'); pg.wait_for_selector('#dq-t-add'); pg.wait_for_timeout(500)
    chk('T1 daftar templat: templat contoh tampil aktif dengan ukuran 1080 x 1350 dan 4 kotak teks', pg.locator('.ga-card').count() == 1 and 'Aktif' in pg.inner_text('.ga-card') and '1080 x 1350' in pg.inner_text('.ga-card') and '4 kotak teks' in pg.inner_text('.ga-card'))
    axe(pg, 'daftar templat')
    pg.click('#dq-t-add'); pg.wait_for_selector('#dq-stage'); pg.wait_for_timeout(500)
    chk('T2 editor templat baru: 1 kotak foto + 3 kotak teks bawaan (Nama, Jabatan, Kata-kata), kotak foto terpilih', pg.locator('.dq-bx').count() == 4 and pg.locator('.dq-bx.photo').count() == 1 and pg.locator('.dq-bx.on').count() == 1 and 'Foto orang' in pg.inner_text('#dq-e-form'))
    pg.click('#dq-e-save'); pg.wait_for_timeout(300); chk('T3 simpan tanpa nama ditolak dengan pesan jelas', 'Nama templat wajib' in pg.inner_text('#dq-e-msg'))
    pg.fill('#dq-e-name', 'Templat Uji'); pg.click('#dq-e-save'); pg.wait_for_timeout(300); chk('T4 simpan tanpa latar mentahan ditolak dengan pesan jelas', 'latar mentahan' in pg.inner_text('#dq-e-msg'))
    pg.set_input_files('#dq-e-back', FX + 'area-baru.jpg'); pg.wait_for_function("document.getElementById('dq-stage').style.aspectRatio.includes('1600')"); pg.wait_for_timeout(600)
    chk('T5 unggah latar 2000x1200: dikecilkan jadi 1600x960 dan bentuk panggung mengikuti', '1600 / 960' in pg.get_attribute('#dq-stage', 'style') or '1600/960' in pg.get_attribute('#dq-stage', 'style'), pg.get_attribute('#dq-stage', 'style'))
    px = lambda e: pg.evaluate(f"(()=>{{const e=document.querySelector('{e}');return [parseFloat(e.style.left),parseFloat(e.style.top),parseFloat(e.style.width),parseFloat(e.style.height)]}})()")
    pg.evaluate("document.getElementById('dq-stage').scrollIntoView({block:'start'})"); pg.wait_for_timeout(150); bx = pg.locator('.dq-bx.photo').bounding_box(); sg = pg.locator('#dq-stage').bounding_box(); before = px('.dq-bx.photo')
    pg.evaluate("window.__ev=[]; ['pointerdown','pointermove','pointerup'].forEach(n=>document.addEventListener(n,e=>window.__ev.push(n+':'+(e.target.className&&e.target.className.baseVal!==undefined?e.target.className.baseVal:(e.target.className||e.target.tagName))),true))")
    dbg = (bx, pg.evaluate(f"(()=>{{const e=document.elementFromPoint({bx['x']+bx['width']/2},{bx['y']+bx['height']/2});return e?e.tagName+'.'+e.className+' #'+e.id:'null'}})()"), pg.evaluate('scrollY'))
    pg.mouse.move(bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2); pg.mouse.down(); pg.mouse.move(bx['x'] + bx['width'] / 2 - 40, bx['y'] + bx['height'] / 2 + 25, steps=6); pg.mouse.up(); pg.wait_for_timeout(300); after = px('.dq-bx.photo')
    chk('T6 seret kotak foto: posisi berubah (kiri-atas) dan angka di formulir ikut', after[0] < before[0] - 2 and after[1] > before[1] + 1 and abs(float(pg.input_value('#dq-g-x')) - after[0]) < 0.11, (before, after, dbg, pg.evaluate('window.__ev.slice(0,6)')))
    pg.evaluate("document.getElementById('dq-stage').scrollIntoView({block:'start'})"); pg.wait_for_timeout(150); h = pg.locator('.dq-bx.photo .dq-h').bounding_box(); pg.mouse.move(h['x'] + 8, h['y'] + 8); pg.mouse.down(); pg.mouse.move(h['x'] - 40, h['y'] - 30, steps=6); pg.mouse.up(); pg.wait_for_timeout(300); res = px('.dq-bx.photo')
    chk('T7 tarik sudut kanan-bawah: ukuran mengecil dan tidak keluar dari panggung', res[2] < after[2] - 2 and res[3] < after[3] - 1 and res[0] + res[2] <= 100.01 and res[1] + res[3] <= 100.01, (after, res))
    pg.locator('.dq-bx.txt').first.focus(); x0 = px('.dq-bx.txt')[0]; pg.keyboard.press('ArrowRight'); pg.keyboard.press('ArrowRight'); x1 = px('.dq-bx.txt')[0]; w0 = px('.dq-bx.txt')[2]; pg.keyboard.press('Control+ArrowLeft'); w1 = px('.dq-bx.txt')[2]
    chk('T8 papan ketik: panah kanan 2x menggeser 1 persen; Ctrl + panah kiri mengecilkan lebar 0,5; fokus memilih kotak itu', abs(x1 - x0 - 1) < 0.01 and abs(w0 - w1 - 0.5) < 0.01 and 'Kotak teks: Nama' in pg.inner_text('#dq-e-form'), (x0, x1, w0, w1))
    pg.fill('#dq-g-x', '12.5'); chk('T9 isian angka "Kiri" menggeser kotak persis ke 12,5%', px('.dq-bx.txt.on')[0] == 12.5, px('.dq-bx.txt.on'))
    pg.select_option('#dq-f-key', 'quote'); pg.wait_for_timeout(200)
    chk('T10 jenis isian yang sudah dipakai kotak lain ditolak dan dikembalikan (Nama diganti ke Kata-kata: ditolak)', 'sudah dipakai' in pg.inner_text('#dq-e-msg') and pg.input_value('#dq-f-key') == 'name', pg.inner_text('#dq-e-msg'))
    pg.fill('#dq-f-size', '5'); pg.fill('#dq-f-color', '#ff0000') if False else pg.evaluate("(()=>{const e=document.getElementById('dq-f-color');e.value='#ff0000';e.dispatchEvent(new Event('input',{bubbles:true}))})()"); pg.check('#dq-f-sh'); pg.fill('#dq-f-sample', 'Contoh Panjang Untuk Uji'); pg.wait_for_timeout(300)
    pg.click('#dq-e-addf'); pg.wait_for_timeout(200); chk('T11 tambah kotak teks: jadi 5 kotak teks, kotak baru terpilih dengan nama "Teks 1"', pg.locator('.dq-bx.txt').count() == 4 and 'Teks 1' in pg.inner_text('#dq-e-form'), pg.locator('.dq-bx.txt').count())
    for _ in range(5): pg.click('#dq-e-addf'); pg.wait_for_timeout(80)
    chk('T12 maksimal 8 kotak teks: pesan jelas saat ditambah lagi', pg.locator('.dq-bx.txt').count() == 8 and 'Maksimal 8' in pg.inner_text('#dq-e-msg'), pg.inner_text('#dq-e-msg'))
    pg.click('#dq-f-del'); pg.wait_for_timeout(200); chk('T13 hapus kotak teks: tersisa 7', pg.locator('.dq-bx.txt').count() == 7)
    axe(pg, 'editor templat'); pg.screenshot(path=SHOT + 'v25_editor.png', full_page=True)
    pg.click('#dq-e-save'); pg.wait_for_selector('#dq-t-add', timeout=30000); pg.wait_for_timeout(600)
    row = Q("select name,w,h,active,jsonb_array_length(fields),back_image,front_image,photo,fields from dq_templates where name='Templat Uji'")[0]
    nm = [f for f in row[8] if f['key'] == 'name'][0]
    chk('T14 templat tersimpan: ukuran 1600x960, aktif, 7 kotak teks, latar diunggah ke penyimpanan situs; posisi, ukuran, warna, bayangan sesuai editor', row[:5] == ('Templat Uji', 1600, 960, True, 7) and '/site-media/dq/templates/' in row[5] and row[5].endswith('-back.jpg') and row[6] == '' and nm['x'] == 12.5 and nm['size'] == 5 and nm['color'] == '#FF0000' and nm['shadow'] is True and nm['sample'] == 'Contoh Panjang Untuk Uji', (row[:7], nm))
    chk('T15 berkas latar tersimpan sebagai JPEG di penyimpanan', any(k.startswith('site-media/dq/templates/') and v[1] == 'image/jpeg' for k, v in STORE.items()))
    pg.locator('.ga-card', has_text='Templat Uji').locator('[data-a=up]').click(); pg.wait_for_timeout(1200)
    chk('T16 tombol naikkan urutan: templat baru menjadi pertama (urutan 0)', Q("select name from dq_templates order by sort_order, created_at")[0][0] == 'Templat Uji')
    pg.locator('.ga-card', has_text='contoh').locator('[data-a=edit]').click(); pg.wait_for_selector('#dq-stage'); pg.wait_for_timeout(500)
    chk('T17 ubah templat yang ada: editor memuat 4 kotak teks, latar dan lapisan depan lama', pg.locator('.dq-bx.txt').count() == 4 and pg.locator('#dq-e-nofront').count() == 1 and pg.input_value('#dq-e-name').startswith('Daily Safety Quotes'))
    pg.fill('#dq-e-name', 'Daily Safety Quotes (diubah)'); pg.click('#dq-e-save'); pg.wait_for_selector('#dq-t-add', timeout=30000); pg.wait_for_timeout(500)
    r2 = Q("select name, front_image, back_image from dq_templates where name like 'Daily Safety Quotes (diubah)'")[0]
    chk('T18 perubahan nama tersimpan; lapisan depan dan latar lama tidak hilang', r2[1].startswith('assets/dq/') and r2[2].startswith('assets/dq/'), r2)
    pg.locator('.ga-card', has_text='diubah').locator('[data-a=tg]').click(); pg.wait_for_timeout(900)
    chk('T19 Nonaktifkan: pengunjung tidak lagi melihat templat itu', Q1("select active from dq_templates where name like '%diubah%'") is False and P(None, "select count(*) from dq_templates", role='anon')[1] == 1)
    pg.locator('.ga-card', has_text='diubah').locator('[data-a=tg]').click(); pg.wait_for_timeout(700)
    # halaman publik memakai templat baru
    pub = ctx.new_page(); wire(pub); pub.goto(BASE + '/daily-quotes.html'); pub.wait_for_selector('#dq-cv'); pub.wait_for_timeout(900)
    chk('T20 halaman publik: 2 pilihan templat; templat pertama (baru, 1600x960) dipakai dengan 7 kolom teks dan pratinjau berbentuk lanskap', pub.locator('.dq-tpl').count() == 2 and pub.locator('#dq-app [data-k]').count() == 7 and abs(pub.locator('#dq-cv').bounding_box()['height'] / pub.locator('#dq-cv').bounding_box()['width'] - 0.6) < 0.02)
    pub.click('.dq-tpl >> nth=1'); pub.wait_for_timeout(900)
    chk('T21 memilih templat kedua: kolom teks dan bentuk pratinjau berganti (4 kolom, poster 4:5)', pub.locator('#dq-app [data-k]').count() == 4 and abs(pub.locator('#dq-cv').bounding_box()['height'] / pub.locator('#dq-cv').bounding_box()['width'] - 1.25) < 0.02); pub.close()
    pg.locator('.ga-card', has_text='Templat Uji').locator('[data-a=del]').click(); pg.wait_for_timeout(900); chk('T22 Hapus templat (konfirmasi): tersisa 1', Q1("select count(*) from dq_templates") == 1)
    # ===== pengaturan =====
    pg.click('.ga-tabs [data-s=set]'); pg.wait_for_selector('#dq-sf'); pg.wait_for_timeout(300)
    chk('N1 pengaturan terisi dari database (aktif, tanpa wajib login, batas antrean 100, batas harian 5)', pg.is_checked('#dq-s-en') and not pg.is_checked('#dq-s-lg') and pg.input_value('#dq-s-mp') == '100' and pg.input_value('#dq-s-pt') == '5')
    axe(pg, 'pengaturan')
    pg.fill('#dq-s-mp', '0'); pg.click('#dq-sf button[type=submit]'); pg.wait_for_timeout(300); chk('N2 batas antrean di luar 1-2000 ditolak dengan pesan jelas; database tidak berubah', '1 sampai 2000' in msg() and Q1("select max_pending from dq_settings") == 100, msg())
    pg.fill('#dq-s-mp', '40'); pg.fill('#dq-s-pt', '3'); pg.check('#dq-s-lg'); pg.fill('#dq-s-nt', 'Pesan baru dari admin.'); pg.click('#dq-sf button[type=submit]'); pg.wait_for_timeout(800)
    chk('N3 pengaturan tersimpan ke database', Q("select enabled, require_login, max_pending, per_token_daily, notice from dq_settings")[0] == (True, True, 40, 3, 'Pesan baru dari admin.') and 'tersimpan' in msg())
    # ===== tombol artikel dari formulir Admin =====
    pg.click('[data-tab=media]'); pg.wait_for_selector('#c-list [data-edit]'); pg.wait_for_timeout(400)
    pg.locator('#c-list tr', has_text='Berita biasa').locator('[data-edit]').click(); pg.wait_for_selector('#cform [data-k=cta]')
    opts = pg.evaluate("[...document.querySelectorAll('#cform [data-k=cta] option')].map(o=>o.value)")
    chk('K1 formulir artikel memiliki pilihan "Tombol Buat Daily Quotes": otomatis, selalu, jangan tampilkan', opts == ['', 'dailyquotes', 'none'], opts)
    pg.select_option('#cform [data-k=cta]', 'dailyquotes'); pg.click('#csave'); pg.wait_for_timeout(1200)
    chk('K2 pilihan "Selalu tampilkan" tersimpan di artikel (kolom cta)', Q1("select cta from media_posts where id='biasa'") == 'dailyquotes')
    chk('K3 tanpa error JS (desktop)', errs == [], errs[:3]); ctx.close()
    # ===== ponsel =====
    m = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); mp = m.new_page(); me = []; mp.on('pageerror', lambda e: me.append(str(e))); mp.on('dialog', lambda d: d.accept()); wire(mp)
    login(mp, 'adm@x', 'admin.html'); mp.wait_for_selector('#atabs:not(.hidden)'); mp.click('[data-tab=dq]'); mp.wait_for_selector('#dq-q-list'); mp.wait_for_timeout(600); over = lambda: mp.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth"); res = [over()]
    mp.click('.ga-tabs [data-s=tpl]'); mp.wait_for_selector('#dq-t-add'); mp.wait_for_timeout(500); res.append(over())
    mp.locator('.ga-card [data-a=edit]').first.click(); mp.wait_for_selector('#dq-stage'); mp.wait_for_timeout(700); res.append(over())
    small = mp.evaluate("[...document.querySelectorAll('#dq-panel button,#dq-panel select')].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height<44&&!e.classList.contains('dq-h')).length")
    chk('M1 ponsel 390px: antrean, daftar templat, dan editor tanpa scroll samping; tombol ≥44px', not any(res) and small == 0 and not me, (res, small, me[:2]))
    mp.screenshot(path=SHOT + 'v25_editor_m.png'); m.close(); b.close()
done()
