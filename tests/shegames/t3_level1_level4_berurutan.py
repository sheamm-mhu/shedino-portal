import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'base.py'), encoding='utf-8').read())
setup()
adm = mkuser('adm@x','Admin','Kantor','admin'); p1 = mkuser('p1@x','Budi','Produksi'); p2 = mkuser('p2@x','Sari','Plant'); p3 = mkuser('p3@x','Dewi','Produksi'); p4=mkuser('p4@x','Rudi','Plant'); p5=mkuser('p5@x','Tono','Plant')
S("update game_settings set sequential=false")
# ===== G. level 1 teka-teki silang =====
S("delete from game_words")
ids={}
for w,cl in [('HAZARD','Sumber bahaya'),('HELM','Pelindung kepala'),('RISIKO','Kemungkinan dikali keparahan'),('ISOLASI','Pemisahan energi')]:
    ids[w]=S1("insert into game_words(word,clue,live) values (%s,%s,true) returning id::text",(w,cl))
chk('G0 level 1 belum siap sebelum tata letak diterbitkan', S1("select public.game_level_ready(1)") is False)
ok,e=P(p1,"select public.game_start(1)"); chk('G0b memulai level yang belum siap ditolak dengan pesan jelas', not ok and 'belum siap' in e, e)
grid={'rows':6,'cols':11,'items':[{'id':ids['HAZARD'],'num':1,'row':0,'col':0,'dir':'A'},{'id':ids['HELM'],'num':1,'row':0,'col':0,'dir':'D'},
      {'id':ids['RISIKO'],'num':2,'row':0,'col':4,'dir':'D'},{'id':ids['ISOLASI'],'num':3,'row':3,'col':4,'dir':'A'}]}
