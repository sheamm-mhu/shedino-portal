import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'e2e_base.py'), encoding='utf-8').read())
from playwright.sync_api import sync_playwright
me = mkuser('budi@x', 'Budi Santoso', '')
others = [mkuser('sari@x', 'Sari Wulandari', 'Plant'), mkuser('dodi@x', 'Dodi Pratama', 'Produksi'), mkuser('lama@x', 'Lia Lama', 'Plant')]
pend = mkuser('baru@x', 'Pengguna Baru', 'Produksi', status='pending')
# skor pemain lain: minggu ini (2 orang) dan bulan lalu (1 orang)
Q("insert into game_attempts(user_id,level,week,status,finished_at,duration_ms,score,passed,total,correct) values (%s,3,public.game_week_start(),'finished',now(),60000,90,true,10,9),(%s,3,public.game_week_start(),'finished',now(),70000,70,true,10,7)", (others[0], others[1]))
Q("insert into game_attempts(user_id,level,week,status,finished_at,duration_ms,score,passed,total,correct) values (%s,3,public.game_week_start(now()-interval '40 days'),'finished',now()-interval '40 days',50000,100,true,10,10)", (others[2],))
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1366, 'height': 900}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and 'fonts' not in m.text.lower() and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None)
    wire(pg)
    # ---- A. tamu
    pg.goto(BASE + '/shegames.html'); pg.wait_for_timeout(1200)
    chk('A1 tamu: diminta masuk, tombol menuju masuk.html?next=shegames.html', 'Masuk untuk bermain' in pg.inner_text('#g-view') and pg.get_attribute('#g-view a.g-btn', 'href') == 'masuk.html?next=shegames.html')
    chk('A2 logo SHEGAMES di sidebar termuat', pg.evaluate("(()=>{const i=document.querySelector('.g-logo img');return i.complete&&i.naturalWidth>0})()"))
    pg.goto(BASE + '/index.html'); pg.wait_for_timeout(700)
    chk('A3 menu situs memuat tautan SHEGAMES', pg.get_attribute('#nav a[data-k=shegames]', 'href') == 'shegames.html')
    # ---- B. masuk + departemen
    login(pg, 'budi@x'); pg.wait_for_timeout(1500)
    chk('B1 setelah masuk dari SHEGAMES, kembali ke SHEGAMES', pg.url.endswith('shegames.html'))
    chk('B2 akun tanpa departemen: dialog "Lengkapi departemen" muncul dengan 7 pilihan', pg.is_visible('#g-dept') and pg.locator('#g-dept-in option').count() == 8)
    pg.click('#g-dept-ok'); pg.wait_for_timeout(300)
    chk('B3 menyimpan tanpa memilih ditolak dengan pesan', pg.is_visible('#g-dept-err'))
    pg.select_option('#g-dept-in', 'Produksi'); pg.click('#g-dept-ok'); pg.wait_for_timeout(1200)
    chk('B4 departemen tersimpan di database dan tampil di sidebar', Q1("select department from profiles where id=%s", (me,)) == 'Produksi' and pg.inner_text('#g-dp') == 'Produksi' and not pg.is_visible('#g-dept'))
    # ---- C. lobi
    pg.wait_for_selector('.g-level'); pg.wait_for_timeout(500)
    wk = Q1("select public.game_week_start()"); iy, iw, _ = wk.isocalendar()
    chk('C1 lobi: sapaan nama depan, 4 kartu level dengan bentuk rambu, label minggu ISO di sidebar', 'Halo, Budi' in pg.inner_text('.g-hero') and pg.locator('.g-level').count() == 4 and pg.inner_text('#g-week-l') == f'Minggu {iw}, {iy}', pg.inner_text('#g-week-l'))
    lv = pg.evaluate("[...document.querySelectorAll('.g-level')].map(c=>[c.querySelector('.g-lv').textContent,c.querySelector('.g-pill').textContent,!!c.querySelector('a.g-btn')])")
    chk('C2 level 3 bisa dimainkan; level 1, 2, 4 "Belum tersedia" (belum ada konten)', lv == [['Level 1', 'Belum tersedia', False], ['Level 2', 'Belum tersedia', False], ['Level 3', 'Percobaan 0', True], ['Level 4', 'Belum tersedia', False]], lv)
    chk('C3 peringkat minggu ini di sapaan: belum ada (-)', '-' in pg.inner_text('.g-stat:nth-child(3)'))
    pg.screenshot(path='/tmp/v14_lobi.png')
    # ---- D. bermain level 3
    pg.click('.g-level:nth-child(3) a.g-btn'); pg.wait_for_selector('.g-opt'); pg.wait_for_timeout(300)
    att = Q1("select id from game_attempts where user_id=%s and status='active'", (me,))
    def correct_text(i):
        st = Q1("select state from game_sessions where attempt_id=%s", (att,)); it = st['items'][i]
        q = Q("select opts, key, expl from game_questions where id=%s", (it['id'],))[0]; return q[0][q[1]], q[2]
    chk('D1 soal 1 dari 10, 4 pilihan berlabel A-D, ada penghitung waktu', 'Soal 1 dari 10' in pg.inner_text('.g-bar') and pg.locator('.g-opt').count() == 4 and pg.is_visible('#g-timer'))
    fb_ok = []
    for i in range(10):
        pg.wait_for_selector('.g-opt:not([disabled])')
        txt, expl = correct_text(i)
        btns = pg.locator('.g-opt'); texts = [btns.nth(k).inner_text().split('\n')[-1].strip() for k in range(btns.count())]
        ci = texts.index(txt)
        if i in (3, 7):
            pick = (ci + 1) % len(texts)
        else:
            pick = ci
        if i == 5: pg.keyboard.press(str(pick + 1))      # jawab dengan papan ketik
        else: btns.nth(pick).click()
        pg.wait_for_selector('#g-nx'); fbt = pg.inner_text('#g-fb')
        right = pg.evaluate(f"document.querySelectorAll('.g-opt')[{ci}].classList.contains('right')")
        wrong = pg.evaluate(f"document.querySelectorAll('.g-opt')[{pick}].classList.contains('wrong')")
        fb_ok.append((('Benar!' in fbt) == (pick == ci)) and right and (wrong == (pick != ci)) and (expl in fbt))
        if i == 3: pg.screenshot(path='/tmp/v14_main.png')
        pg.click('#g-nx')
    chk('D2 10 soal: umpan balik benar/salah dari server, jawaban benar ditandai, penjelasan tampil (termasuk jawab lewat tombol 2 di papan ketik)', all(fb_ok), fb_ok)
    pg.wait_for_selector('.g-result'); pg.wait_for_timeout(300)
    chk('D3 hasil: skor 80, "Lulus", 8/10; sama dengan yang tersimpan di database', pg.inner_text('#g-score').startswith('80') and 'Lulus' in pg.inner_text('.g-badge') and '8/10' in pg.inner_text('.g-rstats') and float(Q1("select score from game_attempts where id=%s", (att,))) == 80)
    pg.screenshot(path='/tmp/v14_hasil.png')
    # ---- E. lobi diperbarui + lanjutkan sesi
    pg.click('text=Kembali ke lobi'); pg.wait_for_selector('.g-level'); pg.wait_for_timeout(600)
    c3 = pg.inner_text('.g-level:nth-child(3)')
    chk('E1 lobi diperbarui: level 3 "Lulus", terbaik 80, percobaan 1; peringkat minggu ini #2', 'Lulus' in c3 and '80' in c3 and 'Percobaan 1' in c3 and '#2' in pg.inner_text('.g-stat:nth-child(3)'), (c3, pg.inner_text('.g-stats')))
    pg.click('.g-level:nth-child(3) a.g-btn'); pg.wait_for_selector('.g-opt')
    for i in range(2):
        pg.locator('.g-opt').first.click(); pg.wait_for_selector('#g-nx'); pg.click('#g-nx'); pg.wait_for_timeout(250)
    pg.goto(BASE + '/shegames.html#/'); pg.wait_for_selector('.g-level'); pg.wait_for_timeout(500)
    chk('E2 sesi yang belum selesai: tombol berubah menjadi "Lanjutkan"', pg.inner_text('.g-level:nth-child(3) a.g-btn') == 'Lanjutkan')
    pg.click('.g-level:nth-child(3) a.g-btn'); pg.wait_for_selector('.g-opt'); pg.wait_for_timeout(300)
    chk('E3 melanjutkan tepat di soal 3 dari 10', 'Soal 3 dari 10' in pg.inner_text('.g-bar'), pg.inner_text('.g-bar'))
    # ---- F. peringkat
    pg.click('.g-nav a[data-r=peringkat]'); pg.wait_for_selector('.g-table'); pg.wait_for_timeout(400)
    names = pg.evaluate("[...document.querySelectorAll('.g-table tbody tr')].map(r=>r.children[1].textContent)")
    chk('F1 peringkat mingguan: Sari 90, Budi 80 (Anda), Dodi 70; bulan lalu (Lia) tidak termasuk', names == ['Sari Wulandari', 'Budi Santoso (Anda)', 'Dodi Pratama'], names)
    chk('F2 baris saya disorot dan ringkasan posisi tampil (#2 dari 3)', pg.locator('.g-table tr.me').count() == 1 and '#2' in pg.inner_text('.g-mine') and 'dari 3 pemain' in pg.inner_text('.g-mine'))
    chk('F3 podium 3 besar (urutan visual 2-1-3)', pg.evaluate("[...document.querySelectorAll('.g-pod .g-nm2')].map(e=>e.textContent)") == ['Budi Santoso', 'Sari Wulandari', 'Dodi Pratama'])
    pg.screenshot(path='/tmp/v14_rank.png', full_page=True)
    chk('F4 pilihan minggu: 12 minggu terakhir dengan label minggu ISO', pg.locator('#g-pw option').count() == 12 and pg.locator('#g-pw option').first.inner_text().startswith(f'Minggu {iw}, {iy}'))
    pg.click('.g-seg button[data-m=month]'); pg.wait_for_selector('#g-pm:not([hidden])'); pg.wait_for_timeout(500)
    mopts = pg.evaluate("[...document.querySelectorAll('#g-pm option')].map(o=>[o.value,o.textContent])")
    today = Q1("select (now() at time zone 'Asia/Makassar')::date")
    chk('F5 filter BULANAN: 12 bulan terakhir berlabel bahasa Indonesia, bulan ini terpilih', len(mopts) == 12 and mopts[0][0] == today.strftime('%Y-%m-01') and pg.input_value('#g-pm') == mopts[0][0] and re.match(r'^[A-Z][a-z]+ \d{4}$', mopts[0][1]), mopts[:2])
    nm = pg.evaluate("[...document.querySelectorAll('.g-table tbody tr')].map(r=>r.children[1].textContent)")
    chk('F6 peringkat bulan ini: Sari, Budi, Dodi', nm == ['Sari Wulandari', 'Budi Santoso (Anda)', 'Dodi Pratama'], nm)
    lia_month = Q1("select to_char(finished_at at time zone 'Asia/Makassar','YYYY-MM-01') from game_attempts where user_id=%s", (others[2],))
    pg.select_option('#g-pm', lia_month); pg.wait_for_timeout(700)
    nm = pg.evaluate("[...document.querySelectorAll('.g-table tbody tr')].map(r=>r.children[1].textContent)")
    chk('F7 pilih bulan lalu: hanya Lia (100) yang bermain bulan itu', nm == ['Lia Lama'], nm)
    pg.click('.g-seg button[data-m=all]'); pg.wait_for_timeout(800)
    nm = pg.evaluate("[...document.querySelectorAll('.g-table tbody tr')].map(r=>r.children[1].textContent)")
    chk('F8 semua waktu: Lia (100) di atas, semua pemain termasuk', nm[0] == 'Lia Lama' and len(nm) == 4, nm)
    pg.select_option('#g-pd', 'Plant'); pg.wait_for_timeout(700)
    nm = pg.evaluate("[...document.querySelectorAll('.g-table tbody tr')].map(r=>r.children[1].textContent)")
    chk('F9 filter departemen Plant: Lia dan Sari saja', nm == ['Lia Lama', 'Sari Wulandari'], nm)
    pg.select_option('#g-pd', ''); pg.wait_for_timeout(600); pg.fill('#g-ps', 'dod'); pg.wait_for_timeout(200)
    nm = pg.evaluate("[...document.querySelectorAll('.g-table tbody tr')].map(r=>r.children[1].textContent)")
    chk('F10 pencarian nama tanpa memuat ulang (dod -> Dodi)', nm == ['Dodi Pratama'], nm)
    pg.fill('#g-ps', ''); pg.click('.g-seg button[data-m=week]'); pg.wait_for_timeout(600)
    pg.select_option('#g-pw', index=3); pg.wait_for_timeout(700)
    chk('F11 minggu yang tidak ada skor: pesan kosong yang ramah', 'Belum ada skor lulus' in pg.inner_text('#g-lb'))
    # ---- G. cara main
    pg.click('.g-nav a[data-r=cara-main]'); pg.wait_for_timeout(500)
    chk('G1 cara main: aturan memakai pengaturan admin (nilai lulus 60, 3 bantuan, penalti 5)', 'Nilai lulus tiap level adalah 60' in pg.inner_text('#g-view') and 'maksimal 3 bantuan' in pg.inner_text('#g-view'))
    chk('G2 tanpa error JS di seluruh alur', errs == [], errs[:3])
    ctx.close()
    # ---- H. akun belum disetujui
    c2 = b.new_context(); p2 = c2.new_page(); wire(p2); login(p2, 'baru@x'); p2.wait_for_timeout(1200)
    chk('H1 akun belum disetujui: pesan menunggu persetujuan', 'menunggu persetujuan' in p2.inner_text('#g-view').lower())
    c2.close(); b.close()
done()
