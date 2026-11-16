import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'base.py'), encoding='utf-8').read())
setup(bare=True)
DQ = open(f'{ROOT}/daily-quotes.sql', encoding='utf-8').read()
c.execute(DQ)
adm = mkuser('adm@x', 'Admin', 'SHE', 'admin'); emp = mkuser('emp@x', 'Budi', 'Produksi'); pend = mkuser('pend@x', 'Baru', 'Plant', status='pending')
TOK = 'tokenabcdefghijklmnop'
def obj(name, bucket='dq-submissions'): S("insert into storage.objects(bucket_id,name) values (%s,%s)", (bucket, name))
def url(name): return f'https://x.supabase.co/storage/v1/object/public/dq-submissions/{name}'
TPL = S1("select id::text from dq_templates")
def sub(who, n='p/261116/aaaaaaaaaa01.jpg', name='Budi', job='Operator', quote='Selamat bekerja', tok=TOK, tpl=None, hp='', role='authenticated', date='03/NOV/26', sender='', mk=True):
    if mk and n: 
        try: obj(n)
        except Exception: pass
    return P(who, "select public.dq_submit(%s,%s,%s,%s,%s,%s,%s,%s,%s)", (tpl or TPL, url(n), name, job, quote, date, sender, tok, hp), role=role)
# ===== A. skema dan data awal =====
chk('A1 kolom cta pada artikel: hanya "", dailyquotes, none', S1("select count(*) from information_schema.columns where table_name='media_posts' and column_name='cta'") == 1)
try: c.execute("insert into media_posts(id,title,cta) values ('x','x','salah')"); ok = False
except Exception: ok = True
chk('A2 nilai cta lain ditolak', ok)
chk('A3 templat contoh terpasang sekali (1 templat aktif, 4 kotak teks: date, name, job, quote; jalur gambar assets/)', S1("select count(*) from dq_templates")==1 and [f['key'] for f in S1("select fields from dq_templates")]==['date','name','job','quote'] and S1("select back_image from dq_templates").startswith('assets/dq/'))
c.execute(DQ); c.execute(DQ)
chk('A4 dijalankan ulang: tidak ada data ganda', S1("select count(*) from dq_templates")==1 and S1("select count(*) from dq_settings")==1)
chk('A5 bucket dq-submissions: publik, batas 1 MB, hanya JPEG, WebP, PNG', S("select public,file_size_limit,allowed_mime_types from storage.buckets where id='dq-submissions'")[0]==(True,1048576,['image/jpeg','image/webp','image/png']))
# ===== B. bentuk templat divalidasi di database =====
good = S1("select fields from dq_templates"); photo = S1("select photo from dq_templates")
def ins(photo_=None, fields_=None, back='assets/a.jpg', front='', w=1080, h=1350):
    try: c.execute("insert into dq_templates(name,back_image,front_image,w,h,photo,fields) values ('t',%s,%s,%s,%s,%s,%s)", (back, front, w, h, json.dumps(photo_ or photo), json.dumps(good if fields_ is None else fields_))); return True
    except Exception: return False
