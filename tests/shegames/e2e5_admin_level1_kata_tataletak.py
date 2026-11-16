import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'e2e_base.py'), encoding='utf-8').read())
from playwright.sync_api import sync_playwright
import openpyxl
adm = mkuser('adm@x', 'Admin SHE', 'SHE', role='admin'); ply = mkuser('budi@x', 'Budi Santoso', 'Produksi')
FX = os.environ.get('SG_FIXTURES', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures') + os.sep)
def grid_ok():
    try: Q("select public.game_check_layout(grid, true) from public.game_layout where id=1"); return True, ''
    except Exception as e: return False, str(e)[:160]
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1366, 'height': 900}, accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept()); wire(pg)
    login(pg, 'adm@x', 'admin.html'); pg.wait_for_selector('#atabs:not(.hidden)'); pg.click('[data-tab=games]'); pg.wait_for_selector('.ga-tabs'); pg.click('.ga-tabs [data-g=set]'); pg.wait_for_selector('#ga-set')
    msg = lambda: pg.inner_text('#ga-msg')
    tabs = pg.evaluate("[...document.querySelectorAll('.ga-tabs [role=tab]')].map(b=>b.textContent.trim())")
    chk('T1 tujuh tab: Dasbor, Umum, 1 Teka-teki silang, 2 Tebak rambu, 3 Pilihan ganda, 4 Tebak bahaya, Peserta & skor', len(tabs) == 7 and tabs[0] == 'Dasbor' and tabs[2].startswith('1') and tabs[5].startswith('4'), tabs)
    chk('T2 tab Umum: keempat level bisa dicentang (tidak ada lagi "segera hadir") dan semuanya aktif; waktu dan penalti tidak lagi di sini', pg.locator('[data-lv]:disabled').count() == 0 and pg.locator('[data-lv]:checked').count() == 4 and pg.locator('[data-s=timer_mcq]').count() == 0 and 'segera hadir' not in pg.inner_text('#ga-set').lower())
    # ---- level 1: pengaturan
    pg.click('.ga-tabs [data-g=l1]'); pg.wait_for_selector('.ga-lset'); pg.wait_for_selector('#ga-w-tbl tbody tr')
    chk('L1a tab level 1: pengaturan level (bantuan huruf 3, penalti 5) ada di tabnya sendiri', pg.input_value('[data-ls=hint_max]') == '3' and pg.input_value('[data-ls=hint_penalty]') == '5' and 'Pengaturan level 1' in pg.inner_text('.ga-lset'))
    pg.fill('[data-ls=hint_max]', '25'); pg.click('.ga-lset button[type=submit]'); pg.wait_for_timeout(300)
    chk('L1b nilai di luar batas ditolak dengan pesan jelas; database tidak berubah', '0 sampai 20' in msg() and Q1("select hint_max from game_settings") == 3, msg())
    pg.fill('[data-ls=hint_max]', '2'); pg.fill('[data-ls=hint_penalty]', '10'); pg.click('.ga-lset button[type=submit]'); pg.wait_for_timeout(600)
    chk('L1c pengaturan level 1 tersimpan ke database (bantuan 2, penalti 10)', Q("select hint_max,hint_penalty from game_settings")[0] == (2, 10) and 'level 1 tersimpan' in msg())
    pg.uncheck('.ga-lset [data-active]'); pg.click('.ga-lset button[type=submit]'); pg.wait_for_timeout(600)
    chk('L1d mematikan "Level aktif" di tab level menonaktifkan level 1 saja', Q1("select active_levels from game_settings") == [2, 3, 4])
    pg.check('.ga-lset [data-active]'); pg.click('.ga-lset button[type=submit]'); pg.wait_for_timeout(600)
    chk('L1e dinyalakan kembali', Q1("select active_levels from game_settings") == [1, 2, 3, 4])
    # ---- daftar kata & tata letak bawaan
    chk('L1f 15 kata bawaan dan tata letak tersimpan sesuai (kotak terisi 87, status hijau)', pg.locator('#ga-w-tbl tbody tr').count() == 15 and 'sesuai dengan 15 kata' in pg.inner_text('#ga-lay-st') and pg.locator('.ga-lc').count() == 87, pg.inner_text('#ga-lay-st'))
    # ---- tambah kata: tata letak dibuat ulang otomatis
    pg.click('#ga-w-add'); pg.wait_for_selector('#ga-wf'); pg.fill('#ga-wf-w', 'ma sker'); pg.fill('#ga-wf-c', 'APD untuk menutup hidung dan mulut'); pg.click('#ga-wf button[type=submit]'); pg.wait_for_selector('#ga-w-tbl tbody tr:nth-child(16)'); pg.wait_for_timeout(500)
    ok, e = grid_ok()
    chk('L1g tambah kata "ma sker" (spasi dibuang, huruf besar): 16 kata, tata letak OTOMATIS dibuat ulang dan sah menurut server', ok and Q1("select count(*) from game_words")==16 and Q1("select jsonb_array_length(grid->'items') from game_layout")==16 and 'dibuat ulang otomatis' in msg(), (e, msg()))
    chk('L1h status kata baru "Draf baru"; ringkasan perubahan di bilah terbit', 'Draf baru' in pg.inner_text('#ga-w-tbl') and 'perubahan belum diterbitkan' in pg.inner_text('#ga-pending'))
    pg.click('#ga-w-add'); pg.wait_for_selector('#ga-wf'); pg.fill('#ga-wf-w', 'QQQQ'); pg.fill('#ga-wf-c', 'kata tanpa huruf bersama'); pg.click('#ga-wf button[type=submit]')
    try: pg.wait_for_function("document.querySelectorAll('#ga-w-tbl tbody tr').length>=17", timeout=8000)
    except Exception: print('DEBUG baris:', pg.locator('#ga-w-tbl tbody tr').count(), '| pesan:', msg()[:200], '| dialog:', pg.inner_text('#ga-wf-m') if pg.locator('#ga-wf-m').count() else '-', '| galat:', errs[-3:], '| DB:', Q1("select count(*) from game_words"))
    pg.wait_for_timeout(500)
    chk('L1i kata tanpa huruf bersama (QQQQ): tata letak diperbarui tanpa kata itu, pesan jelas, peringatan terlihat', 'tidak bisa dipasang' in msg() and Q1("select jsonb_array_length(grid->'items') from game_layout")==16, msg())
    pg.click('#ga-publish'); pg.wait_for_timeout(900)
    chk('L1j terbit ditolak dengan alasan jelas (tata letak harus memuat semua kata); pemain tidak terpengaruh', 'semua kata' in msg() and Q1("select count(*) from game_words where live")==15, msg())
    pg.locator('#ga-w-tbl tr', has_text='QQQQ').locator('[data-act=del]').click(); pg.wait_for_selector('#ga-w-tbl tbody tr:nth-child(16)'); pg.wait_for_timeout(500)
    ok, e = grid_ok(); chk('L1k hapus kata draf: tata letak otomatis sah kembali (16 dari 16)', ok and Q1("select count(*) from game_words")==16, e)
    pg.click('#ga-publish'); pg.wait_for_timeout(1000)
    chk('L1l terbit berhasil: 16 kata tayang, tata letak tayang, level 1 siap', '16 kata TTS' in msg() and Q1("select count(*) from game_words where live")==16 and Q1("select jsonb_array_length(live_grid->'items') from game_layout")==16 and Q1("select public.game_level_ready(1)"), msg())
    # ---- ubah kata tayang
    pg.locator('#ga-w-tbl tr', has_text='HAZARD').locator('[data-act=edit]').click(); pg.wait_for_selector('#ga-wf'); pg.fill('#ga-wf-c', 'Sumber bahaya (petunjuk diubah)'); pg.click('#ga-wf button[type=submit]'); pg.wait_for_timeout(1200)
    chk('L1m ubah kata tayang: status "Diubah, belum terbit"; pemain masih memakai petunjuk lama', 'Diubah, belum terbit' in pg.locator('#ga-w-tbl tr', has_text='HAZARD').inner_text() and 'diubah' not in Q1("select clue from game_words where word='HAZARD'"))
    # ---- pratinjau manual: acak ulang, simpan, batal
    pg.click('#ga-lay-gen'); pg.wait_for_selector('#ga-lay-save'); g1 = pg.inner_html('.ga-laygrid')
    chk('L1n "Buat tata letak otomatis": pratinjau baru muncul dengan tombol Simpan, Acak ulang, dan Batal', 'Pratinjau baru' in pg.inner_text('#ga-lay-st') and pg.locator('#ga-lay-save').count() == 1 and 'Acak ulang' in pg.inner_text('#ga-lay-gen') and pg.locator('#ga-lay-x').count() == 1)
    diff = False
    for _ in range(4):
        pg.click('#ga-lay-gen'); pg.wait_for_timeout(200)
        if pg.inner_html('.ga-laygrid') != g1: diff = True; break
    chk('L1o "Acak ulang" menghasilkan susunan yang berbeda', diff)
    pg.click('#ga-lay-x'); pg.wait_for_timeout(500)
    chk('L1p Batal: kembali ke tata letak tersimpan', 'tersimpan' in pg.inner_text('#ga-lay-st') or 'sesuai' in pg.inner_text('#ga-lay-st'))
    pg.click('#ga-lay-gen'); pg.wait_for_selector('#ga-lay-save'); pg.click('#ga-lay-save'); pg.wait_for_timeout(900); ok, e = grid_ok()
    chk('L1q Simpan pratinjau sebagai draf: tersimpan dan sah menurut server', ok and 'disimpan sebagai draf' in msg(), (e, msg()))
    # ---- impor kata
    def imp(fname):
        pg.set_input_files('#ga-w-file', FX + fname)
        try: pg.wait_for_selector('#ga-imp-sum, #ga-w-st.err', timeout=15000)
        except Exception: pass
        pg.wait_for_timeout(300)
        return pg.inner_text('#ga-imp-sum') if pg.locator('#ga-imp-sum').count() else 'GALAT: ' + pg.inner_text('#ga-w-st')
    def cancel(): pg.click('#ga-imp-x'); pg.wait_for_selector('#ga-w-tbl')
    s = imp('kata_baru.csv'); chk('L1r impor CSV (mode tambah): 3 kata baru siap', '3 kata terbaca: 3 siap' in s, s)
    pg.click('#ga-imp-save'); pg.wait_for_selector('#ga-w-tbl'); pg.wait_for_timeout(900); ok, e = grid_ok()
    chk('L1s setelah simpan: 19 kata (3 draf), tata letak otomatis memuat semua 19 yang bisa dipasang dan sah', Q1("select count(*) from game_words")==19 and ok and Q1("select count(*) from game_words where not live")==3, (e, msg()))
    s = imp('kata.csv'); chk('L1t impor CSV berisi kata yang SUDAH ADA (HAZARD, APD, ISOLASI): semuanya ditandai', '3 kata terbaca: 0 siap disimpan, 3 perlu diperbaiki' in s and 'sudah ada' in pg.inner_text('#ga-imp-list'), s); cancel()
    s = imp('kata.docx'); chk('L1u impor tabel Word: APAR dan TOOLBOX sudah ada -> ditandai', '2 kata terbaca: 0 siap disimpan, 2 perlu diperbaiki' in s, s); cancel()
    s = imp('kata.xlsx'); chk('L1v impor Excel (kolom No, Kata, Clue): 3 kata, "Sepatu Safety" sah (spasi dibuang), RISIKO dan HELM sudah ada', '3 kata terbaca: 1 siap disimpan, 2 perlu diperbaiki' in s, s); cancel()
    s = imp('kata.pdf'); chk('L1w impor PDF berisi teks (pdf.js): 7 kata terbaca', '7 kata terbaca' in s, s); cancel()
    s = imp('scan.pdf'); chk('L1x PDF hasil scan ditolak dengan penjelasan', 'GALAT' in s and 'scan' in s.lower(), s)
    pg.set_input_files('#ga-w-file', {'name': 'gambar.png', 'mimeType': 'image/png', 'buffer': b'\x89PNG'}); pg.wait_for_timeout(400)
    chk('L1y jenis berkas lain ditolak dengan daftar format', '.docx, .xlsx, .csv, .pdf, atau .txt' in pg.inner_text('#ga-w-st'))
    s = imp('kata.txt'); chk('L1z impor teks: 7 baris terbaca (4 siap saat mode ganti)', '7 kata terbaca' in s, s)
    pg.check('input[name=ga-mode][value=replace]'); pg.wait_for_timeout(300)
    chk('L2a mode "Ganti semua": penanda kembar terhadap kata lama hilang; 4 siap, 3 bermasalah (angka, satu huruf, kembar dalam berkas)', '7 kata terbaca: 4 siap disimpan, 3 perlu diperbaiki' in pg.inner_text('#ga-imp-sum'), pg.inner_text('#ga-imp-sum'))
    pg.click('#ga-imp-save'); pg.wait_for_selector('#ga-w-tbl'); pg.wait_for_timeout(1200); ok, e = grid_ok()
    chk('L2b ganti semua: 16 kata tayang ditandai hapus, 3 draf lama dibuang, 4 draf baru; tata letak otomatis untuk 4 kata sah', Q1("select count(*) from game_words where pending_op='delete'")==16 and Q1("select count(*) from game_words where not live")==4 and ok, (e, msg()))
    pg.click('#ga-publish'); pg.wait_for_timeout(1200)
    chk('L2c terbit: tepat 4 kata tayang (HAZARD, APD, EVAKUASI, LOCKOUT) dan level 1 siap', sorted(r[0] for r in Q("select word from game_words")) == ['APD', 'EVAKUASI', 'HAZARD', 'LOCKOUT'] and Q1("select public.game_level_ready(1)"), msg())
    with pg.expect_download() as dl: pg.click('#ga-w-tpl')
    dl.value.save_as(os.path.join(__import__('tempfile').gettempdir(), 'unduh-kata.xlsx')); ws = openpyxl.load_workbook(os.path.join(__import__('tempfile').gettempdir(), 'unduh-kata.xlsx')).active
    chk('L2d templat Excel kata: berkas sah dengan kolom Jawaban dan Petunjuk', [c.value for c in ws[1]] == ['Jawaban', 'Petunjuk'] and ws.max_row == 4)
    # ---- aksesibilitas
    AXE = open(os.environ.get('AXE_JS', 'axe.min.js')).read()
    pg.evaluate(AXE); v = pg.evaluate("axe.run(document.getElementById('games-panel'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},resultTypes:['violations']})")['violations']
    chk('L2e aksesibilitas tab level 1: 0 pelanggaran', v == [], [(x['id'], x['nodes'][0]['target'][0]) for x in v])
    pg.screenshot(path=SHOT + 'v19_admin_l1.png', full_page=True)
    chk('L2f tanpa error JS', errs == [], errs[:3]); ctx.close(); b.close()
done()
