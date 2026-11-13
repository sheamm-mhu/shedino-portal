import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'base.py'), encoding='utf-8').read())
setup()
# ===== A. skema dan idempotensi =====
for i in range(2):
    try: c.execute(open(f'{ROOT}/games.sql', encoding='utf-8').read()); ok=True; err=''
    except Exception as e: ok=False; err=str(e)[:300]
    chk(f'A{i+1} games.sql aman dijalankan ulang (putaran tambahan {i+1})', ok, err)
chk('A3 data awal: 15 kata dan 12 soal, tidak ganda setelah dijalankan berulang', S1("select count(*) from game_words")==15 and S1("select count(*) from game_questions")==12)
S("delete from game_questions"); c.execute(open(f'{ROOT}/games.sql', encoding='utf-8').read())
chk('A4 soal yang sudah dihapus tidak dimasukkan ulang oleh dijalankan ulang', S1("select count(*) from game_questions")==0)
setup()
# profil: department tertangkap oleh pemicu
u = mkuser('x@x','Xavier','Produksi')
chk('A5 pemicu pendaftaran menyimpan departemen dan NIK (employee_id)', S("select department, employee_id from profiles where id=%s",(u,))==[('Produksi','NXavier')])
# ===== B. minggu ISO =====
cases = [('2026-11-15 15:59:59+00','2026-11-09'),('2026-11-15 16:00:00+00','2026-11-16'),('2026-01-01 12:00:00+00','2025-12-29'),
         ('2024-12-30 05:00:00+00','2024-12-30'),('2021-01-03 12:00:00+00','2020-12-28'),('2026-11-12 08:00:00+00','2026-11-09'),('2026-03-29 17:00:00+00','2026-03-30')]
ok=True
for ts,exp in cases:
    got=str(S1("select public.game_week_start(%s::timestamptz)",(ts,)))
    if got!=exp: ok=False; print('   salah',ts,got,exp)
chk('B1 awal minggu ISO (Senin) di WITA: batas Minggu 23:59:59 vs Senin 00:00, pergantian tahun, 7 kasus', ok)
chk('B2 zona waktu lain mengubah batas minggu (UTC: Minggu 16:00 masih minggu lama)', str(S1("select public.game_week_start('2026-11-15 16:00:00+00'::timestamptz,'UTC')"))=='2026-11-09')
labels=[S1("select to_char(%s::date,'IYYY-\"W\"IW')",(d,)) for d in ('2024-12-30','2020-12-28','2026-11-09','2026-01-05')]
chk('B3 label minggu ISO: 2024-12-30 = 2025-W01, 2020-12-28 = 2020-W53, 2026-11-09 = 2026-W46', labels==['2025-W01','2020-W53','2026-W46','2026-W02'], labels)
# ===== C. rumus skor =====
cs=[(1,12,15,0,0,80),(1,12,15,2,0,70),(1,3,15,3,0,5),(1,1,15,3,0,0),(2,7,10,0,0,70),(3,10,10,0,0,100),(4,3,5,0,2,50),(4,1,5,0,9,0),(3,0,0,0,0,0),(2,12,10,0,0,100),(1,15,15,3,0,85),(4,5,5,0,0,100)]
ok=True
for lv,co,to,h,w,exp in cs:
    got=float(S1("select public.game_score(%s,%s,%s,%s,%s)",(lv,co,to,h,w)))
    if abs(got-exp)>0.01: ok=False; print('   salah',(lv,co,to,h,w),got,exp)
chk('C1 rumus skor 4 level: % benar, penalti bantuan/salah ketuk, minimum 0, maksimum 100 (12 kasus)', ok)
chk('C2 pembulatan 2 desimal (7/15 = 46.67)', float(S1("select public.game_score(3,7,15)"))==46.67)
chk('A6 daftar departemen awal terisi saat data awal dimasukkan', S1("select array_length(departments,1) from game_settings")==7)
print(f'TOTAL {OK} lulus, {BAD} gagal')