def mod(**kw): f = json.loads(json.dumps(good)); f[0].update(kw); return f
chk('B1 templat sah diterima', ins())
chk('B2 warna bukan #RRGGBB ditolak', not ins(fields_=mod(color='merah')))
chk('B3 font di luar daftar ditolak', not ins(fields_=mod(font='comicsans')))
chk('B4 kunci kembar atau berhuruf besar ditolak', not ins(fields_=[good[0], dict(good[1], key='date')]) and not ins(fields_=mod(key='Nama')))
chk('B5 kotak di luar 0-100 persen ditolak', not ins(fields_=mod(w=150)) and not ins(photo_={'x':-1,'y':0,'w':50,'h':50}))
chk('B6 lebih dari 8 kotak teks ditolak', not ins(fields_=[dict(good[0], key=f'k{i}') for i in range(9)]) and ins(fields_=[dict(good[0], key=f'k{i}') for i in range(8)]))
chk('B7 jumlah baris di luar 1-8 dan ukuran huruf di luar batas ditolak', not ins(fields_=mod(maxlines=9)) and not ins(fields_=mod(size=40)))
chk('B8 alamat gambar templat harus https:// atau assets/ (javascript: dan http: ditolak)', not ins(back='javascript:alert(1)') and not ins(back='http://x.co/a.jpg') and ins(back='https://x.co/a.jpg'))
chk('B9 ukuran templat di luar 300-4000 ditolak', not ins(w=100) and not ins(h=5000))
# ===== C. siapa boleh apa pada templat =====
S("update dq_templates set active=false where name='t'"); S("delete from dq_templates where name='t' and back_image <> 'https://x.co/a.jpg'")
S("insert into dq_templates(name,back_image,active,fields) values ('Nonaktif','assets/b.jpg',false,'[]')")
ok, n = P(None, "select count(*) from dq_templates", role='anon')
chk('C1 pengunjung hanya melihat templat aktif', ok and n == S1("select count(*) from dq_templates where active"), n)
ok, n2 = P(adm, "select count(*) from dq_templates"); chk('C2 admin melihat semua templat termasuk nonaktif', ok and n2 == S1("select count(*) from dq_templates"))
ok, e = P(emp, "insert into dq_templates(name,back_image) values ('x','assets/z.jpg')"); chk('C3 karyawan biasa tidak bisa menambah templat', not ok, e)
ok, e = P(None, "insert into dq_templates(name,back_image) values ('x','assets/z.jpg')", role='anon'); chk('C4 pengunjung tidak bisa menambah templat', not ok, e)
ok, e = P(adm, "insert into dq_templates(name,back_image) values ('baru admin','assets/z.jpg')"); chk('C5 admin bisa menambah templat', ok, e)
ok, e = P(emp, "update dq_settings set enabled=false"); chk('C6 karyawan biasa tidak bisa mengubah pengaturan; admin bisa', S1("select enabled from dq_settings") and P(adm, "update dq_settings set max_pending=50")[0] and S1("select max_pending from dq_settings")==50)
S("update dq_settings set max_pending=100")
# ===== D. pengiriman oleh pengunjung =====
ok, sid = sub(None, role='anon'); chk('D1 pengunjung tanpa login bisa mengirim: masuk antrean "pending"', ok and S1("select status from dq_submissions where id=%s", (sid,))=='pending', sid)
chk('D2 pengunjung TIDAK bisa melihat kiriman yang belum disetujui', P(None, "select count(*) from dq_submissions", role='anon')[1] == 0)
ok, e = P(None, "select token from dq_submissions", role='anon'); chk('D3 kolom pribadi (token, pengirim, user) tidak bisa dibaca pengunjung walau disetujui', not ok, e)
S("update dq_submissions set status='approved'"); ok, rows = P(None, "select count(*) from (select name, quote, image from dq_submissions) q", role='anon')
chk('D4 setelah disetujui, galeri (nama, kutipan, gambar) bisa dibaca pengunjung', ok and rows == 1, rows)
S("update dq_submissions set status='pending'")
ok, e = P(None, "insert into dq_submissions(image,token) values ('https://x/a.jpg','abcdefghijklmnop')", role='anon'); chk('D5 menulis langsung ke tabel kiriman ditolak (harus lewat dq_submit)', not ok, e)
ok, e = P(emp, "insert into dq_submissions(image,token) values ('https://x/a.jpg','abcdefghijklmnop')"); chk('D6 karyawan biasa pun tidak bisa menulis langsung', not ok, e)
ok, r = sub(None, n='p/261116/aaaaaaaaaa02.jpg', hp='http://spam', role='anon'); chk('D7 jebakan bot (isian tersembunyi terisi): tampak berhasil tetapi tidak ada yang tersimpan', ok and r is None and S1("select count(*) from dq_submissions")==1, r)
ok, e = sub(None, n='p/261116/aaaaaaaaaa03.jpg', tok='pendek', role='anon'); chk('D8 token tidak sah ditolak', not ok and 'tidak valid' in e, e)
ok, e = sub(None, n='p/261116/aaaaaaaaaa04.jpg', name='  ', role='anon'); chk('D9 nama kosong ditolak', not ok and 'wajib' in e, e)
ok, e = sub(None, n='p/261116/aaaaaaaaaa05.jpg', quote='x' * 401, role='anon'); chk('D10 kutipan lebih dari 400 huruf ditolak', not ok and 'panjang' in e, e)
ok, e = P(None, "select public.dq_submit(%s,%s,'a','b','c','d','e',%s,'')", (TPL, 'https://evil.com/a.jpg', TOK), role='anon'); chk('D11 gambar dari luar penyimpanan kita ditolak', not ok and 'tidak valid' in e, e)
ok, e = P(None, "select public.dq_submit(%s,%s,'a','b','c','d','e',%s,'')", (TPL, url('p/261116/../../x.jpg'), TOK), role='anon'); chk('D12 jalur gambar bertipe "../" ditolak', not ok, e)
ok, e = sub(None, n='p/261116/belumada0001.jpg', mk=False, role='anon'); chk('D13 gambar yang belum benar-benar terunggah ditolak', not ok and 'belum terunggah' in e, e)
ok, e = sub(None, n='p/261116/aaaaaaaaaa01.jpg', role='anon'); chk('D14 gambar yang sama tidak bisa dipakai dua kali', not ok, e)
ok, e = sub(None, n='p/261116/aaaaaaaaaa06.jpg', tpl='00000000-0000-0000-0000-000000000000', role='anon'); chk('D15 templat yang tidak ada ditolak', not ok and 'Templat' in e, e)
S("update dq_templates set active=false where id=%s", (TPL,)); ok, e = sub(None, n='p/261116/aaaaaaaaaa07.jpg', role='anon'); chk('D16 templat nonaktif ditolak', not ok, e); S("update dq_templates set active=true where id=%s", (TPL,))
ok, r = sub(None, n='p/261116/aaaaaaaaaa08.jpg', name='Ani\x07\x1b', quote='Halo\x1f dunia', role='anon'); row = S("select name, quote from dq_submissions where id=%s", (r,))[0] if ok else None
chk('D17 karakter kendali dibuang dari isian', ok and row == ('Ani', 'Halo dunia'), (ok, row))
# batas harian per token, antrean penuh
S("update dq_settings set per_token_daily=2"); ok, e = sub(None, n='p/261116/aaaaaaaaaa09.jpg', role='anon')
chk('D18 batas pengiriman per perangkat per hari (2 sudah terkirim, batas 2): ditolak dengan pesan jelas', not ok and 'Batas pengiriman' in e, e)
ok, r = sub(None, n='p/261116/aaaaaaaaaa10.jpg', tok='tokenlainlainlainlain', role='anon'); chk('D19 perangkat lain (token lain) tidak ikut terhalang', ok, r)
S("update dq_settings set per_token_daily=5, max_pending=%s", (S1("select count(*) from dq_submissions where status='pending'"),))
ok, e = sub(None, n='p/261116/aaaaaaaaaa11.jpg', tok='tokenketigaketigaket', role='anon'); chk('D20 antrean penuh (batas admin tercapai): ditolak dengan pesan jelas', not ok and 'penuh' in e, e)
S("update dq_settings set max_pending=100"); S("update dq_settings set enabled=false")
ok, e = sub(None, n='p/261116/aaaaaaaaaa12.jpg', tok='tokenkeempatkeempat', role='anon'); chk('D21 fitur dimatikan admin: pengiriman ditolak', not ok and 'dinonaktifkan' in e, e); S("update dq_settings set enabled=true")
# wajib login
S("update dq_settings set require_login=true")
ok, e = sub(None, n='p/261116/aaaaaaaaaa13.jpg', tok='tokenkelimakelimakeli', role='anon'); chk('D22 wajib login aktif: pengunjung tanpa akun ditolak', not ok and 'masuk' in e, e)
ok, e = sub(pend, n='p/261116/aaaaaaaaaa14.jpg', tok='tokenkeenamkeenamkee'); chk('D23 wajib login: akun yang belum disetujui admin ditolak', not ok, e)
ok, r = sub(emp, n='p/261116/aaaaaaaaaa15.jpg', tok='tokenketujuhketujuhke'); chk('D24 wajib login: karyawan yang sudah disetujui bisa mengirim; id akunnya tercatat', ok and str(S1("select user_id from dq_submissions where id=%s", (r,))) == str(emp), r)
S("update dq_settings set require_login=false")
# ===== E. peninjauan admin =====
sid = S1("select id::text from dq_submissions where status='pending' limit 1")
ok, e = P(emp, "update dq_submissions set status='approved' where id=%s", (sid,)); chk('E1 karyawan biasa tidak bisa menyetujui (0 baris berubah)', S1("select status from dq_submissions where id=%s", (sid,))=='pending')
ok, e = P(adm, "update dq_submissions set status='approved', reviewed_at=now(), reviewed_by=%s where id=%s", (adm, sid)); chk('E2 admin menyetujui; waktu dan peninjau tercatat', ok and (lambda x: x[0] == 'approved' and str(x[1]) == str(adm))(S("select status, reviewed_by from dq_submissions where id=%s", (sid,))[0]))
ok, e = P(adm, "update dq_submissions set status='rejected', reason=%s where id=%s", ('x'*301, sid)); chk('E3 alasan penolakan lebih dari 300 huruf ditolak', not ok, e)
ok, cnt = P(adm, "select public.dq_counts()"); chk('E4 jumlah per status untuk lencana admin', ok and cnt['approved'] == 1 and cnt['pending'] >= 2 and 'rejected' in cnt, cnt)
ok, e = P(emp, "select public.dq_counts()"); chk('E5 karyawan biasa tidak bisa membuka jumlah', not ok, e)
ok, rows = P(None, "select count(*) from dq_submissions", role='anon'); chk('E6 galeri publik hanya menampilkan yang disetujui (1)', ok and rows == 1, rows)
ok, e = P(adm, "delete from dq_submissions where id=%s", (sid,)); chk('E7 admin bisa menghapus kiriman', ok and S1("select count(*) from dq_submissions where id=%s", (sid,)) == 0)
# ===== F. kebijakan penyimpanan =====
ok, e = P(None, "insert into storage.objects(bucket_id,name) values ('dq-submissions','p/261116/anonupload001.jpg')", role='anon'); chk('F1 pengunjung boleh mengunggah ke folder p/ dengan nama yang benar', ok, e)
ok, e = P(None, "insert into storage.objects(bucket_id,name) values ('dq-submissions','lain/x.jpg')", role='anon'); chk('F2 unggah ke folder lain ditolak', not ok, e)
ok, e = P(None, "insert into storage.objects(bucket_id,name) values ('dq-submissions','p/261116/script0001.html')", role='anon'); chk('F3 ekstensi selain gambar ditolak', not ok, e)
ok, e = P(None, "insert into storage.objects(bucket_id,name) values ('site-media','p/261116/anonupload002.jpg')", role='anon'); chk('F4 pengunjung tidak bisa mengunggah ke bucket situs (site-media)', not ok, e)
ok, n = P(None, "select count(*) from storage.objects where bucket_id='dq-submissions'", role='anon'); chk('F5 pengunjung tidak bisa melihat daftar berkas kiriman', ok and n == 0, n)
ok, e = P(None, "delete from storage.objects where bucket_id='dq-submissions'", role='anon'); chk('F6 pengunjung tidak bisa menghapus berkas', S1("select count(*) from storage.objects where bucket_id='dq-submissions'") > 0)
ok, e = P(adm, "delete from storage.objects where name='p/261116/anonupload001.jpg'"); chk('F7 admin bisa melihat dan menghapus berkas kiriman', ok and S1("select count(*) from storage.objects where name='p/261116/anonupload001.jpg'") == 0)
print(f'TOTAL {OK} lulus, {BAD} gagal')
