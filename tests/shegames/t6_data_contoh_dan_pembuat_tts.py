import os, subprocess
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'base.py'), encoding='utf-8').read())
setup(bare=False)
adm = mkuser('adm@x', 'Admin', 'Kantor', 'admin'); p1 = mkuser('p1@x', 'Budi', 'Produksi')
GAMES = open(f'{ROOT}/games.sql', encoding='utf-8').read()
# ===== P. data contoh (pemasangan baru) =====
chk('P1 pemasangan baru: 8 rambu, 1 foto dengan 5 titik, 15 kata, 12 soal, tata letak tayang', S1("select count(*) from game_signs where live")==8 and S1("select jsonb_array_length(points) from game_scenes")==5 and S1("select count(*) from game_words where live")==15 and S1("select count(*) from game_questions")==12 and S1("select live_grid is not null from game_layout"))
chk('P2 keempat level siap dimainkan dan aktif', all(S1(f"select public.game_level_ready({i})") for i in (1,2,3,4)) and S1("select active_levels from game_settings")==[1,2,3,4] and S1("select seed_v2 from game_settings"))
chk('P3 rambu: 5 kategori terwakili, nama unik, semua gambar berupa jalur situs', {r[0] for r in S("select category from game_signs")}=={'Larangan','Peringatan','Wajib','Kondisi aman','Pemadam api'} and S1("select count(distinct lower(name)) from game_signs")==8 and S1("select count(*) from game_signs where image like 'assets/games/signs/%.svg'")==8)
try: c.execute("select public.game_check_layout(live_grid, true) from public.game_layout where id=1"); ok=True; e=''
except Exception as ex: ok=False; e=str(ex)
chk('P4 tata letak bawaan lolos pemeriksa server (eksak: memuat 15 dari 15 kata)', ok, e)
sc = S("select img_w,img_h,points from game_scenes")[0]
chk('P5 foto bahaya: 1200x800, titik di dalam gambar, radius wajar, tiap titik lengkap dengan risiko dan pengendalian', sc[0]==1200 and sc[1]==800 and all(0<=p['x']<=100 and 0<=p['y']<=100 and 1<=p['r']<=50 and p['name'] and p['risk'] and p['control'] for p in sc[2]), sc)
# idempoten
before = (S1("select count(*) from game_signs"), S1("select count(*) from game_scenes"), S1("select count(*) from game_words"))
c.execute(GAMES); c.execute(GAMES)
chk('P6 dijalankan ulang: tidak ada data ganda', before == (S1("select count(*) from game_signs"), S1("select count(*) from game_scenes"), S1("select count(*) from game_words")))
S("delete from game_signs"); S("delete from game_scenes"); c.execute(GAMES)
chk('P7 rambu dan foto yang sengaja dihapus admin tidak dimasukkan ulang', S1("select count(*) from game_signs")==0 and S1("select count(*) from game_scenes")==0)
# ===== M. pembaruan instalasi yang sudah ada (tahap 1-3 sudah dipasang, level 3 saja) =====
setup()   # keadaan polos: seed_v2=true; ubah menjadi instalasi lama
S("update game_settings set seed_v2=false")
c.execute(GAMES)
chk('M1 instalasi lama: rambu, foto, dan tata letak ditambahkan; keempat level diaktifkan', S1("select count(*) from game_signs")==8 and S1("select count(*) from game_scenes")==1 and S1("select live_grid is not null from game_layout") and S1("select active_levels from game_settings")==[1,2,3,4])
setup(); S("update game_settings set seed_v2=false"); S("update game_words set word='HAZARDX' where word='HAZARD'")
c.execute(GAMES)
chk('M2 instalasi lama yang kata-katanya sudah diubah: tata letak TIDAK dipaksakan (admin yang membuatnya); rambu dan foto tetap ditambahkan', S1("select live_grid is null from game_layout") and S1("select count(*) from game_signs")==8 and S1("select public.game_level_ready(1)") is False)
setup(); S("update game_settings set seed_v2=false"); S("insert into game_signs(name,category,image,live) values ('Rambu buatan admin','Wajib','https://x.co/a.png',true)")
c.execute(GAMES)
chk('M3 admin yang sudah punya rambu sendiri: rambu contoh tidak ditimpa atau ditambahkan', S1("select count(*) from game_signs")==1)
setup(); S("update game_settings set seed_v2=false, active_levels='{2,3}'"); c.execute(GAMES)
chk('M4 pilihan level admin yang sudah diubah (bukan bawaan) tidak ditimpa', S1("select active_levels from game_settings")==[2,3])
# ===== G. pembuat JavaScript lolos pemeriksa SERVER =====
js = r"""
const CW=require(process.argv[1]); const W=['HAZARD','APD','INSIDEN','PENGENDALIAN','EVAKUASI','ISOLASI','RISIKO','KESELAMATAN','APAR','HELM','SEPATU','KACAMATA','TOOLBOX','LANGKAH','PELAPORAN','LOCKOUT','BAHAYA','PROSEDUR','MASKER','SARUNG','TANGAN','PERISAI','PEMADAM','HIDRAN','ALARM','DARURAT','JALUR','TITIK','KUMPUL','AUDIT'];
const r=CW.rng(2026), cases=[];
for(let n=0;n<40;n++){const k=4+Math.floor(r()*17), pool=W.slice().sort(()=>r()-0.5).slice(0,k).map((w,i)=>({id:'w'+i,word:w}));
 const L=CW.generate(pool,{seed:n+11}); const placed=pool.filter(w=>!L.unplaced.includes(w.id));
 cases.push({words:placed.map(w=>w.word),layout:{rows:L.rows,cols:L.cols,items:L.items.map(i=>[pool.find(p=>p.id===i.id).word,i.num,i.row,i.col,i.dir])},unplaced:L.unplaced.length});}
console.log(JSON.stringify(cases));"""
out = subprocess.run(['node', '-e', js, os.path.join(ROOT, '..', 'public', 'assets', 'games', 'games-cw.js')], capture_output=True, text=True)
cases = json.loads(out.stdout) if out.returncode == 0 else []
chk('G0 pembuat dijalankan di Node: 40 kasus acak dihasilkan', len(cases) == 40, out.stderr[:200])
okc = 0; fails = []
for n, cs in enumerate(cases):
    S("delete from game_words")
    ids = {w: S1("insert into game_words(word,clue,live) values (%s,'c',true) returning id::text", (w,)) for w in cs['words']}
    items = [{'id': ids[w], 'num': nm, 'row': r_, 'col': c_, 'dir': d} for (w, nm, r_, c_, d) in cs['layout']['items']]
    grid = {'rows': cs['layout']['rows'], 'cols': cs['layout']['cols'], 'items': items}
    try: c.execute("select public.game_check_layout(%s::jsonb, true)", (json.dumps(grid),)); okc += 1
    except Exception as ex: fails.append((n, str(ex)[:120]))