S("update game_layout set grid=%s, live_grid=%s where id=1",(json.dumps(grid),json.dumps(grid)))
chk('G0c level 1 siap setelah tata letak tersedia', S1("select public.game_level_ready(1)") is True)
ok,pl=P(p1,"select public.game_start(1)")
txt=json.dumps(pl).upper()
chk('G1 level 1: tata letak (baris, kolom, nomor, arah, panjang, petunjuk) dikirim; huruf/kata jawaban TIDAK ada di data', ok and pl['rows']==6 and pl['cols']==11 and len(pl['items'])==4 and all('len' in i and 'clue' in i for i in pl['items']) and not any(w in txt for w in ('HAZARD','HELM','RISIKO','ISOLASI')) and 'word' not in json.dumps(pl), pl if not ok else json.dumps(pl)[:300])
lens=sorted((i['num'],i['dir'],i['len']) for i in pl['items']); chk('G1b panjang kata benar (HAZARD 6, HELM 4, RISIKO 6, ISOLASI 7)', lens==[(1,'A',6),(1,'D',4),(2,'D',6),(3,'A',7)], lens)
att=pl['attempt_id']
ok,h=P(p1,"select public.game_hint(%s,0,0)",(att,)); chk('G2 bantuan huruf di kotak (0,0) = H, dikenai poin (bantuan ke-1)', ok and h['letter']=='H' and h['charged'] and h['hints_used']==1, h)
ok,h=P(p1,"select public.game_hint(%s,0,0)",(att,)); chk('G3 meminta kotak yang sama lagi: huruf sama, TIDAK dihitung dua kali', ok and h['letter']=='H' and not h['charged'] and h['hints_used']==1, h)
ok,h=P(p1,"select public.game_hint(%s,0,4)",(att,)); chk('G4 kotak perpotongan HAZARD x RISIKO = R', ok and h['letter']=='R' and h['hints_used']==2, h)
ok,h=P(p1,"select public.game_hint(%s,3,6)",(att,)); chk('G5 huruf kata mendatar ISOLASI di (3,6) = O (bantuan ke-3)', ok and h['letter']=='O' and h['hints_used']==3, h)
ok,e=P(p1,"select public.game_hint(%s,1,0)",(att,)); chk('G6 bantuan ke-4 ditolak (maksimal 3)', not ok and 'habis' in e, e)
ok,h=P(p1,"select public.game_hint(%s,0,0)",(att,)); chk('G7 setelah bantuan habis, kotak yang sudah dibuka tetap bisa dilihat lagi tanpa biaya', ok and h['letter']=='H' and not h['charged'])
ok,e=P(p1,"select public.game_hint(%s,1,1)",(att,)); chk('G8 kotak kosong (bukan bagian kata) ditolak', not ok, e)
ok,e=P(p2,"select public.game_hint(%s,2,0)",(att,)); chk('G9 pemain lain tidak bisa meminta bantuan di percobaan orang', not ok and 'tidak ditemukan' in e, e)
ok,pr=P(p1,"select public.game_start(1)"); chk('G10 melanjutkan sesi: bantuan yang sudah dipakai ikut terkirim (3 huruf) dan hitungan bantuan terjaga', ok and pr['attempt_id']==att and pr['hints_used']==3 and sorted(x['letter'] for x in pr['hinted'])==['H','O','R'], pr if not ok else pr['hinted'])
ans={'1A':'hazard ','1D':'HELM','2D':'risiko','3A':' Isolasi'}
ok,f=P(p1,"select public.game_finish(%s,%s)",(att,json.dumps(ans)))
chk('G11 semua benar (huruf besar-kecil/spasi diabaikan) dengan 3 bantuan: 100 - 15 = 85, lulus', ok and float(f['score'])==85 and f['passed'] and f['correct']==4 and f['hints']==3, f)
chk('G12 setelah selesai, kunci dibuka: kata dan petunjuk semua butir', ok and sorted(r['word'] for r in f['reveal'])==['HAZARD','HELM','ISOLASI','RISIKO'])
ok,pl=P(p1,"select public.game_start(1)"); a2=pl['attempt_id']
ok,f=P(p1,"select public.game_finish(%s,%s)",(a2,json.dumps({'1A':'HAZARD','1D':'HELM','2D':'RISIKO','3A':'SALAH'})))
chk('G13 3 dari 4 benar tanpa bantuan = 75; satu salah tercatat untuk analitik', ok and float(f['score'])==75 and S1("select wrong_ids from game_attempts where id=%s",(a2,))==[ids['ISOLASI']], f)
ok,pl=P(p1,"select public.game_start(1)"); a3=pl['attempt_id']
ok,f=P(p1,"select public.game_finish(%s,%s)",(a3,json.dumps({'xx':'a','1A':"'; drop table game_words;--"})))
chk('G14 jawaban kosong/sampah: skor 0, tidak merusak apa pun', ok and float(f['score'])==0 and not f['passed'] and S1("select count(*) from game_words")==4)
ok,pl=P(p1,"select public.game_start(1)"); a4=pl['attempt_id']
ok,f=P(p1,"select public.game_finish(%s)",(a4,)); chk('G15 selesai tanpa mengirim jawaban sama sekali: skor 0', ok and float(f['score'])==0)
# ===== H. level 4 tebak bahaya =====
S("insert into game_scenes(title,prompt,image,img_w,img_h,points,live) values ('Area gudang','Temukan semua bahaya','assets/games/gudang.jpg',1000,500,%s,true)",
  (json.dumps([{'x':50,'y':50,'r':10,'name':'Kabel terkelupas','risk':'Sengatan listrik','control':'Ganti kabel'},{'x':80,'y':20,'r':5,'name':'Lantai licin','risk':'Terpeleset','control':'Bersihkan tumpahan'},{'x':20,'y':80,'r':8,'name':'Tabung tanpa rantai','risk':'Tabung roboh','control':'Ikat dengan rantai'}]),))
