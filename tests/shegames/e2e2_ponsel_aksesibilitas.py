import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'e2e_base.py'), encoding='utf-8').read())
from playwright.sync_api import sync_playwright
AXE = open(os.environ.get('AXE_JS', 'axe.min.js')).read()
me = mkuser('budi@x', 'Budi Santoso', 'Produksi'); o = mkuser('sari@x', 'Sari Wulandari', 'Plant')
Q("insert into game_attempts(user_id,level,week,status,finished_at,duration_ms,score,passed) values (%s,3,public.game_week_start(),'finished',now(),60000,90,true)", (o,))
def axe(pg):
    pg.evaluate(AXE)
    v = pg.evaluate("axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']},resultTypes:['violations']})")['violations']
    return [(x['impact'], x['id'], len(x['nodes']), x['nodes'][0]['target'][0] if x['nodes'] else '') for x in v]
JS_T = """()=>[...document.querySelectorAll('a,button,select,input')].filter(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&!e.closest('.sr')&&!e.classList.contains('skip')}).filter(e=>{const r=e.getBoundingClientRect();return r.height<44||r.width<44}).map(e=>e.tagName+'.'+(e.className||e.id)+' '+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height))"""
OVER = "document.documentElement.scrollWidth>document.documentElement.clientWidth"
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---- desktop: aksesibilitas
    ctx = b.new_context(viewport={'width': 1366, 'height': 900}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); wire(pg); login(pg, 'budi@x'); pg.wait_for_selector('.g-level'); pg.wait_for_timeout(900)
    v = axe(pg); chk('X1 aksesibilitas lobi: 0 pelanggaran', v == [], v)
    pg.click('.g-level:nth-child(3) a.g-btn'); pg.wait_for_selector('.g-opt'); pg.wait_for_timeout(600)
    v = axe(pg); chk('X2 aksesibilitas layar soal: 0 pelanggaran', v == [], v)
    pg.locator('.g-opt').first.click(); pg.wait_for_selector('#g-nx'); pg.wait_for_timeout(500)
    v = axe(pg); chk('X3 aksesibilitas setelah menjawab (umpan balik): 0 pelanggaran', v == [], v)
    pg.click('.g-nav a[data-r=peringkat]'); pg.wait_for_selector('.g-table'); pg.wait_for_timeout(700)
    v = axe(pg); chk('X4 aksesibilitas peringkat: 0 pelanggaran', v == [], v)
    pg.click('.g-nav a[data-r=cara-main]'); pg.wait_for_timeout(600)
    v = axe(pg); chk('X5 aksesibilitas cara main: 0 pelanggaran', v == [], v)
    chk('X6 tanpa error JS', errs == [], errs[:2]); ctx.close()
    # ---- penghitung waktu habis sendiri
    Q("update game_settings set timer_mcq=2")
    ctx = b.new_context(viewport={'width': 1280, 'height': 800}); pg = ctx.new_page(); wire(pg); login(pg, 'budi@x'); pg.goto(BASE + '/shegames.html#/main/3')
    pg.wait_for_selector('.g-opt'); pg.wait_for_timeout(3600)
    chk('T1 waktu habis: jawaban terkirim otomatis, tampil "Waktu habis", tombol terkunci', 'Waktu habis' in pg.inner_text('#g-fb') and pg.locator('.g-opt[disabled]').count() == 4, pg.inner_text('#g-fb'))
    Q("update game_settings set timer_mcq=0"); ctx.close()
    # ---- ponsel
    for (w, h) in [(390, 844), (360, 740)]:
        ctx = b.new_context(viewport={'width': w, 'height': h}, is_mobile=True, has_touch=True, device_scale_factor=2); pg = ctx.new_page(); me_err = []
        pg.on('pageerror', lambda e: me_err.append(str(e))); wire(pg); login(pg, 'budi@x'); pg.wait_for_selector('.g-level'); pg.wait_for_timeout(900)
        nav = pg.evaluate("(()=>{const n=document.querySelector('.g-nav').getBoundingClientRect();return {pos:getComputedStyle(document.querySelector('.g-nav')).position,bottom:Math.round(innerHeight-n.bottom),h:Math.round(n.height)}})()")
        chk(f'P1 {w}px: menu pindah ke bilah bawah (tetap di dasar layar), logo di atas, tanpa scroll samping', nav['pos'] == 'fixed' and nav['bottom'] == 0 and pg.is_visible('.g-logo img') and not pg.evaluate(OVER), nav)
        t = pg.evaluate(JS_T); chk(f'P2 {w}px lobi: semua target sentuh >=44px', t == [], t)
        if w == 390: pg.screenshot(path='/tmp/v14_m_lobi.png')
        pg.click('.g-level:nth-child(3) a.g-btn'); pg.wait_for_selector('.g-opt'); pg.wait_for_timeout(500)
        t = pg.evaluate(JS_T); chk(f'P3 {w}px soal: target sentuh >=44px, tanpa scroll samping', t == [] and not pg.evaluate(OVER), t)
        if w == 390: pg.screenshot(path='/tmp/v14_m_main.png')
        pg.goto(BASE + '/shegames.html#/peringkat'); pg.wait_for_selector('.g-table'); pg.wait_for_timeout(700)
        chk(f'P4 {w}px peringkat: tabel bergeser di dalam kotaknya, halaman tidak melebar', not pg.evaluate(OVER) and pg.evaluate("(()=>{const e=document.querySelector('.g-table-wrap');return e.scrollWidth>e.clientWidth})()"))
        t = pg.evaluate(JS_T); chk(f'P5 {w}px peringkat: target sentuh >=44px', t == [], t)
        if w == 390: pg.screenshot(path='/tmp/v14_m_rank.png')
        chk(f'P6 {w}px tanpa error JS', me_err == [], me_err[:2]); ctx.close()
    b.close()
done()
