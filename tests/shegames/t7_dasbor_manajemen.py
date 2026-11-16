import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'base.py'), encoding='utf-8').read())
setup(bare=False)
adm = mkuser('adm@x', 'Admin', 'SHE', 'admin')
U = {n: mkuser(f'{n}@x', nm, d) for n, nm, d in [('a', 'Andi', 'Produksi'), ('b', 'Bima', 'Plant'), ('c', 'Citra', 'Produksi'), ('d', 'Dodi', 'Plant'), ('e', 'Eka', ''), ('f', 'Fitri', 'SHE')]}
S("update game_settings set active_levels='{2,3,4}', pass_score=60")
qs = [r[0] for r in S("select id::text from game_questions order by q limit 3")]; sg = [r[0] for r in S("select id::text from game_signs order by name limit 2")]; sc = S1("select id::text from game_scenes")
def att(u, level, score, dur=1000, wrong=(), ts=None, passed=None):
    S("insert into game_attempts(user_id,level,week,status,finished_at,duration_ms,score,passed,wrong_ids) values (%s,%s,public.game_week_start(coalesce(%s::timestamptz, now())),'finished',coalesce(%s::timestamptz, now()),%s,%s,%s,%s)",
      (U[u], level, ts, ts, dur, score, (score >= 60) if passed is None else passed, list(wrong)))
# minggu ini
att('a', 3, 90, wrong=[qs[0]]); att('a', 2, 80, wrong=[sg[0], sg[1]]); att('a', 4, 70, wrong=[sc + ':2'])
att('b', 3, 40, wrong=[qs[0], qs[1]]); att('b', 3, 80, wrong=[qs[0]])           # dua percobaan: skor terbaik 80 (lulus)
att('c', 3, 100); att('c', 2, 50, wrong=[sg[0]])                                   # L2 tidak lulus
att('e', 3, 60)
att('f', 4, 30, wrong=[sc + ':2', sc + ':0'])
# minggu lalu (tidak boleh masuk dasbor minggu ini)
att('d', 3, 100, ts=str(S1("select (public.game_week_start()-7)::timestamptz")), wrong=[qs[2]])
def dash(**kw):
    a = {'p_week': None, 'p_month': None, 'p_all': False}; a.update(kw)
    return P(adm, "select public.game_admin_dashboard(%s,%s,%s)", (a['p_week'], a['p_month'], a['p_all']))