sid=S1("select id::text from game_scenes")
ok,pl=P(p2,"select public.game_start(4)"); a=pl['attempt_id']
chk('H1 level 4: foto, judul, perintah, ukuran dan jumlah titik dikirim; posisi/nama/risiko titik TIDAK dikirim', ok and pl['scene']['image'].endswith('gudang.jpg') and pl['total_points']==3 and pl['found']==[] and not re.search(r'Kabel|Sengatan|Lantai|risk|control|"x"', json.dumps(pl)), pl if not ok else json.dumps(pl)[:300])
ok,r=P(p2,"select public.game_tap(%s,61,50)",(a,)); chk('H2 ketukan di luar lingkaran (jarak 110 px > radius 100 px) = salah, kena penalti', ok and r['hit'] is False and r['wrong']==1, r)
ok,r=P(p2,"select public.game_tap(%s,60,50)",(a,)); chk('H3 tepat di tepi lingkaran (100 px = radius) = kena; nama, risiko, pengendalian dibuka', ok and r['hit'] and r['idx']==0 and r['name']=='Kabel terkelupas' and r['risk']=='Sengatan listrik' and r['control']=='Ganti kabel' and r['found']==1 and r['total']==3, r)
ok,r=P(p2,"select public.game_tap(%s,50,50)",(a,)); chk('H4 mengetuk titik yang sudah ditemukan: bukan salah ketuk (tanpa penalti)', ok and r['hit'] is False and r.get('dup') and r['wrong']==1, r)
ok,r=P(p2,"select public.game_tap(%s,50,71)",(a,)); chk('H5 (50,71): 105 px dari pusat = salah (wrong jadi 2)', ok and r['hit'] is False and r['wrong']==2, r)
ok,r=P(p2,"select public.game_tap(%s,80,20)",(a,)); chk('H6 titik kedua ditemukan', ok and r['hit'] and r['idx']==1 and r['found']==2)
ok,pr=P(p2,"select public.game_start(4)"); chk('H7 melanjutkan sesi: titik yang sudah ditemukan, jumlah salah, dan waktu mulai terjaga', ok and pr['attempt_id']==a and len(pr['found'])==2 and pr['wrong']==2, pr if not ok else (len(pr['found']),pr['wrong']))
ok,f=P(p2,"select public.game_finish(%s)",(a,))
chk('H8 skor = 2/3 = 66.67% - 2 salah ketuk x 5 = 56.67: tidak lulus', ok and abs(float(f['score'])-56.67)<0.01 and not f['passed'] and f['correct']==2 and f['total']==3 and f['wrong_taps']==2, f)
chk('H9 hasil menampilkan semua titik, yang terlewat ditandai, lengkap risiko dan pengendalian', ok and len(f['reveal'])==3 and [r['found'] for r in f['reveal']]==[True,True,False] and f['reveal'][2]['control']=='Ikat dengan rantai', f['reveal'] if ok else f)
chk('H10 titik terlewat tercatat untuk analitik sebagai idfoto:indeks', S1("select wrong_ids from game_attempts where id=%s",(a,))==[sid+':2'])
ok,e=P(p2,"select public.game_tap(%s,50,50)",(a,)); chk('H11 ketukan setelah selesai ditolak', not ok, e)
ok,pl=P(p2,"select public.game_start(4)"); b=pl['attempt_id']
for x,y in [(50,70),(80,20),(20,80)]: ok,r=P(p2,"select public.game_tap(%s,%s,%s)",(b,x,y))
chk('H12 BUKTI skala piksel: (50,70) berjarak 20% tinggi = 100 px = radius, jadi KENA walau 20 > radius 10 jika dihitung dalam persen mentah', r['found']==3 and r['done'])
ok,r=P(p2,"select public.game_tap(%s,0,0)",(b,)); 
ok,f=P(p2,"select public.game_finish(%s)",(b,)); chk('H13 semua 3 ditemukan + 1 salah ketuk = 100 - 5 = 95, lulus', ok and float(f['score'])==95 and f['passed'], f)
ok,pl=P(p2,"select public.game_start(4)"); cc=pl['attempt_id']
for i in range(30): P(p2,"select public.game_tap(%s,0,0)",(cc,))
ok,f=P(p2,"select public.game_finish(%s)",(cc,)); chk('H14 banyak salah ketuk: skor minimum 0 (tidak negatif)', ok and float(f['score'])==0 and f['wrong_taps']==30, f)
ok,pl=P(p2,"select public.game_start(4)"); dd=pl['attempt_id']
for bad in [(-1,5),(101,5),(5,-0.1),(5,100.1)]:
    ok,e=P(p2,"select public.game_tap(%s,%s,%s)",(dd,)+bad); 
    if ok: break
chk('H15 koordinat di luar 0-100 ditolak', not ok, e)
ok,e=P(p2,"select public.game_tap(%s,null,5)",(dd,)); chk('H15b koordinat kosong ditolak', not ok)
ok,e=P(p3,"select public.game_tap(%s,5,5)",(dd,)); chk('H16 pemain lain tidak bisa mengetuk di percobaan orang', not ok and 'tidak ditemukan' in e, e)
S("update game_settings set hazard_time=1"); S("update game_sessions set state=jsonb_set(state,'{start_ms}',to_jsonb(public.game_now_ms()-100000)) where attempt_id=%s",(dd,))
ok,r=P(p2,"select public.game_tap(%s,50,50)",(dd,)); chk('H17 melewati batas waktu: ketukan ditolak (expired), tidak menambah hitungan', ok and r.get('expired') and S1("select state->'found' from game_sessions where attempt_id=%s",(dd,))==[], r)
S("update game_settings set hazard_time=120")
# foto lain: pemain diberi foto yang belum pernah dimainkan lebih dulu
for nm_ in ('Area bengkel','Area dapur'): S("insert into game_scenes(title,prompt,image,points,live) values (%s,'','assets/games/x.jpg',%s,true)",(nm_,json.dumps([{'x':30,'y':30,'r':10,'name':'B','risk':'','control':''}])))
P(p2,"select public.game_finish(%s)",(dd,))
seen=set()
for i in range(2):
    ok,pl=P(p2,"select public.game_start(4)"); seen.add(pl['scene']['title']); P(p2,"select public.game_finish(%s)",(pl['attempt_id'],))
