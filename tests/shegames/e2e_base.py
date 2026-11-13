"""Uji menyeluruh SHEGAMES: browser -> supabase-js -> PostgREST 12 -> Postgres 16 (games.sql asli)."""

import os, sys, json, time, hmac, hashlib, base64, subprocess, tempfile, socket, re
import pgserver, psycopg
from urllib.parse import urlparse, parse_qs
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SECRET = 'rahasia-uji-shegames-minimal-32-karakter!!'
FAKE = 'https://uji.supabase.co'
BASE = 'http://localhost:8769'
def b64(x): return base64.urlsafe_b64encode(x).rstrip(b'=').decode()
def jwt(payload):
    h = b64(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode()); p = b64(json.dumps(payload).encode())
    return f"{h}.{p}.{b64(hmac.new(SECRET.encode(), f'{h}.{p}'.encode(), hashlib.sha256).digest())}"
ANON = jwt({'role': 'anon', 'iss': 'uji', 'exp': int(time.time()) + 86400})
CFG = f"window.SHEDINO_CONFIG={{SUPABASE_URL:'{FAKE}',SUPABASE_ANON_KEY:'{ANON}'}};"
srv = pgserver.get_server(tempfile.mkdtemp(prefix='sg-e2e-'), cleanup_mode='delete')
URI = srv.get_uri()
db = psycopg.connect(URI, autocommit=True)
STUB = open(os.path.join(ROOT, 'tests', 'shegames', 'base.py'), encoding='utf-8').read()
STUB = STUB[STUB.index('STUB = """') + 10: STUB.index('"""', STUB.index('STUB = """') + 10)]
db.execute(STUB)
db.execute(open(f'{ROOT}/supabase/schema.sql', encoding='utf-8').read())
db.execute(open(f'{ROOT}/supabase/games.sql', encoding='utf-8').read())
def Q(q, p=None):
    cur = db.execute(q, p)
    try: return cur.fetchall()
    except Exception: return []
def Q1(q, p=None):
    r = Q(q, p); return r[0][0] if r else None
def mkuser(email, name, dept='', status='approved', role='karyawan'):
    uid = Q1("insert into auth.users(email,raw_user_meta_data) values (%s,%s) returning id", (email, json.dumps({'full_name': name, 'department': dept})))
    Q("update profiles set status=%s, role=%s where id=%s", (status, role, uid)); return str(uid)
# PostgREST
import atexit
_s = socket.socket(); _s.bind(('127.0.0.1', 0)); port = _s.getsockname()[1]; _s.close()
conf = tempfile.NamedTemporaryFile('w', suffix='.conf', delete=False)
conf.write(f'db-uri = "{URI}"\ndb-schemas = "public"\ndb-anon-role = "anon"\njwt-secret = "{SECRET}"\nserver-port = {port}\ndb-pool = 4\n'); conf.close()
PGRST = subprocess.Popen([os.environ.get('POSTGREST_BIN', 'postgrest'), conf.name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
atexit.register(lambda: PGRST.terminate())
for _ in range(80):
    try: socket.create_connection(('127.0.0.1', port), timeout=0.2).close(); break
    except OSError: time.sleep(0.1)
time.sleep(0.6)
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, prefer, x-client-info, accept-profile, content-profile, range, x-supabase-api-version',
        'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range'}
def auth_handler(route, request):
    if request.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    u = urlparse(request.url)
    if u.path.endswith('/token'):
        body = json.loads(request.post_data or '{}')
        row = Q("select u.id::text, u.email from auth.users u where u.email=%s", (body.get('email'),))
        if not row: return route.fulfill(status=400, headers=CORS, content_type='application/json', body=json.dumps({'error': 'invalid_grant', 'error_description': 'Invalid login credentials', 'msg': 'Invalid login credentials'}))
        uid, email = row[0]; now = int(time.time())
        user = {'id': uid, 'aud': 'authenticated', 'role': 'authenticated', 'email': email, 'user_metadata': {}, 'app_metadata': {}, 'created_at': '2026-01-01T00:00:00Z'}
        tok = jwt({'sub': uid, 'role': 'authenticated', 'aud': 'authenticated', 'email': email, 'iat': now, 'exp': now + 3600})
        return route.fulfill(status=200, headers=CORS, content_type='application/json', body=json.dumps({'access_token': tok, 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': now + 3600, 'refresh_token': 'r-' + uid, 'user': user}))
    if u.path.endswith('/user'):
        a = request.headers.get('authorization', '')[7:]
        try: sub = json.loads(base64.urlsafe_b64decode(a.split('.')[1] + '==')).get('sub')
        except Exception: sub = None
        row = Q("select id::text,email from auth.users where id::text=%s", (sub,)) if sub else []
        if not row: return route.fulfill(status=401, headers=CORS, body='{}')
        return route.fulfill(status=200, headers=CORS, content_type='application/json', body=json.dumps({'id': row[0][0], 'email': row[0][1], 'aud': 'authenticated', 'role': 'authenticated'}))
    if u.path.endswith('/logout'): return route.fulfill(status=204, headers=CORS)
    return route.fulfill(status=404, headers=CORS, body='{}')
def rest_handler(route, request):
    if request.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    u = urlparse(request.url)
    target = f'http://127.0.0.1:{port}' + u.path.replace('/rest/v1', '', 1) + (('?' + u.query) if u.query else '')
    resp = route.fetch(url=target)
    h = {k: v for k, v in resp.headers.items() if k.lower() not in ('access-control-allow-origin',)}
    h.update(CORS)
    route.fulfill(response=resp, headers=h)
def wire(page):
    page.route(BASE + '/config.js', lambda r, q: r.fulfill(status=200, content_type='application/javascript', body=CFG))
    page.route(FAKE + '/auth/v1/**', auth_handler)
    page.route(FAKE + '/rest/v1/**', rest_handler)
def login(page, email, nxt='shegames.html'):
    page.goto(f'{BASE}/masuk.html?next={nxt}'); page.fill('#in-email', email); page.fill('#in-pass', 'katasandi123')
    page.click('#f-in button[type=submit]'); page.wait_for_url('**/' + nxt.split('#')[0] + '**', timeout=8000)
OK = BAD = 0
def chk(n, c, extra=''):
    global OK, BAD
    if c: OK += 1; print('PASS', n)
    else: BAD += 1; print('FAIL', n, str(extra)[:400])
def done():
    PGRST.terminate(); print(f'TOTAL {OK} lulus, {BAD} gagal')