ok, D = dash()
chk('D1 dasbor minggu ini dihitung', ok, D)
chk('D2 KPI: 7 akun terdaftar (admin + 6), 5 peserta aktif (Andi, Bima, Citra, Eka, Fitri), 71% aktif', D['registered'] == 7 and D['active'] == 5 and abs(D['active_pct'] - 71.4) < 0.1, (D['registered'], D['active'], D['active_pct']))
# skor terbaik per (user,level): a: 90,80,70; b: 80; c: 100,50; e: 60; f: 30 => 9 nilai? (90+80+70+80+100+50+60+30)/8
chk('D3 rata-rata skor = rata-rata skor terbaik tiap pemain per level: (90+80+70+80+100+50+60+30)/8 = 70,0', abs(D['avg_score'] - 70.0) < 0.05, D['avg_score'])
chk('D4 lulus semua level aktif (2, 3, 4): hanya Andi', D['all_passed'] == 1, D['all_passed'])
chk('D5 skor tertinggi = total tertinggi: Andi 90+80+70 = 240', abs(D['top_score'] - 240) < 0.01, D['top_score'])
lv = {x['level']: x for x in D['levels']}
chk('D6 per level: L3 5 pemain (4 lulus: Andi, Bima, Citra, Eka); L2 2 pemain (1 lulus); L4 2 pemain (1 lulus)', lv[3]['players'] == 4 and lv[3]['passed'] == 4 and lv[2]['players'] == 2 and lv[2]['passed'] == 1 and lv[4]['players'] == 2 and lv[4]['passed'] == 1, lv)
chk('D7 per level: tingkat kelulusan, rata-rata, dan jumlah percobaan (L3: 5 percobaan dari 4 pemain)', lv[3]['pass_rate'] == 100.0 and lv[3]['attempts'] == 5 and lv[2]['pass_rate'] == 50.0 and abs(lv[2]['avg_score'] - 65.0) < 0.05 and lv[4]['attempts'] == 2, lv)
dp = {x['department']: x for x in D['departments']}
chk('D8 per departemen: Produksi 2 pemain (rata-rata (90+80+70+100+50)/5=78), Plant 1 (80), SHE 1 (30), "(belum diisi)" 1 (60)', dp['Produksi']['players'] == 2 and abs(dp['Produksi']['avg_score'] - 78.0) < 0.05 and dp['Plant']['players'] == 1 and dp['Plant']['avg_score'] == 80 and dp['SHE']['avg_score'] == 30 and dp['(belum diisi)']['avg_score'] == 60, dp)
chk('D9 partisipasi per departemen dari akun terdaftar: Plant 1 dari 2 = 50%; Produksi 2 dari 2 = 100%; urut skor rata-rata menurun', dp['Plant']['participation'] == 50.0 and dp['Produksi']['participation'] == 100.0 and D['departments'][0]['department'] == 'Plant', [x['department'] for x in D['departments']])
w = D['wrong']
chk('D10 topik paling sering salah (maks 5): soal pertama 3 kali, rambu pertama 2 kali, titik bahaya "2" 2 kali; label memuat teks butirnya', len(w) <= 5 and w[0]['times'] == 3 and w[0]['level'] == 3 and w[1]['times'] == 2, w)
q0 = S1("select q from game_questions where id::text=%s", (qs[0],)); sname = S1("select name from game_signs where id::text=%s", (sg[0],)); pname = S1("select points->2->>'name' from game_scenes")
labels = {x['label'] for x in w}
chk('D11 label: soal tampil teks soalnya, rambu tampil namanya, bahaya tampil "judul foto - nama titik"', q0 in labels and sname in labels and any(l.endswith(' - ' + pname) for l in labels), labels)
chk('D12 data minggu lalu tidak ikut (soal minggu lalu tidak ada di topik salah)', S1("select q from game_questions where id::text=%s", (qs[2],)) not in labels)
r = D['ranking']
chk('D13 peringkat lengkap memuat NIK (hanya untuk admin); Andi peringkat 1 dengan total 240', r[0]['name'] == 'Andi' and r[0]['rank'] == 1 and r[0]['nik'] == 'NAndi' and abs(r[0]['total'] - 240) < 0.01 and len(r) == 4, r)
chk('D14 yang tidak lulus tidak masuk peringkat (Fitri L4 30 tidak muncul)', all(x['name'] != 'Fitri' for x in r))
ok, D2 = dash(p_week=str(S1("select public.game_week_start()-7")))
chk('D15 pilih minggu lalu: 1 peserta (Dodi), rata-rata 100, topik salah hanya soal minggu itu', ok and D2['active'] == 1 and D2['avg_score'] == 100 and len(D2['wrong']) == 1 and D2['wrong'][0]['times'] == 1, D2)
ok, D3 = dash(p_all=True)
chk('D16 semua waktu: 6 peserta aktif (termasuk Dodi minggu lalu)', ok and D3['active'] == 6, D3['active'])
ok, D4 = dash(p_month=str(S1("select date_trunc('month', now() at time zone 'Asia/Makassar')::date")))
chk('D17 bulan ini mencakup minggu ini dan minggu lalu bila masih satu bulan (>=5 peserta)', ok and D4['active'] >= 5, D4['active'])
S("delete from game_questions where id::text=%s", (qs[0],)); ok, D5 = dash()
chk('D18 butir yang sudah dihapus tetap terhitung dengan label "(soal sudah dihapus)" (tidak merusak dasbor)', ok and any(x['label'] == '(soal sudah dihapus)' for x in D5['wrong']), D5['wrong'])
ok, e = P(U['a'], "select public.game_admin_dashboard()"); chk('D19 pemain biasa tidak bisa membuka dasbor (hanya admin)', not ok and 'admin' in e.lower(), e)
ok, e = P(None, "select public.game_admin_dashboard()", role='anon'); chk('D20 pengunjung tanpa login ditolak', not ok, e)
S("delete from game_attempts"); ok, D6 = dash()
chk('D21 tanpa data sama sekali: dasbor kosong yang wajar (nol, bukan galat); rata-rata dan skor tertinggi kosong', ok and D6['active'] == 0 and D6['avg_score'] is None and D6['top_score'] is None and D6['wrong'] == [] and D6['ranking'] == [] and D6['all_passed'] == 0 and all(x['players'] == 0 for x in D6['levels']), D6)
print(f'TOTAL {OK} lulus, {BAD} gagal')