chk('H18 foto yang belum pernah dimainkan diprioritaskan: dua percobaan berikutnya memakai dua foto baru yang berbeda', seen=={'Area bengkel','Area dapur'}, seen)
# ===== I. level berurutan =====
S("update game_settings set sequential=true, active_levels='{1,2,3,4}'")
for i in range(4): S("insert into game_signs(name,category,meaning,image,live) values (%s,'Larangan','a','assets/x.svg',true)",(f'R{i}',))
for i in range(3): S("insert into game_questions(q,opts,key,expl,live) values (%s,array['a','b'],0,'',true)",(f'Q{i}',))
ok,e=P(p4,"select public.game_start(2)"); chk('I1 berurutan: level 2 terkunci sebelum level 1 lulus', not ok and 'terbuka setelah' in e, e)
ok,st=P(p4,"select public.game_my_status()"); L={l['level']:l for l in st['levels']}
chk('I2 status: level 1 terbuka, level 2-4 terkunci; semua level siap', L[1]['unlocked'] and not L[2]['unlocked'] and not L[3]['unlocked'] and all(L[i]['ready'] for i in (1,2,3,4)), L)
ok,pl=P(p4,"select public.game_start(1)"); ok,f=P(p4,"select public.game_finish(%s,%s)",(pl['attempt_id'],json.dumps({'1A':'HAZARD','1D':'HELM','2D':'RISIKO','3A':'ISOLASI'})))
ok,pl2=P(p4,"select public.game_start(2)"); chk('I3 lulus level 1 membuka level 2', ok)
ok,e=P(p4,"select public.game_start(3)"); chk('I4 level 3 masih terkunci sebelum level 2 lulus', not ok)
P(p4,"select public.game_finish(%s)",(pl2['attempt_id'],))
S("update game_attempts set week=week - 7 where user_id=%s",(p4,))
ok,e2=P(p4,"select public.game_start(2)")
chk('I5 kelulusan minggu lalu tidak membuka level minggu ini (peringkat bersifat mingguan)', not ok and 'terbuka setelah' in e2, e2)
S("update game_settings set sequential=false"); ok,_=P(p5,"select public.game_start(3)"); chk('I6 berurutan dimatikan: level mana pun langsung bisa dimainkan', ok)
S("update game_settings set sequential=true, active_levels='{2,3}'"); ok,_=P(p5,"select public.game_start(2)"); ok2,e2=P(p3,"select public.game_start(1)")
chk('I7 level nonaktif tidak bisa dimainkan; level pertama yang aktif (2) langsung terbuka', ok and not ok2 and 'tidak aktif' in e2, e2)
# ===== level tanpa konten tidak menghalangi, departemen =====
S("update game_settings set sequential=true, active_levels='{1,2,3,4}'"); S("delete from game_signs"); S("update game_layout set live_grid=null")
ok,st=P(p3,"select public.game_my_status()"); L={l['level']:l for l in st['levels']}
chk('I8 level 1 dan 2 belum punya konten: level 3 tetap terbuka (level tanpa konten tidak mengunci level berikutnya)', not L[1]['ready'] and not L[2]['ready'] and L[3]['unlocked'], L)
chk('I9 status memuat profil (nama, departemen) dan tanggal hari ini', st['profile']['full_name']=='Dewi' and st['profile']['department']=='Produksi' and 'today' in st, st.get('profile'))
ok,e=P(p3,"select public.game_set_department('Gudang')"); chk('I10 departemen di luar daftar admin ditolak', not ok and 'daftar' in e, e)
ok,r=P(p3,"select public.game_set_department(' SHE ')"); chk('I11 pemain mengisi departemennya sendiri (dirapikan)', ok and S1("select department from profiles where id=%s",(p3,))=='SHE', r)
S("update game_settings set departments='{}'"); ok,r=P(p3,"select public.game_set_department('Gudang Timur')"); chk('I12 bila admin belum membuat daftar, departemen bebas diisi', ok and S1("select department from profiles where id=%s",(p3,))=='Gudang Timur')
ok,e=P(p3,"select public.game_set_department('  ')"); chk('I13 departemen kosong ditolak', not ok)

print(f'TOTAL {OK} lulus, {BAD} gagal')
