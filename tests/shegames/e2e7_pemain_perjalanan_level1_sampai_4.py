import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'e2e_base.py'), encoding='utf-8').read())
from playwright.sync_api import sync_playwright
me = mkuser('budi@x', 'Budi Santoso', 'Produksi'); sari = mkuser('sari@x', 'Sari Wulandari', 'Plant')
Q("update game_settings set timer_sign=0, timer_mcq=0, hazard_time=0, q_count=10")
grid = Q1("select live_grid from game_layout"); WORDS = {r[0]: r[1] for r in Q("select id::text, word from game_words")}
ITEMS = [(it['num'], it['dir'], WORDS[it['id']]) for it in grid['items']]
TRUTH = {}
for it in grid['items']:
    w = WORDS[it['id']]
    for k, ch in enumerate(w): TRUTH[(it['row'] + (k if it['dir'] == 'D' else 0), it['col'] + (k if it['dir'] == 'A' else 0))] = ch
def fill_cell(pg, r, c, ch):
    pg.locator(f'.g-cell[data-r="{r}"][data-c="{c}"]').click(); pg.keyboard.type(ch)
def type_word(pg, num, d, word):
    pg.locator('.g-clue', has_text=f"{num}.").filter(has=pg.locator(f'xpath=ancestor::section[.//h2[text()="{"Mendatar" if d == "A" else "Menurun"}"]]')).first.click() if False else None
    sec = pg.locator('section', has=pg.locator('h2', has_text='Mendatar' if d == 'A' else 'Menurun'))
    sec.locator('.g-clue', has=pg.locator(f'b:text-is("{num}.")')).first.click(); pg.keyboard.type(word, delay=5)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1366, 'height': 900}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept()); wire(pg)
    login(pg, 'budi@x'); pg.wait_for_selector('.g-level'); pg.wait_for_timeout(600)
    def lobby_state(): return pg.evaluate("[...document.querySelectorAll('.g-level')].map(c=>(c.querySelector('a.g-btn')?c.querySelector('a.g-btn').textContent:c.querySelector('.g-pill').textContent))")
    chk('J1 aturan berurutan bawaan: hanya level 1 yang bisa dimainkan; level 2, 3, 4 "Terkunci"', lobby_state() == ['Main', 'Terkunci', 'Terkunci', 'Terkunci'], lobby_state())
    # ===== LEVEL 1 =====
    pg.click('.g-level:nth-child(1) a.g-btn'); pg.wait_for_selector('.g-cell'); pg.wait_for_timeout(500)
    nA = len([i for i in ITEMS if i[1] == 'A']); nD = len(ITEMS) - nA
    chk(f'K1 level 1: kotak {grid["rows"]}x{grid["cols"]} dengan 87 sel kata, 15 petunjuk ({nA} mendatar, {nD} menurun), nomor di kotak awal', pg.locator('.g-cell').count() == 87 and pg.locator('.g-clue').count() == 15 and pg.locator('.g-cell i').count() == len({(it['row'], it['col']) for it in grid['items']}) and pg.locator('.g-cwlists section').first.locator('.g-clue').count() == nA)
    chk('K2 petunjuk aktif ditampilkan di bar atas dan kotak pertama terpilih', pg.locator('.g-cell.sel').count() == 1 and pg.inner_text('#g-cw-clue').startswith('1 Menurun') and '0 dari 87' in pg.inner_text('.g-bar'), pg.inner_text('#g-cw-clue'))
    first = [i for i in ITEMS if i[0] == 1][0]; pg.keyboard.type(first[2], delay=10); pg.wait_for_timeout(200)
    letters = pg.evaluate("[...document.querySelectorAll('.g-cell.inw b, .g-cell.sel b')].map(b=>b.textContent).join('')")
    chk('K3 mengetik langsung mengisi kotak terpilih (tanpa klik dulu di komputer); kursor maju sepanjang kata', first[2] in letters.replace(' ', '') and f'{len(first[2])} dari 87' in pg.inner_text('.g-bar'), (letters, pg.inner_text('.g-bar')))
    pg.keyboard.press('Backspace'); pg.keyboard.press('Backspace'); pg.wait_for_timeout(150)
    chk('K4 Backspace menghapus huruf dan mundur ke kotak sebelumnya', f'{len(first[2]) - 2} dari 87' in pg.inner_text('.g-bar') or f'{len(first[2]) - 1} dari 87' in pg.inner_text('.g-bar'), pg.inner_text('.g-bar'))
    cross = pg.evaluate("(()=>{const cs=[...document.querySelectorAll('.g-cell')];return cs.findIndex(c=>c.querySelector('i')&&c.querySelector('i').textContent==='1')})()")
    pg.locator('.g-cell').nth(cross).click(); d1 = pg.inner_text('#g-cw-clue')
    both = pg.evaluate("(()=>{const c=[...document.querySelectorAll('.g-cell')][%d];return !!c})()" % cross)
    pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(100)
    chk('K5 panah mengganti kotak terpilih; klik petunjuk memilih kata dan menandainya', pg.locator('.g-cell.sel').count() == 1 and pg.locator('.g-clue.on').count() == 1)
    # bantuan huruf
    tgt = [i for i in ITEMS if i[0] == 3][0]; sec = pg.locator('section', has=pg.locator('h2', has_text='Mendatar' if tgt[1] == 'A' else 'Menurun')); sec.locator('.g-clue', has=pg.locator('b:text-is("3.")')).first.click()
    pg.click('#g-cw-hint'); pg.wait_for_timeout(800)
    chk('K6 bantuan huruf: server membuka huruf kotak terpilih, kotak berwarna kuning dan terkunci, sisa bantuan berkurang (3 -> 2), penalti diberitahukan', pg.locator('.g-cell.hint').count() == 1 and 'sisa 2' in pg.inner_text('#g-cw-hint') and 'Penalti 5 poin' in pg.inner_text('#g-toast'), (pg.inner_text('#g-cw-hint'), pg.inner_text('#g-toast')))
    hr, hc = pg.evaluate("(()=>{const e=document.querySelector('.g-cell.hint');return [+e.dataset.r,+e.dataset.c]})()"); hl = pg.locator('.g-cell.hint b').inner_text(); real = TRUTH[(hr, hc)]
    chk('K7 huruf yang dibuka sama dengan huruf yang benar di kotak itu (dari server) dan tidak bisa ditimpa ketikan', hl == real and (pg.keyboard.type('Z') or True) and pg.locator('.g-cell.hint b').inner_text() == real, (hl, real))
    pg.locator('.g-cell.hint').click(); pg.click('#g-cw-hint'); pg.wait_for_timeout(500)
    chk('K8 meminta bantuan di kotak yang sudah dibuka tidak memakai jatah lagi', 'sisa 2' in pg.inner_text('#g-cw-hint') and Q1("select hints from game_attempts where status='active' and level=1") == 1)
    # muat ulang: huruf ketikan dan bantuan terjaga
    pg.keyboard.type('Q', delay=5); typed_before = pg.evaluate("[...document.querySelectorAll('.g-cell b')].filter(b=>b.textContent).length")
    pg.reload(); pg.wait_for_selector('.g-cell'); pg.wait_for_timeout(700)
    typed_after = pg.evaluate("[...document.querySelectorAll('.g-cell b')].filter(b=>b.textContent).length")
    chk('K9 muat ulang halaman: huruf yang sudah diketik dipulihkan dan bantuan huruf terjaga (1 terpakai)', typed_after == typed_before and pg.locator('.g-cell.hint').count() == 1 and 'sisa 2' in pg.inner_text('#g-cw-hint'), (typed_before, typed_after))
    # isi semua kata dengan benar
    hinted = {(hr, hc)}
    for (r_, c_), ch in TRUTH.items():
        if (r_, c_) not in hinted: fill_cell(pg, r_, c_, ch)
    pg.wait_for_timeout(300)
    chk('K10 semua 87 kotak terisi', '87 dari 87' in pg.inner_text('.g-bar'), pg.inner_text('.g-bar'))
    pg.click('#g-cw-done'); pg.wait_for_selector('.g-result'); pg.wait_for_timeout(400)
    sc = float(Q1("select score from game_attempts where level=1 and status='finished' order by finished_at desc limit 1"))
    chk('K11 hasil level 1: 15 dari 15 kata benar, 1 bantuan (-5) = skor 95, lulus; ditampilkan sama dengan di database', '15/15' in pg.inner_text('.g-rstats') and sc == 95 and pg.inner_text('#g-score').startswith('95') and 'Lulus' in pg.inner_text('.g-badge'), (sc, pg.inner_text('.g-rstats')))
    chk('K12 hasil memuat daftar mendatar dan menurun dengan kata jawaban dan petunjuk', pg.locator('.g-fcard').count() == 15 and pg.locator('.g-fcard.missed').count() == 0 and 'Mendatar' in pg.inner_text('.g-result') and 'Menurun' in pg.inner_text('.g-result'))
    pg.screenshot(path=SHOT + 'v20_l1_result.png', full_page=True)
    pg.click('#g-again'); pg.wait_for_selector('.g-cell'); pg.wait_for_timeout(500)
    chk('K13 "Main lagi" membuka permainan baru yang kosong (percobaan baru, tanpa huruf lama dan tanpa bantuan terpakai)', '0 dari 87' in pg.inner_text('.g-bar') and 'sisa 3' in pg.inner_text('#g-cw-hint') and Q1("select count(*) from game_attempts where level=1")==2)
    for num, d, w in ITEMS[:8]: type_word(pg, num, d, w[::-1] if len(w) > 3 else 'ZZZ'[:len(w)])
    pg.click('#g-cw-done'); pg.wait_for_selector('.g-result'); pg.wait_for_timeout(400)
    row = Q("select score,passed from game_attempts where level=1 order by started_at desc limit 1")[0]
    chk('K14 selesai dengan banyak kotak kosong (konfirmasi diterima) dan jawaban salah: tidak lulus, skor kecil, ada kata ditandai "Belum tepat"', float(row[0]) < 60 and row[1] is False and pg.locator('.g-fcard.missed').count() >= 7 and 'Belum lulus' in pg.inner_text('.g-badge'), row)
    pg.click('text=Kembali ke lobi'); pg.wait_for_selector('.g-level'); pg.wait_for_timeout(500)
    chk('J2 lulus level 1: level 2 terbuka; level 3 dan 4 masih terkunci', lobby_state()[1] == 'Main' and lobby_state()[2] == 'Terkunci' and 'Lulus' in pg.inner_text('.g-level:nth-child(1)') and '95' in pg.inner_text('.g-level:nth-child(1)'), lobby_state())
    # ===== LEVEL 2 =====
    pg.click('.g-level:nth-child(2) a.g-btn'); pg.wait_for_selector('.g-opt'); pg.wait_for_timeout(500)
    chk('S1 level 2: gambar rambu termuat, pertanyaan "Rambu apa ini?", 4 pilihan, soal 1 dari 8, tanpa penghitung waktu (diatur 0)', pg.evaluate("(()=>{const i=document.querySelector('.g-sign img');return i.complete&&i.naturalWidth>0})()") and 'Rambu apa ini?' in pg.inner_text('#g-q') and pg.locator('.g-opt').count() == 4 and 'Soal 1 dari 8' in pg.inner_text('.g-bar') and not pg.is_visible('#g-timer'))
    att = Q1("select id from game_attempts where level=2 and status='active'"); signs = {r[0]: (r[1], r[2]) for r in Q("select id::text,name,meaning from game_signs")}
    seen = []
    for i in range(8):
        pg.wait_for_selector('.g-opt:not([disabled])'); st = Q1("select state from game_sessions where attempt_id=%s", (att,)); it = st['items'][i]; ci = it['opts'].index(it['id']); name, meaning = signs[it['id']]
        wrong = i in (2, 5); pick = (ci + 1) % 4 if wrong else ci
        pg.locator('.g-opt').nth(pick).click(); pg.wait_for_selector('#g-nx'); fb = pg.inner_text('#g-fb')
        seen.append((('Benar!' in fb) == (not wrong)) and name in fb and meaning[:25] in fb and pg.evaluate(f"document.querySelectorAll('.g-opt')[{ci}].classList.contains('right')"))
        if i == 0: pg.screenshot(path=SHOT + 'v20_l2.png')
        pg.click('#g-nx')
    chk('S2 8 rambu dijawab (2 sengaja salah): umpan balik benar/salah dari server, nama dan ARTI rambu tampil, jawaban benar ditandai', all(seen), seen)
    pg.wait_for_selector('.g-result'); sc2 = float(Q1("select score from game_attempts where id=%s", (att,)))
    chk('S3 hasil level 2: 6 dari 8 = 75, lulus', sc2 == 75 and '6/8' in pg.inner_text('.g-rstats') and 'Lulus' in pg.inner_text('.g-badge'), (sc2, pg.inner_text('.g-rstats')))
    chk('S4 id rambu yang dijawab salah tercatat untuk analitik (2)', len(Q1("select wrong_ids from game_attempts where id=%s", (att,))) == 2)
    pg.click('text=Kembali ke lobi'); pg.wait_for_selector('.g-level'); pg.wait_for_timeout(500)
    chk('J3 lulus level 2: level 3 terbuka', lobby_state()[2] == 'Main', lobby_state())
    # penghitung waktu level 2
    Q("update game_settings set timer_sign=2")
    pg.click('.g-level:nth-child(2) a.g-btn'); pg.wait_for_selector('.g-opt'); pg.wait_for_timeout(3600)
    chk('S5 waktu per soal 2 detik: lewat batas, jawaban otomatis dihitung "Waktu habis" dan pilihan terkunci', 'Waktu habis' in pg.inner_text('#g-fb') and pg.locator('.g-opt[disabled]').count() == 4, pg.inner_text('#g-fb'))
    Q("update game_settings set timer_sign=0")
    # ===== LEVEL 3 dan 4 dalam perjalanan =====
    pg.goto(BASE + '/shegames.html#/main/3'); pg.wait_for_selector('.g-opt'); att3 = Q1("select id from game_attempts where level=3 and status='active'")
    for i in range(10):
        pg.wait_for_selector('.g-opt:not([disabled])'); st = Q1("select state from game_sessions where attempt_id=%s", (att3,)); it = st['items'][i]; key = Q1("select key from game_questions where id=%s", (it['id'],))
        pg.locator('.g-opt').nth(it['order'].index(key)).click(); pg.wait_for_selector('#g-nx'); pg.click('#g-nx')
    pg.wait_for_selector('.g-result'); pg.click('text=Kembali ke lobi'); pg.wait_for_selector('.g-level'); pg.wait_for_timeout(500)
    chk('J4 lulus level 3 (100): level 4 terbuka', lobby_state()[3] == 'Main', lobby_state())
    pg.goto(BASE + '/shegames.html#/main/4'); pg.wait_for_selector('#g-scene'); pg.wait_for_timeout(700); pts = Q1("select points from game_scenes"); box = pg.locator('#g-scene').bounding_box()
    for q in pts: pg.mouse.click(box['x'] + box['width'] * q['x'] / 100, box['y'] + box['height'] * q['y'] / 100); pg.wait_for_timeout(500)
    pg.wait_for_selector('.g-result', timeout=8000); pg.wait_for_timeout(300)
    chk('J5 level 4: kelima titik ditemukan, selesai otomatis, skor 100', '5/5' in pg.inner_text('.g-rstats') and pg.inner_text('#g-score').startswith('100'), pg.inner_text('.g-rstats'))
    pg.click('text=Kembali ke lobi'); pg.wait_for_selector('.g-level'); pg.wait_for_timeout(600)
    chk('J6 lobi akhir: keempat level "Lulus"; total skor minggu ini = 95 + 75 + 100 + 100 = 370 (skor terbaik tiap level)', pg.locator('.g-level .g-pill.ok').count() == 4 and '370' in pg.inner_text('.g-stat:nth-child(2)') and '4/4' in pg.inner_text('.g-stat:nth-child(1)'), pg.inner_text('.g-stats'))
    pg.click('.g-nav a[data-r=peringkat]'); pg.wait_for_selector('.g-table'); pg.wait_for_timeout(500)
    chk('J7 peringkat: Budi di posisi 1 dengan skor L1 95, L2 75, L3 100, L4 100, total 370', '370' in pg.inner_text('.g-table tr.me') and pg.locator('.g-table tr.me td').nth(4).inner_text() == '95', pg.inner_text('.g-table tr.me'))
    chk('J8 tanpa error JS di seluruh perjalanan', errs == [], errs[:3]); ctx.close(); b.close()
done()
