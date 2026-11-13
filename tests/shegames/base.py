"""Dasar uji SHEGAMES: menyalakan Postgres sementara, meniru bagian Supabase (auth, peran, storage), lalu memuat schema.sql dan games.sql."""
import os, tempfile, pgserver, psycopg, json, re, sys, time
srv = pgserver.get_server(tempfile.mkdtemp(prefix='shegames-'), cleanup_mode='delete')
URI = srv.get_uri()
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'supabase')
STUB = """
drop schema if exists public cascade; create schema public;
drop schema if exists auth cascade; create schema auth;
drop schema if exists storage cascade; create schema storage;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth, storage to anon, authenticated;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
alter table storage.objects enable row level security;
grant all on all tables in schema storage to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
"""
OK = BAD = 0
def chk(name, cond, extra=''):
    global OK, BAD
    if cond: OK += 1; print('PASS', name)
    else: BAD += 1; print('FAIL', name, str(extra)[:400])
c = psycopg.connect(URI, autocommit=True)
def S(q, p=None):
    c.execute('reset role'); c.execute("select set_config('request.jwt.claim.sub','',false)")
    cur = c.execute(q, p)
    try: return cur.fetchall()
    except Exception: return []
def S1(q, p=None):
    r = S(q, p); return r[0][0] if r else None
def AS(uid, role='authenticated'):
    c.execute('reset role'); c.execute(f'set role {role}')
    c.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(uid) if uid else '',))
def P(uid, q, p=None, role='authenticated'):
    """jalankan sebagai pengguna; kembalikan (ok, hasil atau pesan galat)"""
    AS(uid, role)
    try:
        cur = c.execute(q, p)
        try: rows = cur.fetchall()
        except Exception: rows = []
        c.execute('reset role')
        return True, (rows[0][0] if len(rows) == 1 and len(rows[0]) == 1 else rows)
    except Exception as e:
        c.execute('reset role')
        return False, str(e).split('\n')[0]
def setup():
    c.execute(STUB)
    c.execute(open(f'{ROOT}/schema.sql', encoding='utf-8').read())
    c.execute(open(f'{ROOT}/games.sql', encoding='utf-8').read())
def mkuser(email, name, dept='', role='karyawan', status='approved'):
    uid = S1("insert into auth.users(email,raw_user_meta_data) values (%s,%s) returning id", (email, json.dumps({'full_name': name, 'department': dept, 'employee_id': 'N' + name})))
    S("update public.profiles set role=%s, status=%s where id=%s", (role, status, uid))
    return uid
