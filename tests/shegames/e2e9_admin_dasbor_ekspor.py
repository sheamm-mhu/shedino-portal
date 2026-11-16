import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'e2e_base.py'), encoding='utf-8').read())
from playwright.sync_api import sync_playwright
import openpyxl
adm = mkuser('adm@x', 'Admin', 'SHE', role='admin')
U = {n: mkuser(f'{n}@x', nm, d) for n, nm, d in [('a', 'Andi', 'Produksi'), ('b', 'Bima', 'Plant'), ('c', 'Citra', 'Produksi'), ('d', 'Dodi', 'Plant'), ('e', 'Eka', ''), ('f', 'Fitri', 'SHE')]}
Q("update profiles set employee_id=%s where id=%s", ('NIK-ANDI', U['a']))
Q("update game_settings set active_levels='{2,3,4}', pass_score=60")
qs = [r[0] for r in Q("select id::text from game_questions order by q limit 3")]; sg = [r[0] for r in Q("select id::text from game_signs order by name limit 2")]; sc = Q1("select id::text from game_scenes")
def att(u, level, score, wrong=(), ts=None):
    Q("insert into game_attempts(user_id,level,week,status,finished_at,duration_ms,score,passed,wrong_ids) values (%s,%s,public.game_week_start(coalesce(%s::timestamptz, now())),'finished',coalesce(%s::timestamptz, now()),65000,%s,%s,%s)", (U[u], level, ts, ts, score, score >= 60, list(wrong)))
