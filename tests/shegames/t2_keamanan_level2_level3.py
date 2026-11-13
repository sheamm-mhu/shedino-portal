import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'base.py'), encoding='utf-8').read())
setup()
adm = mkuser('adm@x','Admin','Kantor','admin'); p1 = mkuser('p1@x','Budi','Produksi'); p2 = mkuser('p2@x','Sari','Plant'); p3 = mkuser('p3@x','Dewi','Produksi'); p4=mkuser('p4@x','Rudi','Plant')
pend = mkuser('pend@x','Baru','Produksi',status='pending')
S("update game_settings set q_count=5, timer_mcq=0, timer_sign=0, sequential=false")
for i,(n,cat) in enumerate([('Dilarang merokok','Larangan'),('Dilarang masuk','Larangan'),('Dilarang menyalakan api','Larangan'),('Awas listrik','Peringatan'),('Awas licin','Peringatan'),('Awas beban jatuh','Peringatan'),('Wajib helm','Wajib'),('Wajib sepatu','Wajib'),('Wajib kacamata','Wajib')]):
    S("insert into game_signs(name,category,meaning,image,live) values (%s,%s,%s,%s,true)",(n,cat,'Arti '+n,f'assets/games/s{i}.svg'))
# ===== D. keamanan =====
chk('D1 pemain tidak melihat satu pun baris soal/kunci/sesi/percobaan lewat tabel (RLS)', all(P(p1,f"select count(*) from {t}")==(True,0) for t in ('game_questions','game_words','game_signs','game_scenes','game_attempts','game_sessions','game_layout')))
chk('D2 admin melihat semua soal (12) dan kunci', P(adm,"select count(*) from game_questions")==(True,12))
ok,e=P(p1,"insert into game_attempts(user_id,level,week,status,score,passed) values (%s,3,current_date,'finished',100,true)",(p1,))
chk('D3 pemain TIDAK bisa menulis skor langsung ke tabel', not ok, e)
AS(p1); n=c.execute("update game_settings set pass_score=0").rowcount; c.execute('reset role')
chk('D4 pemain tidak bisa mengubah pengaturan (0 baris berubah)', n==0 and S1("select pass_score from game_settings")==60)
ok,e=P(None,"select public.game_my_status()",role='anon'); chk('D5 pengunjung tanpa login tidak bisa memanggil fungsi permainan', not ok, e)
ok,e=P(pend,"select public.game_my_status()"); chk('D6 akun yang belum disetujui ditolak', not ok and 'disetujui' in e, e)
ok,e=P(p1,"select public.game_publish()"); chk('D7 pemain biasa tidak bisa memanggil fungsi admin (terbit)', not ok and 'admin' in e.lower(), e)
ok,e=P(p1,"select public.game_admin_reset_scores('all')"); chk('D8 pemain tidak bisa menghapus skor', not ok, e)
ok,e=P(p1,"select public.game_payload(gen_random_uuid())"); chk('D9 fungsi internal tidak dapat dipanggil pemain (hak dicabut)', not ok and 'permission' in e.lower(), e)
ok,e=P(p1,"select public.game_cell_letter(0,0)"); chk('D10 pembaca huruf kotak (kunci TTS) tidak dapat dipanggil pemain', not ok and 'permission' in e.lower(), e)
ok,e=P(p1,"select * from public.game_res_words()"); chk('D11 daftar kata hasil akhir (kunci TTS) tidak dapat dipanggil pemain', not ok, e)
# ===== E. level 3 pilihan ganda =====
def l3_choice(att, idx):
    st=S1("select state from game_sessions where attempt_id=%s",(att,)); it=st['items'][idx]
    key=S1("select key from game_questions where id=%s",(it['id'],)); return it['order'].index(key), it