chk(f'G1 40 tata letak acak buatan JavaScript semuanya lolos pemeriksa SERVER (eksak, tanpa tabrakan dan huruf bersebelahan); {sum(c_["unplaced"] for c_ in cases)} kata tak tertempatkan dikeluarkan sebelum diperiksa', okc == 40, fails[:3])
# ===== E. data contoh dimainkan sampai skor tersimpan (lewat fungsi server) =====
setup(bare=False)
adm = mkuser('adm@x', 'Admin', 'Kantor', 'admin'); p1 = mkuser('p1@x', 'Budi', 'Produksi')
S("update game_settings set sequential=false, timer_sign=0, q_count=10")
ok, pl = P(p1, "select public.game_start(2)")
chk('E1 level 2 dengan 8 rambu contoh: 8 soal (batas jumlah rambu), 4 pilihan berbeda, gambar dari jalur situs', ok and pl['total']==8 and all(len(set(i['opts']))==4 and i['image'].startswith('assets/games/signs/') for i in pl['items']), pl if not ok else pl['total'])
att = pl['attempt_id']
for i in range(8):
    st = S1("select state from game_sessions where attempt_id=%s", (att,)); it = st['items'][i]; P(p1, "select public.game_answer(%s,%s,%s)", (att, i, it['opts'].index(it['id'])))
ok, f = P(p1, "select public.game_finish(%s)", (att,)); chk('E2 menjawab benar semua: skor 100 dan lulus', ok and float(f['score'])==100 and f['passed'], f)
ok, pl = P(p1, "select public.game_start(4)"); att = pl['attempt_id']
pts = S1("select points from game_scenes")
chk('E3 level 4: foto contoh dengan 5 titik; posisi titik tidak ada di data yang dikirim; ada jam server untuk sinkron waktu', ok and pl['total_points']==5 and 'now_ms' in pl and 'Kabel' not in json.dumps(pl))
hits = [P(p1, "select public.game_tap(%s,%s,%s)", (att, p['x'], p['y']))[1] for p in pts]
chk('E4 mengetuk pusat tiap titik: kelima titik terkena, lengkap dengan risiko dan pengendalian', all(h['hit'] for h in hits) and hits[-1]['done'] and all(h['risk'] and h['control'] for h in hits), hits)
ok, f = P(p1, "select public.game_finish(%s)", (att,)); chk('E5 skor level 4 = 100', ok and float(f['score'])==100 and f['passed'], f)
ok, pl = P(p1, "select public.game_start(1)"); att = pl['attempt_id']
chk('E6 level 1: 15 petunjuk dikirim, tanpa kata jawaban', ok and len(pl['items'])==15 and not any(w[0] in json.dumps(pl) for w in [('PENGENDALIAN',),('KESELAMATAN',)]), pl if not ok else len(pl['items']))
grid = S1("select live_grid from game_layout"); words = {r[0]: r[1] for r in S("select id::text, word from game_words")}
ans = {f"{it['num']}{it['dir']}": words[it['id']] for it in grid['items']}
ok, f = P(p1, "select public.game_finish(%s,%s)", (att, json.dumps(ans))); chk('E7 mengisi semua kata dengan benar: skor 100 dan lulus', ok and float(f['score'])==100 and f['correct']==15, f)
ok, lb = P(p1, "select total from public.game_leaderboard()"); chk('E8 total peringkat = 300 (tiga level lulus sempurna)', ok and float(lb)==300, lb)
print(f'TOTAL {OK} lulus, {BAD} gagal')