att('a', 3, 90, [qs[0]]); att('a', 2, 80, [sg[0], sg[1]]); att('a', 4, 70, [sc + ':2']); att('b', 3, 40, [qs[0], qs[1]]); att('b', 3, 80, [qs[0]]); att('c', 3, 100); att('c', 2, 50, [sg[0]]); att('e', 3, 60); att('f', 4, 30, [sc + ':2', sc + ':0'])
att('d', 3, 100, [qs[2]], ts=str(Q1("select (public.game_week_start()-7)::timestamptz")))
PRINT = "window.__printed=0; window.print=()=>{window.__printed++}"
AXE = open(os.environ.get('AXE_JS', 'axe.min.js')).read()
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1366, 'height': 1000}, accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.add_init_script(PRINT); pg.on('pageerror', lambda e: errs.append(str(e))); wire(pg)
    login(pg, 'adm@x', 'admin.html'); pg.wait_for_selector('#atabs:not(.hidden)'); pg.click('[data-tab=games]'); pg.wait_for_selector('.ga-kpi'); pg.wait_for_timeout(500)
    tabs = pg.evaluate("[...document.querySelectorAll('.ga-tabs [role=tab]')].map(b=>b.textContent.trim()+':'+b.getAttribute('aria-selected'))")
    chk('H1 tab SHEGAMES kini dibuka di Dasbor (tab pertama dan terpilih); 7 tab', len(tabs) == 7 and tabs[0] == 'Dasbor:true', tabs)
    kp = pg.inner_text('.ga-kpis')
    chk('H2 KPI: peserta aktif 5 dari 7 (71,4%), rata-rata 70, lulus semua level 1, skor tertinggi 240, level aktif 3 (L2, L3, L4)', '5 dari 7' in kp and '71,4%' in kp and '\n70\n' in ('\n' + kp.replace('\n\n', '\n') + '\n') and '240' in kp and 'L2, L3, L4' in kp, kp)
    chk('H3 periode ditampilkan dan pilihan minggu berisi 12 minggu (awal: minggu ini)', 'Minggu' in pg.inner_text('.ga-dtitle') and pg.locator('#ga-d-w option').count() == 12)
    lv = pg.inner_text('#ga-d-h1 ~ .ga-scroll'); chk('H4 per level: tiga baris dengan tingkat lulus (L3 100%, L2 50%, L4 50%)', pg.locator('#ga-d-h1 ~ .ga-scroll tbody tr').count() == 3 and '100%' in lv and '50%' in lv, lv)
    dp = pg.inner_text('#ga-d-h2 ~ .ga-scroll')
    chk('H5 per departemen: Produksi 2 dari 2, Plant 1 dari 2, partisipasi dan rata-rata skor tampil; "(belum diisi)" untuk yang kosong', 'Produksi' in dp and '2 dari 2' in dp and '1 dari 2' in dp and '(belum diisi)' in dp and '78' in dp, dp)
    wr = pg.inner_text('.ga-wrong'); chk('H6 5 topik paling sering salah: teratas "3x salah", memuat teks soal dan nama rambu', '3x salah' in wr and pg.locator('.ga-wrong li').count() <= 5 and 'L3' in wr, wr)
    rk = pg.inner_text('#ga-d-h4 ~ .ga-scroll')
    chk('H7 peringkat lengkap: 4 baris, NIK tampil (khusus admin), Andi peringkat 1 dengan total 240', pg.locator('#ga-d-h4 ~ .ga-scroll tbody tr').count() == 4 and 'NIK-ANDI' in rk and '240' in rk, rk)
    pg.screenshot(path=SHOT + 'v21_dasbor.png', full_page=True)
    pg.select_option('#ga-d-w', index=1); pg.wait_for_timeout(800)
    chk('H8 pilih minggu lalu: 1 peserta aktif (Dodi) dan satu topik salah', '1 dari 7' in pg.inner_text('.ga-kpis') and pg.locator('.ga-wrong li').count() == 1)
    pg.click('.ga-seg [data-m=month]'); pg.wait_for_selector('#ga-d-m:not([hidden])'); pg.wait_for_timeout(700)
    chk('H9 mode Bulanan: pilihan 12 bulan tampil dan data dimuat ulang', pg.locator('#ga-d-m option').count() == 12 and pg.is_hidden('#ga-d-w') and 'Peserta aktif' in pg.inner_text('.ga-kpis'))
    pg.click('.ga-seg [data-m=all]'); pg.wait_for_timeout(800)
    chk('H10 mode Semua waktu: 6 peserta aktif (termasuk Dodi) dan kedua pilihan periode disembunyikan', '6 dari 7' in pg.inner_text('.ga-kpis') and pg.is_hidden('#ga-d-w') and pg.is_hidden('#ga-d-m') and 'Semua waktu' in pg.inner_text('.ga-dtitle'))
    pg.click('.ga-seg [data-m=week]'); pg.wait_for_timeout(400); pg.select_option('#ga-d-w', index=0); pg.wait_for_timeout(700)
    chk('H10b kembali ke Mingguan mempertahankan pilihan minggu terakhir (bisa dipilih ulang ke minggu ini)', '5 dari 7' in pg.inner_text('.ga-kpis'))
    # ---- ekspor Excel
    with pg.expect_download() as dl: pg.click('#ga-d-xls')
    path = SHOT + 'dasbor.xlsx'; dl.value.save_as(path); wb = openpyxl.load_workbook(path)
    chk('H11 ekspor Excel: berkas sah dengan 5 lembar (Ringkasan, Peringkat, Per departemen, Per level, Topik sering salah)', wb.sheetnames == ['Ringkasan', 'Peringkat', 'Per departemen', 'Per level', 'Topik sering salah'] and dl.value.suggested_filename.startswith('dasbor-shegames-') and dl.value.suggested_filename.endswith('.xlsx'), (wb.sheetnames, dl.value.suggested_filename))
    ring = {r[0].value: r[1].value for r in wb['Ringkasan'].iter_rows(min_row=1, max_row=12) if r[0].value}
    chk('H12 lembar Ringkasan memuat KPI yang sama dengan layar (angka sebagai angka)', ring.get('Peserta aktif') == 5 and ring.get('Akun terdaftar') == 7 and ring.get('Lulus semua level aktif') == 1 and ring.get('Skor tertinggi') == 240 and ring.get('Rata-rata skor') == 70, ring)
    pr = [[c.value for c in r] for r in wb['Peringkat'].iter_rows()]
    chk('H13 lembar Peringkat: judul kolom, Andi dengan NIK dan total 240 (angka), waktu dalam detik', pr[0][:5] == ['Peringkat', 'Nama', 'NIK', 'Departemen', 'Level lulus'] and pr[1][1] == 'Andi' and pr[1][2] == 'NIK-ANDI' and pr[1][-2] == 240 and pr[1][-1] == 195 and len(pr) == 5, pr[:2])
    lvx = [[c.value for c in r] for r in wb['Per level'].iter_rows()]
    chk('H14 lembar Per level, Per departemen, dan Topik sering salah terisi', len(lvx) == 4 and lvx[1][1] in ('Tebak rambu', 'Pilihan ganda', 'Tebak bahaya') and wb['Per departemen'].max_row >= 5 and wb['Topik sering salah'].max_row >= 2 and wb['Topik sering salah']['D2'].value == 3, lvx)
    # ---- cetak
    pg.click('#ga-d-print'); chk('H15 tombol Cetak memanggil dialog cetak browser', pg.evaluate("window.__printed") == 1)
    pg.emulate_media(media='print'); pg.wait_for_timeout(200)
    hidden = pg.evaluate("['.top','#atabs','.ga-pub','.ga-tabs','.ga-dtools'].map(s=>{const e=document.querySelector(s);return !e||getComputedStyle(e).display==='none'})")
    chk('H16 tampilan cetak: menu, tab, dan tombol disembunyikan; KPI dan tabel tetap tampil', all(hidden) and pg.is_visible('.ga-kpis') and pg.is_visible('#ga-d-h4'), hidden)
    pg.emulate_media(media='screen')
    # ---- aksesibilitas
    pg.wait_for_timeout(600); pg.evaluate(AXE); v = pg.evaluate("axe.run(document.getElementById('games-panel'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},resultTypes:['violations']})")['violations']
    chk('H17 aksesibilitas dasbor: 0 pelanggaran', v == [], [(x['id'], x['impact'], x['nodes'][0]['target'][0]) for x in v][:4])
    chk('H18 tanpa error JS', errs == [], errs[:3]); ctx.close()
    # ---- ponsel
    m = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); mp = m.new_page(); me = []; mp.on('pageerror', lambda e: me.append(str(e))); wire(mp)
    login(mp, 'adm@x', 'admin.html'); mp.wait_for_selector('#atabs:not(.hidden)'); mp.click('[data-tab=games]'); mp.wait_for_selector('.ga-kpi'); mp.wait_for_timeout(600)
    over = mp.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth"); small = mp.evaluate("[...document.querySelectorAll('#games-panel button,#games-panel select')].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height<44).length")
    chk('H19 ponsel 390px: dasbor tanpa scroll samping (tabel bergeser di kotaknya), tombol dan pilihan ≥44px', not over and small == 0 and not me, (over, small, me[:2]))
    mp.screenshot(path=SHOT + 'v21_dasbor_m.png'); m.close(); b.close()
done()
