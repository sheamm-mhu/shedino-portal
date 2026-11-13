import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'base.py'), encoding='utf-8').read())
setup()
adm=mkuser('adm@x','Admin','Kantor','admin')
U={n:mkuser(f'{n}@x',nm,d) for n,nm,d in [('a','Andi','Produksi'),('b','Bima','Plant'),('e','Eka','Plant'),('c','Citra','Produksi'),('d','Dodi','Plant'),('f','Fitri','Produksi'),('h','Hana','Plant'),('v','Viewer','Kantor')]}
W=S1("select public.game_week_start()"); WP=S1("select public.game_week_start()-7")
def att(u,level,score,dur,week=None,passed=True,status='finished'):
    S("insert into game_attempts(user_id,level,week,status,finished_at,duration_ms,score,passed) values (%s,%s,coalesce(%s,public.game_week_start()),%s,now(),%s,%s,%s)",(U[u],level,week,status,dur,score,passed))
S("update game_settings set pass_score=60")
att('a',2,80,40000); att('a',3,90,60000)
att('b',2,80,30000); att('b',3,90,50000)
att('e',2,80,30000); att('e',3,90,50000)
att('c',4,100,90000)
att('d',3,59.99,10000,passed=False); att('d',2,40,1000,passed=False)
att('f',1,70,50000); att('f',2,70,50000); att('f',3,70,50000); att('f',4,70,50000)
att('v',3,100,1000,status='expired',passed=False)
def lb(basis='score',tie='fast',levels='{1,2,3,4}',week=None,dept=None,all_=False,me='v'):
    S("update game_settings set rank_basis=%s, tiebreak=%s, active_levels=%s",(basis,tie,levels))
    ok,r=P(U[me],"select rank,full_name,department,is_me,passed_levels,top_level,s1,s2,s3,s4,total,time_ms from public.game_leaderboard(%s,%s,%s)",(week,dept,all_))
    return r if ok else r
def order(r): return [(x[1],x[0]) for x in r]
r=lb()
chk('L1 dasar skor: urut total terbesar; seri total -> level tertinggi -> waktu tercepat; pemilik skor identik berbagi peringkat; peringkat melompat (1,2,2,4,5)', order(r)==[('Fitri',1),('Bima',2),('Eka',2),('Andi',4),('Citra',5)], order(r))
chk('L2 yang tidak lulus (skor 59.99) atau sesi hangus tidak muncul', all(x[1] not in ('Dodi','Viewer') for x in r))
fit=[x for x in r if x[1]=='Fitri'][0]; bi=[x for x in r if x[1]=='Bima'][0]
chk('L3 kolom: skor per level (kosong bila belum lulus), total, level tertinggi, jumlah lulus, waktu gabungan', fit[6:10]==(70,70,70,70) and float(fit[10])==280 and fit[5]==4 and fit[4]==4 and bi[6] is None and bi[7:10]==(80,90,None) and float(bi[10])==170 and bi[11]==80000, (fit,bi))
r=lb(tie='slow'); chk('L4 seri dipecahkan sebaliknya (waktu terlama) bila admin memilih: Andi (100 dtk) mendahului Bima/Eka (80 dtk)', order(r)==[('Fitri',1),('Andi',2),('Bima',3),('Eka',3),('Citra',5)], order(r))
r=lb(basis='level'); chk('L5 dasar level tertinggi: Fitri (L4, 280) lalu Citra (L4, 100), baru L3: Bima/Eka, Andi', order(r)==[('Fitri',1),('Citra',2),('Bima',3),('Eka',3),('Andi',5)], order(r))
att('a',3,70,10000); att('a',3,90,20000)
r=lb(); an=[x for x in r if x[1]=='Andi'][0]
chk('L6 skor terbaik per level: percobaan lebih rendah diabaikan; skor sama -> durasi tersingkat; waktu Andi jadi 40.000+20.000', float(an[8])==90 and an[11]==60000 and order(r)[:3]==[('Fitri',1),('Andi',2),('Bima',3)], (an, order(r)))
r=lb(levels='{1,3}'); chk('L7 hanya level aktif yang dihitung (aktif 1 dan 3): Citra (hanya L4) hilang, total Fitri 140', all(x[1]!='Citra' for x in r) and float([x for x in r if x[1]=='Fitri'][0][10])==140 and [x for x in r if x[1]=='Andi'][0][7] is None, order(r))
att('h',3,80,5000,week=WP); att('a',3,95,5000,week=WP)
r=lb(); chk('L8 minggu ini tidak memuat skor minggu lalu (Hana tidak muncul)', all(x[1]!='Hana' for x in r))
r=lb(week=WP); chk('L9 pilih minggu lalu: hanya Andi (95) dan Hana (80)', order(r)==[('Andi',1),('Hana',2)] and float(r[0][8])==95, order(r))
r=lb(all_=True); an=[x for x in r if x[1]=='Andi'][0]; chk('L10 akumulasi semua minggu: skor terbaik per level sepanjang waktu (Andi L3 = 95), Hana ikut', float(an[8])==95 and any(x[1]=='Hana' for x in r), order(r))
r=lb(dept='Plant'); chk('L11 filter departemen Plant: Bima dan Eka saja, peringkat dihitung ulang dalam departemen', order(r)==[('Bima',1),('Eka',1)], order(r))
r=lb(me='f'); chk('L12 baris milik pemanggil ditandai (is_me) untuk disorot', [x[3] for x in r if x[1]=='Fitri']==[True] and all(not x[3] for x in r if x[1]!='Fitri'))
ok,e=P(None,"select * from public.game_leaderboard()",role='anon'); chk('L13 pengunjung tanpa login tidak bisa melihat peringkat', not ok)
S("update profiles set status='pending' where id=%s",(U['v'],)); ok,e=P(U['v'],"select * from public.game_leaderboard()"); chk('L14 akun belum disetujui tidak bisa melihat peringkat', not ok, e)
S("update profiles set status='approved' where id=%s",(U['v'],))
# NIK tidak bocor
ok,r=P(U['v'],"select * from public.game_leaderboard()"); chk('L15 peringkat hanya memuat nama dan departemen (tanpa NIK/email)', len(r[0])==13 and 'NFitri' not in json.dumps(r,default=str) and '@x' not in json.dumps(r,default=str))
# peringkat sama untuk nilai sama persis (3 pemain identik)
S("delete from game_attempts")
for n in ('a','b','c'): att(n,3,75,30000)
r=lb(); chk('L16 tiga pemain identik persis -> semua peringkat 1', [x[0] for x in r]==[1,1,1], order(r))
print(f'TOTAL {OK} lulus, {BAD} gagal')