ok,pl=P(p1,"select public.game_start(3)"); 
chk('E1 mulai level 3: 5 soal acak, tiap soal punya pilihan; tanpa kunci/penjelasan di data yang dikirim', ok and pl['total']==5 and len(pl['items'])==5 and not re.search(r'"(key|expl|explanation|correct|ok|order)"', json.dumps(pl)), pl if not ok else list(pl['items'][0].keys()))
att=pl['attempt_id']
# pilihan yang dikirim = pilihan asli soal itu (dalam urutan teracak)
real=S("select id::text, opts from game_questions"); realmap={r[0]:set(r[1]) for r in real}
chk('E2 pilihan tiap soal sama dengan pilihan aslinya (hanya diacak urutannya)', all(set(i['opts'])==realmap[i['id']] for i in pl['items']))
ok,e=P(p1,"select public.game_answer(%s,1,0)",(att,)); chk('E3 menjawab melompati urutan ditolak', not ok and 'urutan' in e, e)
ok,e=P(p2,"select public.game_answer(%s,0,0)",(att,)); chk('E4 pemain lain TIDAK bisa menjawab percobaan orang lain', not ok and 'tidak ditemukan' in e, e)
res=[]
for i in range(5):
    ci,_=l3_choice(att,i); pick = ci if i<3 else (ci+1)%4
    ok,r=P(p1,"select public.game_answer(%s,%s,%s)",(att,i,pick)); res.append(r)
