import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'e2e_base.py'), encoding='utf-8').read())
from playwright.sync_api import sync_playwright
me = mkuser('budi@x', 'Budi Santoso', 'Produksi')
with sync_playwright() as p:
    b = p.chromium.launch()
    # 1) izin fungsi tidak terpasang
    Q("revoke execute on function public.game_my_status() from authenticated")
    ctx = b.new_context(); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); wire(pg)
    login(pg, 'budi@x'); pg.wait_for_timeout(1500); t = pg.inner_text('#g-view')
    chk('R1 izin fungsi belum terpasang: pesan bahasa Indonesia yang menyebut supabase/games.sql (bukan pesan mentah)', 'belum mendapat izin' in t and 'games.sql' in t and 'permission denied' not in t, t)
    ctx.close()
    Q("grant execute on function public.game_my_status() to authenticated")
    # 2) sesi berakhir di tengah jalan
    ctx = b.new_context(); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); wire(pg)
    login(pg, 'budi@x'); pg.wait_for_selector('.g-level'); pg.wait_for_timeout(500)
    pg.evaluate("Auth.client.auth.signOut({scope:'local'})"); pg.wait_for_timeout(400)
    pg.evaluate("location.hash='#/cara-main'"); pg.wait_for_timeout(200); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(1500)
    t = pg.inner_text('#g-view')
    chk('R2 sesi berakhir: judul "Sesi berakhir" dan tombol "Masuk lagi" ke masuk.html?next=shegames.html', 'Sesi berakhir' in t and pg.get_attribute('#g-view a.g-btn', 'href') == 'masuk.html?next=shegames.html', t)
    pg.click('#g-view a.g-btn'); pg.wait_for_url('**/masuk.html**'); pg.fill('#in-email', 'budi@x'); pg.fill('#in-pass', 'x12345678'); pg.click('#f-in button[type=submit]')
    pg.wait_for_url('**/shegames.html', timeout=8000); pg.wait_for_selector('.g-level')
    chk('R3 setelah masuk lagi, kembali ke lobi SHEGAMES', pg.locator('.g-level').count() == 4)
    chk('R4 tanpa error JS', errs == [], errs[:2]); b.close()
done()