chk('E5 server menilai: 3 benar, 2 salah; mengembalikan indeks benar dan penjelasan', ok and [x['correct'] for x in res]==[True,True,True,False,False] and all(x['explanation'] for x in res) and res[-1]['done'], res)
ok,e=P(p1,"select public.game_answer(%s,5,0)",(att,)); chk('E6 tidak bisa menjawab melebihi jumlah soal', not ok, e)
ok,fin=P(p1,"select public.game_finish(%s)",(att,))
chk('E7 selesai: skor 60 dihitung server, lulus (ambang 60), 3 dari 5, tanpa bocoran', ok and float(fin['score'])==60 and fin['passed'] and fin['correct']==3 and fin['total']==5 and fin['best_week'] is not None, fin)
row=S("select status,score,passed,correct,total,array_length(wrong_ids,1),duration_ms>=0 from game_attempts where id=%s",(att,))[0]
chk('E8 tersimpan: percobaan selesai, 2 id soal salah tercatat untuk analitik', row==('finished',60,True,3,5,2,True), row)
ok,fin2=P(p1,"select public.game_finish(%s)",(att,)); chk('E9 menyelesaikan dua kali mengembalikan hasil yang sama (idempoten)', ok and fin2==fin)
ok,e=P(p1,"select public.game_answer(%s,0,0)",(att,)); chk('E10 tidak bisa menjawab setelah selesai', not ok, e)
# batas percobaan
S("update game_settings set max_attempts=1")
ok,e=P(p1,"select public.game_start(3)"); chk('E11 batas percobaan 1 per minggu: percobaan kedua ditolak', not ok and 'Batas percobaan' in e, e)
ok,pl2=P(p2,"select public.game_start(3)"); chk('E12 batas berlaku per pemain (pemain lain tetap bisa)', ok)
S("update game_settings set max_attempts=0")
ok,pl3=P(p1,"select public.game_start(3)"); chk('E13 batas 0 = tanpa batas', ok and pl3['attempt_id']!=att)
ok,pl3b=P(p1,"select public.game_start(3)"); chk('E14 satu sesi aktif per level: memulai lagi melanjutkan sesi yang sama (tanpa menambah percobaan)', ok and pl3b['attempt_id']==pl3['attempt_id'] and [i['id'] for i in pl3b['items']]==[i['id'] for i in pl3['items']] and S1("select count(*) from game_attempts where user_id=%s and level=3",(p1,))==2)
# jawaban tidak diselesaikan -> salah
att3=pl3['attempt_id']; ci,_=l3_choice(att3,0); P(p1,"select public.game_answer(%s,0,%s)",(att3,ci))
ok,f3=P(p1,"select public.game_finish(%s)",(att3,))
chk('E15 soal yang belum dijawab dihitung salah (1 benar dari 5 = 20, tidak lulus)', ok and float(f3['score'])==20 and not f3['passed'] and f3['total']==5, f3)
chk('E16 id 4 soal belum dijawab tercatat salah', S1("select array_length(wrong_ids,1) from game_attempts where id=%s",(att3,))==4)
# timer
S("update game_settings set timer_mcq=10")
ok,pt=P(p3,"select public.game_start(3)"); a_=pt['attempt_id']
S("update game_sessions set state=jsonb_set(state,'{last_ms}',to_jsonb(public.game_now_ms()-60000)) where attempt_id=%s",(a_,))
ci,_=l3_choice(a_,0); ok,r=P(p3,"select public.game_answer(%s,0,%s)",(a_,ci))
chk('E17 melewati batas waktu (60 dtk > 10+5): jawaban benar pun dihitung salah (waktu habis)', ok and r['timed_out'] and not r['correct'], r)
ci,_=l3_choice(a_,1); ok,r=P(p3,"select public.game_answer(%s,1,%s)",(a_,ci)); chk('E18 soal berikutnya dalam batas waktu dinilai normal', ok and r['correct'] and not r['timed_out'], r)
ok,r=P(p3,"select public.game_answer(%s,2,-1)",(a_,)); chk('E19 pilihan -1 (waktu habis di layar/dilewati) dihitung salah', ok and r['timed_out'] and not r['correct'])
S("update game_settings set timer_mcq=0")
ok,e=P(p3,"select public.game_answer(%s,3,9)",(a_,)); chk('E20 pilihan di luar jumlah opsi ditolak', not ok and 'tidak valid' in e, e)
# sesi hangus
a_old=S1("select id from game_attempts where user_id=%s and level=3 and status='active'",(p3,))
S("update game_attempts set started_at=now()-interval '3 hours' where id=%s",(a_old,))
ok,st=P(p3,"select public.game_my_status()")
lv3=[l for l in st['levels'] if l['level']==3][0]
chk('E21 sesi yang dibiarkan >2 jam hangus: tidak lagi aktif, tetap terhitung sebagai percobaan', ok and lv3['active_attempt'] is None and S1("select status from game_attempts where id=%s",(a_old,))=='expired' and lv3['attempts']>=1, lv3)
ok,e=P(p3,"select public.game_finish(%s)",(a_old,)); chk('E22 menyelesaikan sesi yang hangus ditolak', not ok, e)
# ===== F. level 2 tebak rambu =====
ok,pl=P(p1,"select public.game_start(2)")
chk('F1 level 2: 5 gambar rambu, masing-masing 4 pilihan nama berbeda; tanpa arti/kunci', ok and pl['total']==5 and all(len(set(i['opts']))==4 for i in pl['items']) and not re.search(r'meaning|"key"|"correct"|"ok"', json.dumps(pl)), pl if not ok else json.dumps(pl)[:200])
sg={r[0]:(r[1],r[2]) for r in S("select id::text,name,category from game_signs")}
same=0
for i in pl['items']:
    cat=sg[i['id']][1]; cats=[ [v[1] for v in sg.values() if v[0]==n][0] for n in i['opts'] ]
    same+= (cats.count(cat)==3)
chk('F2 pengecoh diprioritaskan dari kategori yang sama (kategori hanya 3 rambu: ketiganya selalu ikut sebagai pilihan)', same==5, same)
att=pl['attempt_id']; outs=[]
for i in range(5):
    st=S1("select state from game_sessions where attempt_id=%s",(att,)); it=st['items'][i]; ci=it['opts'].index(it['id'])
    pick=ci if i%2==0 else (ci+1)%4
    ok,r=P(p1,"select public.game_answer(%s,%s,%s)",(att,i,pick)); outs.append(r)
chk('F3 server menilai dan mengembalikan nama serta arti rambu setelah menjawab', ok and [o['correct'] for o in outs]==[True,False,True,False,True] and all(o['name'] and o['meaning'] for o in outs), outs)
ok,fin=P(p1,"select public.game_finish(%s)",(att,)); chk('F4 skor level 2 = 60 (3 dari 5) lulus', ok and float(fin['score'])==60 and fin['passed'], fin)
print(f'TOTAL {OK} lulus, {BAD} gagal')
