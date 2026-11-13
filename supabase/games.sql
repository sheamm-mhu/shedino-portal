-- =====================================================================
-- SHEGAMES - tahap 1: data, skor, sesi, peringkat, dan admin (sisi server)
-- Jalankan SETELAH schema.sql. Aman dijalankan berulang (tidak menghapus data).
-- Semua perhitungan dan kunci jawaban ada di server: pemain tidak punya akses
-- langsung ke tabel soal, kunci, sesi, maupun percobaan; semuanya lewat fungsi.
-- =====================================================================

-- 0) Profil: departemen (NIK memakai kolom employee_id yang sudah ada)
alter table public.profiles add column if not exists department text not null default '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, employee_id, department)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'employee_id', ''),
    coalesce(new.raw_user_meta_data ->> 'department', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 1) Pengaturan (satu baris)
create table if not exists public.game_settings (
  id            int primary key default 1 check (id = 1),
  company       text not null default '',
  logo_url      text not null default '',
  departments   text[] not null default '{}',
  pass_score    int  not null default 60 check (pass_score between 0 and 100),
  max_attempts  int  not null default 0  check (max_attempts >= 0),
  sequential    boolean not null default true,
  rank_basis    text not null default 'score' check (rank_basis in ('score','level')),
  tiebreak      text not null default 'fast'  check (tiebreak in ('fast','slow')),
  active_levels int[] not null default '{1,2,3,4}',
  q_count       int  not null default 10 check (q_count between 1 and 100),
  timer_sign    int  not null default 15 check (timer_sign between 0 and 600),
  timer_mcq     int  not null default 20 check (timer_mcq between 0 and 600),
  hazard_time   int  not null default 120 check (hazard_time between 0 and 3600),
  hint_max      int  not null default 3 check (hint_max between 0 and 20),
  hint_penalty  int  not null default 5 check (hint_penalty between 0 and 100),
  tap_penalty   int  not null default 5 check (tap_penalty between 0 and 100),
  tz            text not null default 'Asia/Makassar',
  seeded        boolean not null default false,
  updated_at    timestamptz not null default now()
);
insert into public.game_settings (id) values (1) on conflict (id) do nothing;

-- 2) Konten. Pola draf: baris baru live=false; baris yang sudah tayang menyimpan
--    perubahan di "pending" sampai tombol Terbitkan (game_publish) ditekan.
create table if not exists public.game_words (
  id uuid primary key default gen_random_uuid(),
  word text not null check (word ~ '^[A-Z]{2,20}$'),
  clue text not null check (length(btrim(clue)) between 1 and 300),
  live boolean not null default false,
  pending jsonb,
  pending_op text check (pending_op in ('edit','delete')),
  created_at timestamptz not null default now()
);

create table if not exists public.game_signs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  category text not null check (category in ('Larangan','Peringatan','Wajib','Kondisi aman','Pemadam api')),
  meaning text not null default '' check (length(meaning) <= 500),
  image text not null check (length(image) between 1 and 500),
  live boolean not null default false,
  pending jsonb,
  pending_op text check (pending_op in ('edit','delete')),
  created_at timestamptz not null default now()
);

create table if not exists public.game_questions (
  id uuid primary key default gen_random_uuid(),
  q text not null check (length(btrim(q)) between 1 and 500),
  opts text[] not null,
  key int not null,
  expl text not null default '' check (length(expl) <= 600),
  live boolean not null default false,
  pending jsonb,
  pending_op text check (pending_op in ('edit','delete')),
  created_at timestamptz not null default now(),
  check (array_length(opts, 1) between 2 and 5 and key between 0 and array_length(opts, 1) - 1)
);

create table if not exists public.game_scenes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120),
  prompt text not null default '' check (length(prompt) <= 300),
  image text not null check (length(image) between 1 and 500),
  img_w int not null default 1200 check (img_w between 100 and 10000),
  img_h int not null default 800  check (img_h between 100 and 10000),
  points jsonb not null default '[]'::jsonb,
  live boolean not null default false,
  pending jsonb,
  pending_op text check (pending_op in ('edit','delete')),
  created_at timestamptz not null default now()
);

-- Tata letak TTS: grid = draf admin, live_grid = yang dipakai pemain (disalin saat Terbitkan)
create table if not exists public.game_layout (
  id int primary key default 1 check (id = 1),
  grid jsonb,
  live_grid jsonb,
  updated_at timestamptz not null default now()
);
insert into public.game_layout (id) values (1) on conflict (id) do nothing;

-- 3) Percobaan dan sesi (hanya diakses lewat fungsi)
create table if not exists public.game_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  level int not null check (level between 1 and 4),
  week date not null,
  status text not null default 'active' check (status in ('active','finished','expired')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms int,
  score numeric(5,2),
  passed boolean not null default false,
  total int,
  correct int,
  hints int not null default 0,
  wrong_taps int not null default 0,
  wrong_ids text[] not null default '{}'
);
create unique index if not exists game_one_active on public.game_attempts (user_id, level) where status = 'active';
create index if not exists game_attempts_week on public.game_attempts (week, level);
create index if not exists game_attempts_user on public.game_attempts (user_id, week, level);

create table if not exists public.game_sessions (
  attempt_id uuid primary key references public.game_attempts(id) on delete cascade,
  state jsonb not null default '{}'::jsonb
);

-- 4) RLS: pemain tidak punya akses langsung ke tabel mana pun (kecuali membaca pengaturan)
do $$
declare t text;
begin
  foreach t in array array['game_settings','game_words','game_signs','game_questions','game_scenes','game_layout','game_attempts','game_sessions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin kelola" on public.%I', t);
    execute format('create policy "admin kelola" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
drop policy if exists "baca pengaturan" on public.game_settings;
create policy "baca pengaturan" on public.game_settings for select to authenticated using (public.is_approved());

-- =====================================================================
-- 5) Fungsi bantu
-- =====================================================================
create or replace function public.game_require_user() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null or not public.is_approved() then
    raise exception 'Masuk dengan akun yang sudah disetujui untuk bermain.' using errcode = '42501';
  end if;
  return u;
end $$;

create or replace function public.game_require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null or not public.is_admin() then
    raise exception 'Hanya admin yang boleh melakukan ini.' using errcode = '42501';
  end if;
  return u;
end $$;

-- Awal minggu ISO (Senin) dalam zona waktu pengaturan
create or replace function public.game_week_start(p_ts timestamptz default now(), p_tz text default null) returns date
language sql stable set search_path = public as $$
  select date_trunc('week', p_ts at time zone coalesce(p_tz, (select tz from public.game_settings where id = 1), 'Asia/Makassar'))::date
$$;

-- Rumus skor: level 1 = % kata benar - penalti bantuan; level 2 dan 3 = % benar;
-- level 4 = % bahaya ditemukan - penalti salah ketuk. Minimum 0, maksimum 100.
create or replace function public.game_score(p_level int, p_correct int, p_total int, p_hints int default 0,
                                             p_wrong_taps int default 0, p_hint_pen int default 5, p_tap_pen int default 5) returns numeric
language sql immutable as $$
  select case when coalesce(p_total, 0) <= 0 then 0::numeric
    else round(greatest(0, least(100,
      100.0 * p_correct / p_total
      - case p_level when 1 then p_hint_pen * p_hints when 4 then p_tap_pen * p_wrong_taps else 0 end
    ))::numeric, 2) end
$$;

create or replace function public.game_now_ms() returns bigint language sql volatile as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint
$$;

create or replace function public.game_settings_public() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'company', company, 'logo_url', logo_url, 'departments', to_jsonb(departments),
    'pass_score', pass_score, 'max_attempts', max_attempts, 'sequential', sequential,
    'rank_basis', rank_basis, 'tiebreak', tiebreak, 'active_levels', to_jsonb(active_levels),
    'q_count', q_count, 'timer_sign', timer_sign, 'timer_mcq', timer_mcq, 'hazard_time', hazard_time,
    'hint_max', hint_max, 'hint_penalty', hint_penalty, 'tap_penalty', tap_penalty, 'tz', tz)
  from public.game_settings where id = 1
$$;

-- Apakah konten level tersedia (sudah terbit)?
create or replace function public.game_level_ready(p_level int) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_level
    when 1 then (select live_grid is not null and jsonb_typeof(live_grid -> 'items') = 'array' and jsonb_array_length(live_grid -> 'items') >= 4
                   and (select count(*) from jsonb_array_elements(live_grid -> 'items') it
                        join public.game_words w on w.id = (it ->> 'id')::uuid and w.live) = jsonb_array_length(live_grid -> 'items')
                 from public.game_layout where id = 1)
    when 2 then (select count(*) >= 4 from public.game_signs where live)
    when 3 then (select count(*) >= 3 from public.game_questions where live)
    when 4 then exists (select 1 from public.game_scenes where live and jsonb_array_length(points) >= 1)
    else false end
$$;

-- Level berikutnya terbuka setelah level aktif sebelumnya LULUS pada minggu yang sama
create or replace function public.game_level_unlocked(p_user uuid, p_level int, p_week date) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare s public.game_settings; prev int;
begin
  select * into s from public.game_settings where id = 1;
  if not s.sequential then return true; end if;
  -- level sebelumnya yang aktif DAN sudah punya konten; level tanpa konten tidak menghalangi
  select max(l) into prev from unnest(s.active_levels) l where l < p_level and public.game_level_ready(l);
  if prev is null then return true; end if;
  return exists (select 1 from public.game_attempts where user_id = p_user and level = prev and week = p_week and status = 'finished' and passed);
end $$;

-- Sesi yang dibiarkan lebih dari 2 jam dianggap hangus (tetap dihitung sebagai percobaan, skor 0)
create or replace function public.game_expire_stale(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.game_attempts set status = 'expired', finished_at = now(), score = 0, passed = false
  where user_id = p_user and status = 'active' and started_at < now() - interval '2 hours'
$$;

-- Huruf pada sel (baris, kolom) menurut tata letak yang tayang; null bila bukan sel kata
create or replace function public.game_cell_letter(p_row int, p_col int) returns text
language plpgsql stable security definer set search_path = public as $$
declare g jsonb; it jsonb; w text; r int; c int; dr int; dc int; k int;
begin
  select live_grid into g from public.game_layout where id = 1;
  if g is null then return null; end if;
  for it in select * from jsonb_array_elements(g -> 'items') loop
    select word into w from public.game_words where id = (it ->> 'id')::uuid;
    continue when w is null;
    r := (it ->> 'row')::int; c := (it ->> 'col')::int;
    if it ->> 'dir' = 'A' then
      if p_row = r and p_col >= c and p_col < c + length(w) then return substr(w, p_col - c + 1, 1); end if;
    else
      if p_col = c and p_row >= r and p_row < r + length(w) then return substr(w, p_row - r + 1, 1); end if;
    end if;
  end loop;
  return null;
end $$;

-- =====================================================================
-- 6) Menyusun data untuk pemain (TIDAK PERNAH memuat kunci jawaban)
-- =====================================================================
create or replace function public.game_payload(p_attempt uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.game_attempts; s public.game_settings; st jsonb; g jsonb; out jsonb;
begin
  select * into a from public.game_attempts where id = p_attempt;
  select * into s from public.game_settings where id = 1;
  select state into st from public.game_sessions where attempt_id = p_attempt;
  if a.level = 3 then
    out := jsonb_build_object('attempt_id', a.id, 'level', 3, 'total', jsonb_array_length(st -> 'items'),
      'timer', s.timer_mcq, 'next', (st ->> 'n_ans')::int,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object('id', q.id, 'q', q.q,
          'opts', (select jsonb_agg(q.opts[(o.v)::int + 1] order by o.n) from jsonb_array_elements_text(t.it -> 'order') with ordinality o(v, n))) order by t.n)
        from jsonb_array_elements(st -> 'items') with ordinality t(it, n)
        join public.game_questions q on q.id = (t.it ->> 'id')::uuid), '[]'::jsonb));
  elsif a.level = 2 then
    out := jsonb_build_object('attempt_id', a.id, 'level', 2, 'total', jsonb_array_length(st -> 'items'),
      'timer', s.timer_sign, 'next', (st ->> 'n_ans')::int,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object('id', sg.id, 'image', sg.image,
          'opts', (select jsonb_agg(o2.name order by o.n) from jsonb_array_elements_text(t.it -> 'opts') with ordinality o(v, n) join public.game_signs o2 on o2.id = o.v::uuid)) order by t.n)
        from jsonb_array_elements(st -> 'items') with ordinality t(it, n)
        join public.game_signs sg on sg.id = (t.it ->> 'id')::uuid), '[]'::jsonb));
  elsif a.level = 1 then
    select live_grid into g from public.game_layout where id = 1;
    out := jsonb_build_object('attempt_id', a.id, 'level', 1, 'rows', (g ->> 'rows')::int, 'cols', (g ->> 'cols')::int,
      'hint_max', s.hint_max, 'hint_penalty', s.hint_penalty, 'hints_used', a.hints,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object('num', (t.it ->> 'num')::int, 'dir', t.it ->> 'dir', 'row', (t.it ->> 'row')::int,
          'col', (t.it ->> 'col')::int, 'len', length(w.word), 'clue', w.clue) order by t.n)
        from jsonb_array_elements(g -> 'items') with ordinality t(it, n)
        join public.game_words w on w.id = (t.it ->> 'id')::uuid), '[]'::jsonb),
      'hinted', coalesce((
        select jsonb_agg(jsonb_build_object('row', split_part(h, ',', 1)::int, 'col', split_part(h, ',', 2)::int,
          'letter', public.game_cell_letter(split_part(h, ',', 1)::int, split_part(h, ',', 2)::int)))
        from jsonb_array_elements_text(st -> 'hints') h), '[]'::jsonb));
  else
    out := jsonb_build_object('attempt_id', a.id, 'level', 4, 'time_limit', s.hazard_time, 'tap_penalty', s.tap_penalty,
      'started_ms', (st ->> 'start_ms')::bigint, 'wrong', (st ->> 'wrong')::int,
      'found', coalesce((
        select jsonb_agg(jsonb_build_object('idx', f::int, 'x', (sc.points -> f::int ->> 'x')::numeric, 'y', (sc.points -> f::int ->> 'y')::numeric,
          'r', (sc.points -> f::int ->> 'r')::numeric, 'name', sc.points -> f::int ->> 'name',
          'risk', sc.points -> f::int ->> 'risk', 'control', sc.points -> f::int ->> 'control'))
        from jsonb_array_elements_text(st -> 'found') f), '[]'::jsonb),
      'total_points', jsonb_array_length(sc.points),
      'scene', jsonb_build_object('title', sc.title, 'prompt', sc.prompt, 'image', sc.image, 'w', sc.img_w, 'h', sc.img_h))
    from public.game_scenes sc where sc.id = (st ->> 'scene')::uuid;
  end if;
  return out || jsonb_build_object('started_at', a.started_at, 'pass_score', s.pass_score);
end $$;

-- =====================================================================
-- 7) Status pemain
-- =====================================================================
create or replace function public.game_my_status() returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public.game_require_user(); s public.game_settings; wk date; lv int; out jsonb := '[]'::jsonb;
begin
  select * into s from public.game_settings where id = 1;
  wk := public.game_week_start();
  perform public.game_expire_stale(u);
  foreach lv in array array[1,2,3,4] loop
    out := out || jsonb_build_array(jsonb_build_object(
      'level', lv,
      'active', lv = any(s.active_levels),
      'ready', public.game_level_ready(lv),
      'unlocked', public.game_level_unlocked(u, lv, wk),
      'attempts', (select count(*) from public.game_attempts where user_id = u and level = lv and week = wk),
      'best', (select max(score) from public.game_attempts where user_id = u and level = lv and week = wk and status = 'finished' and passed),
      'passed', exists (select 1 from public.game_attempts where user_id = u and level = lv and week = wk and status = 'finished' and passed),
      'active_attempt', (select id from public.game_attempts where user_id = u and level = lv and status = 'active' limit 1)));
  end loop;
  return jsonb_build_object('week', wk, 'week_label', to_char(wk, 'IYYY-"W"IW'),
    'today', (now() at time zone s.tz)::date,
    'profile', (select jsonb_build_object('full_name', full_name, 'department', department) from public.profiles where id = u),
    'settings', public.game_settings_public(), 'levels', out);
end $$;

-- Pemain mengisi departemennya sendiri (akun lama belum punya departemen)
create or replace function public.game_set_department(p_dept text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public.game_require_user(); s public.game_settings; d text := btrim(coalesce(p_dept, ''));
begin
  select * into s from public.game_settings where id = 1;
  if length(d) not between 1 and 60 then raise exception 'Pilih atau isi departemen (maksimal 60 karakter).'; end if;
  if coalesce(array_length(s.departments, 1), 0) > 0 and not (d = any(s.departments)) then raise exception 'Departemen tidak ada dalam daftar.'; end if;
  update public.profiles set department = d where id = u;
  return jsonb_build_object('department', d);
end $$;

-- =====================================================================
-- 8) Memulai sesi
-- =====================================================================
create or replace function public.game_start(p_level int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := public.game_require_user(); s public.game_settings; wk date := public.game_week_start();
  a public.game_attempts; n int; items jsonb := '[]'::jsonb; st jsonb; r record; scene uuid; ids uuid[];
begin
  select * into s from public.game_settings where id = 1;
  if p_level is null or p_level not between 1 and 4 then raise exception 'Level tidak dikenal.'; end if;
  if not (p_level = any(s.active_levels)) then raise exception 'Level ini sedang tidak aktif.'; end if;
  if not public.game_level_ready(p_level) then raise exception 'Level ini belum siap: soalnya belum diterbitkan.'; end if;
  perform public.game_expire_stale(u);

  -- satu sesi aktif per level: bila ada, lanjutkan (tidak menambah percobaan)
  select * into a from public.game_attempts where user_id = u and level = p_level and status = 'active';
  if found then return public.game_payload(a.id); end if;

  if not public.game_level_unlocked(u, p_level, wk) then
    raise exception 'Level ini terbuka setelah Anda lulus level sebelumnya pada minggu ini.';
  end if;
  if s.max_attempts > 0 and (select count(*) from public.game_attempts where user_id = u and level = p_level and week = wk) >= s.max_attempts then
    raise exception 'Batas percobaan level ini pada minggu ini sudah tercapai.';
  end if;

  begin
    insert into public.game_attempts (user_id, level, week) values (u, p_level, wk) returning * into a;
  exception when unique_violation then
    select * into a from public.game_attempts where user_id = u and level = p_level and status = 'active';
    return public.game_payload(a.id);
  end;

  if p_level = 3 then
    n := least(s.q_count, (select count(*) from public.game_questions where live));
    for r in select id, array_length(opts, 1) as k from public.game_questions where live order by random() limit n loop
      items := items || jsonb_build_array(jsonb_build_object('id', r.id,
        'order', (select to_jsonb(array_agg(i order by random())) from generate_series(0, r.k - 1) i), 'ans', null, 'ok', null));
    end loop;
    st := jsonb_build_object('items', items, 'n_ans', 0, 'last_ms', public.game_now_ms());
  elsif p_level = 2 then
    n := least(s.q_count, (select count(*) from public.game_signs where live));
    for r in select id, name, category from public.game_signs where live order by random() limit n loop
      ids := array[r.id] || array(select x.id from public.game_signs x where x.live and x.id <> r.id and lower(x.name) <> lower(r.name)
                                   order by (x.category = r.category) desc, random() limit 3);
      ids := array(select e from unnest(ids) e order by random());
      items := items || jsonb_build_array(jsonb_build_object('id', r.id, 'opts', to_jsonb(ids), 'ans', null, 'ok', null));
    end loop;
    st := jsonb_build_object('items', items, 'n_ans', 0, 'last_ms', public.game_now_ms());
  elsif p_level = 1 then
    st := jsonb_build_object('hints', '[]'::jsonb);
  else
    select sc.id into scene from public.game_scenes sc where sc.live and jsonb_array_length(sc.points) >= 1
      order by exists (select 1 from public.game_attempts aa join public.game_sessions ss on ss.attempt_id = aa.id
                       where aa.user_id = u and aa.level = 4 and ss.state ->> 'scene' = sc.id::text) asc, random() limit 1;
    st := jsonb_build_object('scene', scene, 'found', '[]'::jsonb, 'wrong', 0, 'start_ms', public.game_now_ms());
  end if;
  insert into public.game_sessions (attempt_id, state) values (a.id, st);
  return public.game_payload(a.id);
end $$;

-- =====================================================================
-- 9) Level 2 dan 3: menjawab satu soal. Server menilai dan mengembalikan penjelasan.
-- =====================================================================
create or replace function public.game_answer(p_attempt uuid, p_item int, p_choice int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := public.game_require_user(); a public.game_attempts; s public.game_settings; st jsonb; it jsonb;
  n_ans int; nopts int; timer int; elapsed bigint; tout boolean := false; ok boolean := false; ci int;
  q public.game_questions; sg public.game_signs; res jsonb; now_ms bigint := public.game_now_ms(); wid text;
begin
  select * into a from public.game_attempts where id = p_attempt and user_id = u for update;
  if not found then raise exception 'Percobaan tidak ditemukan.'; end if;
  if a.status <> 'active' then raise exception 'Percobaan ini sudah selesai.'; end if;
  if a.level not in (2, 3) then raise exception 'Level ini tidak memakai jawaban per soal.'; end if;
  select * into s from public.game_settings where id = 1;
  select state into st from public.game_sessions where attempt_id = a.id for update;
  n_ans := (st ->> 'n_ans')::int;
  if p_item is null or p_item <> n_ans then raise exception 'Jawab soal sesuai urutan.'; end if;
  it := st -> 'items' -> n_ans;
  if it is null then raise exception 'Semua soal sudah dijawab.'; end if;
  timer := case a.level when 3 then s.timer_mcq else s.timer_sign end;
  elapsed := now_ms - (st ->> 'last_ms')::bigint;
  nopts := jsonb_array_length(case when a.level = 3 then it -> 'order' else it -> 'opts' end);

  if p_choice is null or p_choice < 0 then tout := true;                              -- waktu habis / dilewati
  elsif p_choice >= nopts then raise exception 'Pilihan tidak valid.';
  elsif timer > 0 and elapsed > (timer + 5) * 1000 then tout := true;                   -- melewati batas waktu (toleransi 5 detik)
  end if;

  if a.level = 3 then
    select * into q from public.game_questions where id = (it ->> 'id')::uuid;
    select (o.n - 1)::int into ci from jsonb_array_elements_text(it -> 'order') with ordinality o(v, n) where o.v::int = q.key;
    if not tout then ok := (ci = p_choice); end if;
    res := jsonb_build_object('correct', ok, 'timed_out', tout, 'correct_index', ci, 'explanation', q.expl);
    wid := q.id::text;
  else
    select * into sg from public.game_signs where id = (it ->> 'id')::uuid;
    select (o.n - 1)::int into ci from jsonb_array_elements_text(it -> 'opts') with ordinality o(v, n) where o.v = sg.id::text;
    if not tout then ok := ((it -> 'opts' ->> p_choice) = sg.id::text); end if;
    res := jsonb_build_object('correct', ok, 'timed_out', tout, 'correct_index', ci, 'name', sg.name, 'meaning', sg.meaning);
    wid := sg.id::text;
  end if;

  st := jsonb_set(st, array['items', n_ans::text, 'ans'], to_jsonb(coalesce(p_choice, -1)));
  st := jsonb_set(st, array['items', n_ans::text, 'ok'], to_jsonb(ok));
  st := jsonb_set(st, '{n_ans}', to_jsonb(n_ans + 1));
  st := jsonb_set(st, '{last_ms}', to_jsonb(now_ms));
  update public.game_sessions set state = st where attempt_id = a.id;
  if not ok then update public.game_attempts set wrong_ids = wrong_ids || wid where id = a.id; end if;
  return res || jsonb_build_object('done', n_ans + 1 >= jsonb_array_length(st -> 'items'));
end $$;

-- =====================================================================
-- 10) Level 1: bantuan huruf (maks hint_max, dipotong poin per bantuan)
-- =====================================================================
create or replace function public.game_hint(p_attempt uuid, p_row int, p_col int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public.game_require_user(); a public.game_attempts; s public.game_settings; st jsonb; letter text; k text;
begin
  select * into a from public.game_attempts where id = p_attempt and user_id = u for update;
  if not found then raise exception 'Percobaan tidak ditemukan.'; end if;
  if a.status <> 'active' or a.level <> 1 then raise exception 'Bantuan huruf tidak tersedia.'; end if;
  select * into s from public.game_settings where id = 1;
  select state into st from public.game_sessions where attempt_id = a.id for update;
  letter := public.game_cell_letter(p_row, p_col);
  if letter is null then raise exception 'Kotak ini bukan bagian dari kata.'; end if;
  k := p_row::text || ',' || p_col::text;
  if (st -> 'hints') @> to_jsonb(k) then
    return jsonb_build_object('letter', letter, 'hints_used', a.hints, 'charged', false);
  end if;
  if a.hints >= s.hint_max then raise exception 'Bantuan huruf sudah habis.'; end if;
  update public.game_attempts set hints = hints + 1 where id = a.id;
  update public.game_sessions set state = jsonb_set(st, '{hints}', (st -> 'hints') || to_jsonb(k)) where attempt_id = a.id;
  return jsonb_build_object('letter', letter, 'hints_used', a.hints + 1, 'charged', true, 'penalty', s.hint_penalty);
end $$;

-- =====================================================================
-- 11) Level 4: ketuk titik bahaya. Hit-test lingkaran di ruang piksel (radius = % lebar gambar).
-- =====================================================================
create or replace function public.game_tap(p_attempt uuid, p_x numeric, p_y numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := public.game_require_user(); a public.game_attempts; s public.game_settings; st jsonb; sc public.game_scenes;
  idx int; pt jsonb; w int; total int; nfound int; dup boolean;
begin
  if p_x is null or p_y is null or p_x < 0 or p_x > 100 or p_y < 0 or p_y > 100 then raise exception 'Posisi ketukan tidak valid.'; end if;
  select * into a from public.game_attempts where id = p_attempt and user_id = u for update;
  if not found then raise exception 'Percobaan tidak ditemukan.'; end if;
  if a.status <> 'active' or a.level <> 4 then raise exception 'Ketukan tidak diterima.'; end if;
  select * into s from public.game_settings where id = 1;
  select state into st from public.game_sessions where attempt_id = a.id for update;
  if s.hazard_time > 0 and public.game_now_ms() - (st ->> 'start_ms')::bigint > (s.hazard_time + 5) * 1000 then
    return jsonb_build_object('expired', true);
  end if;
  select * into sc from public.game_scenes where id = (st ->> 'scene')::uuid;
  total := jsonb_array_length(sc.points);

  select t.i - 1 into idx
  from jsonb_array_elements(sc.points) with ordinality t(pt, i)
  where not ((st -> 'found') @> to_jsonb((t.i - 1)::int))
    and sqrt(power((p_x - (t.pt ->> 'x')::numeric) * sc.img_w / 100.0, 2) + power((p_y - (t.pt ->> 'y')::numeric) * sc.img_h / 100.0, 2))
        <= (t.pt ->> 'r')::numeric * sc.img_w / 100.0
  order by sqrt(power((p_x - (t.pt ->> 'x')::numeric) * sc.img_w / 100.0, 2) + power((p_y - (t.pt ->> 'y')::numeric) * sc.img_h / 100.0, 2))
  limit 1;

  if idx is not null then
    pt := sc.points -> idx;
    st := jsonb_set(st, '{found}', (st -> 'found') || to_jsonb(idx));
    update public.game_sessions set state = st where attempt_id = a.id;
    nfound := jsonb_array_length(st -> 'found');
    return jsonb_build_object('hit', true, 'idx', idx, 'name', pt ->> 'name', 'risk', pt ->> 'risk', 'control', pt ->> 'control',
      'x', (pt ->> 'x')::numeric, 'y', (pt ->> 'y')::numeric, 'r', (pt ->> 'r')::numeric,
      'found', nfound, 'total', total, 'done', nfound >= total);
  end if;

  -- mengetuk titik yang sudah ditemukan: tidak dihukum
  select exists (
    select 1 from jsonb_array_elements(sc.points) with ordinality t(pt, i)
    where (st -> 'found') @> to_jsonb((t.i - 1)::int)
      and sqrt(power((p_x - (t.pt ->> 'x')::numeric) * sc.img_w / 100.0, 2) + power((p_y - (t.pt ->> 'y')::numeric) * sc.img_h / 100.0, 2))
          <= (t.pt ->> 'r')::numeric * sc.img_w / 100.0) into dup;
  if dup then return jsonb_build_object('hit', false, 'dup', true, 'wrong', (st ->> 'wrong')::int); end if;

  st := jsonb_set(st, '{wrong}', to_jsonb((st ->> 'wrong')::int + 1));
  update public.game_sessions set state = st where attempt_id = a.id;
  update public.game_attempts set wrong_taps = (st ->> 'wrong')::int where id = a.id;
  return jsonb_build_object('hit', false, 'wrong', (st ->> 'wrong')::int, 'penalty', s.tap_penalty);
end $$;

-- =====================================================================
-- 12) Menyelesaikan sesi: skor dihitung SERVER. Level 1 mengirim jawaban {"1A":"KATA", ...}.
-- =====================================================================
create or replace function public.game_finish(p_attempt uuid, p_answers jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := public.game_require_user(); a public.game_attempts; s public.game_settings; st jsonb; g jsonb; sc public.game_scenes;
  n_total int := 0; n_correct int := 0; wrong text[] := '{}'; reveal jsonb := '[]'::jsonb; sc_ numeric; pass boolean; dur int; res jsonb;
  it jsonb; w public.game_words; given text; ok boolean; f jsonb; i int; best numeric;
begin
  select * into a from public.game_attempts where id = p_attempt and user_id = u for update;
  if not found then raise exception 'Percobaan tidak ditemukan.'; end if;
  select * into s from public.game_settings where id = 1;
  select state into st from public.game_sessions where attempt_id = a.id for update;
  if a.status = 'finished' then return st -> 'result'; end if;
  if a.status = 'expired' or a.started_at < now() - interval '2 hours' then
    update public.game_attempts set status = 'expired', finished_at = now(), score = 0, passed = false where id = a.id and status = 'active';
    raise exception 'Waktu percobaan ini sudah habis (lebih dari 2 jam).';
  end if;

  if a.level in (2, 3) then
    n_total := jsonb_array_length(st -> 'items');
    select count(*) filter (where (e ->> 'ok')::boolean is true) into n_correct from jsonb_array_elements(st -> 'items') e;
    -- soal yang belum dijawab dihitung salah
    wrong := a.wrong_ids || array(select e ->> 'id' from jsonb_array_elements(st -> 'items') e where (e -> 'ans') = 'null'::jsonb);
  elsif a.level = 1 then
    select live_grid into g from public.game_layout where id = 1;
    for it in select * from jsonb_array_elements(g -> 'items') loop
      select * into w from public.game_words where id = (it ->> 'id')::uuid;
      n_total := n_total + 1;
      given := upper(btrim(coalesce(p_answers ->> ((it ->> 'num') || (it ->> 'dir')), '')));
      ok := given = w.word;
      if ok then n_correct := n_correct + 1; else wrong := wrong || w.id::text; end if;
      reveal := reveal || jsonb_build_array(jsonb_build_object('num', (it ->> 'num')::int, 'dir', it ->> 'dir',
        'row', (it ->> 'row')::int, 'col', (it ->> 'col')::int, 'word', w.word, 'clue', w.clue, 'correct', ok));
    end loop;
  else
    select * into sc from public.game_scenes where id = (st ->> 'scene')::uuid;
    n_total := jsonb_array_length(sc.points);
    n_correct := jsonb_array_length(st -> 'found');
    for i in 0 .. n_total - 1 loop
      f := sc.points -> i;
      ok := (st -> 'found') @> to_jsonb(i);
      if not ok then wrong := wrong || (sc.id::text || ':' || i::text); end if;
      reveal := reveal || jsonb_build_array(jsonb_build_object('idx', i, 'x', (f ->> 'x')::numeric, 'y', (f ->> 'y')::numeric,
        'r', (f ->> 'r')::numeric, 'name', f ->> 'name', 'risk', f ->> 'risk', 'control', f ->> 'control', 'found', ok));
    end loop;
    a.wrong_taps := (st ->> 'wrong')::int;
  end if;

  sc_ := public.game_score(a.level, n_correct, n_total, a.hints, a.wrong_taps, s.hint_penalty, s.tap_penalty);
  pass := sc_ >= s.pass_score;
  dur := least(7200000, (extract(epoch from (clock_timestamp() - a.started_at)) * 1000)::bigint)::int;
  update public.game_attempts set status = 'finished', finished_at = now(), duration_ms = dur, score = sc_, passed = pass,
    total = n_total, correct = n_correct, wrong_ids = wrong, wrong_taps = a.wrong_taps where id = a.id;
  select max(score) into best from public.game_attempts
    where user_id = u and level = a.level and week = a.week and status = 'finished' and passed;
  res := jsonb_build_object('level', a.level, 'score', sc_, 'passed', pass, 'pass_score', s.pass_score, 'correct', n_correct, 'total', n_total,
    'hints', a.hints, 'wrong_taps', a.wrong_taps, 'duration_ms', dur, 'week', a.week, 'best_week', best, 'reveal', reveal);
  update public.game_sessions set state = jsonb_set(st, '{result}', res) where attempt_id = a.id;
  return res;
end $$;

-- =====================================================================
-- 13) Peringkat. Hanya skor LULUS yang dihitung (terbaik per level). Seri: level tertinggi / waktu.
-- =====================================================================
drop function if exists public.game_leaderboard(date, text, boolean);
create or replace function public.game_leaderboard(p_week date default null, p_dept text default null, p_all boolean default false, p_month date default null)
returns table (rank int, user_id uuid, full_name text, department text, is_me boolean, passed_levels int, top_level int,
               s1 numeric, s2 numeric, s3 numeric, s4 numeric, total numeric, time_ms bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare s public.game_settings; wk date; me uuid;
begin
  me := public.game_require_user();
  select * into s from public.game_settings where id = 1;
  wk := coalesce(p_week, public.game_week_start());
  return query
  with best as (
    select distinct on (a.user_id, a.level) a.user_id, a.level, a.score, a.duration_ms
    from public.game_attempts a
    where a.status = 'finished' and a.passed and a.level = any(s.active_levels)
      and (p_all
           or (p_month is not null and date_trunc('month', a.finished_at at time zone s.tz)::date = date_trunc('month', p_month)::date)
           or (p_month is null and a.week = wk))
    order by a.user_id, a.level, a.score desc, a.duration_ms asc
  ), agg as (
    select b.user_id, count(*)::int as passed_levels, max(b.level)::int as top_level,
      max(b.score) filter (where b.level = 1) as s1, max(b.score) filter (where b.level = 2) as s2,
      max(b.score) filter (where b.level = 3) as s3, max(b.score) filter (where b.level = 4) as s4,
      sum(b.score) as total, sum(b.duration_ms)::bigint as time_ms
    from best b group by b.user_id
  ), joined as (
    select agg.*, p.full_name, p.department
    from agg join public.profiles p on p.id = agg.user_id
    where coalesce(p_dept, '') = '' or p.department = p_dept
  ), ranked as (
    select j.*, rank() over (order by
      (case when s.rank_basis = 'score' then j.total else j.top_level::numeric end) desc,
      (case when s.rank_basis = 'score' then j.top_level::numeric else j.total end) desc,
      (case when s.tiebreak = 'fast' then j.time_ms else -j.time_ms end) asc) as rk
    from joined j
  )
  select r.rk::int, r.user_id, r.full_name, r.department, (r.user_id = me), r.passed_levels, r.top_level,
         r.s1, r.s2, r.s3, r.s4, r.total, r.time_ms
  from ranked r order by r.rk, r.full_name;
end $$;

-- =====================================================================
-- 14) Admin: konten berbentuk draf, divalidasi, lalu diterbitkan
-- =====================================================================
create or replace function public.game_safe_url(u text) returns boolean
language sql immutable as $$ select coalesce(u, '') ~* '^(https?://|assets/|/)[^\s"''<>]*$' $$;

-- Hasil akhir bila semua perubahan diterbitkan (baris baru ikut, baris yang dihapus tidak)
create or replace function public.game_res_words() returns table (id uuid, word text, clue text)
language sql stable security definer set search_path = public as $$
  select w.id, coalesce(w.pending ->> 'word', w.word), coalesce(w.pending ->> 'clue', w.clue)
  from public.game_words w where coalesce(w.pending_op, '') <> 'delete'
$$;
create or replace function public.game_res_signs() returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select s.id, coalesce(s.pending ->> 'name', s.name) from public.game_signs s where coalesce(s.pending_op, '') <> 'delete'
$$;
create or replace function public.game_res_questions() returns table (id uuid)
language sql stable security definer set search_path = public as $$
  select q.id from public.game_questions q where coalesce(q.pending_op, '') <> 'delete'
$$;
create or replace function public.game_res_scenes() returns table (id uuid, title text, npoints int)
language sql stable security definer set search_path = public as $$
  select s.id, coalesce(s.pending ->> 'title', s.title),
         jsonb_array_length(case when s.pending is not null and s.pending ? 'points' then s.pending -> 'points' else s.points end)
  from public.game_scenes s where coalesce(s.pending_op, '') <> 'delete'
$$;

-- Memeriksa dan merapikan satu butir. Mengembalikan data yang sudah bersih.
create or replace function public.game_norm_item(p_kind text, p_data jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  w text; c text; q text; ex text; nm text; cat text; mean text; img text; ttl text; prm text; arr text[] := '{}'; o text; k int;
  pts jsonb := '[]'::jsonb; pt jsonb; x text; y text; r text; iw int := 1200; ih int := 800;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Data tidak valid.'; end if;
  if p_kind = 'word' then
    w := upper(regexp_replace(coalesce(p_data ->> 'word', ''), '\s+', '', 'g'));
    if w !~ '^[A-Z]{2,20}$' then raise exception 'Kata hanya boleh berisi huruf A-Z, 2 sampai 20 huruf (spasi dibuang).'; end if;
    c := btrim(coalesce(p_data ->> 'clue', ''));
    if length(c) not between 1 and 300 then raise exception 'Petunjuk wajib diisi (maksimal 300 karakter).'; end if;
    return jsonb_build_object('word', w, 'clue', c);
  elsif p_kind = 'sign' then
    nm := btrim(coalesce(p_data ->> 'name', '')); cat := coalesce(p_data ->> 'category', ''); mean := btrim(coalesce(p_data ->> 'meaning', '')); img := btrim(coalesce(p_data ->> 'image', ''));
    if length(nm) not between 1 and 80 then raise exception 'Nama rambu wajib diisi (maksimal 80 karakter).'; end if;
    if cat not in ('Larangan','Peringatan','Wajib','Kondisi aman','Pemadam api') then raise exception 'Kategori rambu tidak dikenal.'; end if;
    if length(mean) > 500 then raise exception 'Arti rambu maksimal 500 karakter.'; end if;
    if not public.game_safe_url(img) then raise exception 'Alamat gambar rambu tidak valid (harus http, https, atau jalur situs; tanpa spasi).'; end if;
    return jsonb_build_object('name', nm, 'category', cat, 'meaning', mean, 'image', img);
  elsif p_kind = 'question' then
    q := btrim(coalesce(p_data ->> 'q', '')); ex := btrim(coalesce(p_data ->> 'expl', ''));
    if length(q) not between 1 and 500 then raise exception 'Soal wajib diisi (maksimal 500 karakter).'; end if;
    if length(ex) > 600 then raise exception 'Penjelasan maksimal 600 karakter.'; end if;
    if jsonb_typeof(p_data -> 'opts') <> 'array' then raise exception 'Pilihan jawaban tidak valid.'; end if;
    for o in select btrim(v) from jsonb_array_elements_text(p_data -> 'opts') v loop
      if length(o) not between 1 and 200 then raise exception 'Setiap pilihan wajib diisi (maksimal 200 karakter).'; end if;
      if lower(o) = any(select lower(z) from unnest(arr) z) then raise exception 'Pilihan jawaban tidak boleh kembar.'; end if;
      arr := arr || o;
    end loop;
    if coalesce(array_length(arr, 1), 0) not between 2 and 5 then raise exception 'Soal harus punya 2 sampai 5 pilihan.'; end if;
    if coalesce(p_data ->> 'key', '') !~ '^[0-9]+$' or (p_data ->> 'key')::int >= array_length(arr, 1) then raise exception 'Kunci jawaban belum dipilih atau di luar daftar pilihan.'; end if;
    return jsonb_build_object('q', q, 'opts', to_jsonb(arr), 'key', (p_data ->> 'key')::int, 'expl', ex);
  elsif p_kind = 'scene' then
    ttl := btrim(coalesce(p_data ->> 'title', '')); prm := btrim(coalesce(p_data ->> 'prompt', '')); img := btrim(coalesce(p_data ->> 'image', ''));
    if length(ttl) not between 1 and 120 then raise exception 'Judul foto wajib diisi (maksimal 120 karakter).'; end if;
    if length(prm) > 300 then raise exception 'Perintah maksimal 300 karakter.'; end if;
    if not public.game_safe_url(img) then raise exception 'Alamat foto tidak valid (harus http, https, atau jalur situs; tanpa spasi).'; end if;
    if coalesce(p_data ->> 'img_w', '1200') !~ '^[0-9]+$' or coalesce(p_data ->> 'img_h', '800') !~ '^[0-9]+$' then raise exception 'Ukuran foto tidak valid.'; end if;
    iw := coalesce(p_data ->> 'img_w', '1200')::int; ih := coalesce(p_data ->> 'img_h', '800')::int;
    if iw not between 100 and 10000 or ih not between 100 and 10000 then raise exception 'Ukuran foto harus 100 sampai 10000 piksel.'; end if;
    if p_data ? 'points' then
      if jsonb_typeof(p_data -> 'points') <> 'array' or jsonb_array_length(p_data -> 'points') > 40 then raise exception 'Titik bahaya tidak valid (maksimal 40).'; end if;
      for pt in select * from jsonb_array_elements(p_data -> 'points') loop
        x := pt ->> 'x'; y := pt ->> 'y'; r := pt ->> 'r'; nm := btrim(coalesce(pt ->> 'name', ''));
        if coalesce(x, '') !~ '^[0-9]+(\.[0-9]+)?$' or coalesce(y, '') !~ '^[0-9]+(\.[0-9]+)?$' or x::numeric > 100 or y::numeric > 100 then raise exception 'Posisi titik bahaya harus 0 sampai 100 persen.'; end if;
        if coalesce(r, '') !~ '^[0-9]+(\.[0-9]+)?$' or r::numeric < 1 or r::numeric > 50 then raise exception 'Ukuran area ketuk harus 1 sampai 50 persen lebar gambar.'; end if;
        if length(nm) not between 1 and 120 then raise exception 'Nama bahaya wajib diisi (maksimal 120 karakter).'; end if;
        if length(coalesce(pt ->> 'risk', '')) > 300 or length(coalesce(pt ->> 'control', '')) > 300 then raise exception 'Risiko dan pengendalian maksimal 300 karakter.'; end if;
        pts := pts || jsonb_build_array(jsonb_build_object('x', x::numeric, 'y', y::numeric, 'r', r::numeric, 'name', nm,
                 'risk', btrim(coalesce(pt ->> 'risk', '')), 'control', btrim(coalesce(pt ->> 'control', ''))));
      end loop;
    end if;
    return jsonb_build_object('title', ttl, 'prompt', prm, 'image', img, 'img_w', iw, 'img_h', ih, 'points', pts);
  end if;
  raise exception 'Jenis butir tidak dikenal.';
end $$;

create or replace function public.game_admin_save_item(p_kind text, p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare d jsonb; rid uuid := p_id; lv boolean;
begin
  perform public.game_require_admin();
  d := public.game_norm_item(p_kind, p_data);
  if p_kind = 'word' then
    if p_id is null then insert into public.game_words (word, clue) values (d ->> 'word', d ->> 'clue') returning id into rid;
    else
      select live into lv from public.game_words where id = p_id for update;
      if not found then raise exception 'Butir tidak ditemukan.'; end if;
      if lv then update public.game_words set pending = d, pending_op = 'edit' where id = p_id;
      else update public.game_words set word = d ->> 'word', clue = d ->> 'clue' where id = p_id; end if;
    end if;
  elsif p_kind = 'sign' then
    if p_id is null then insert into public.game_signs (name, category, meaning, image) values (d ->> 'name', d ->> 'category', d ->> 'meaning', d ->> 'image') returning id into rid;
    else
      select live into lv from public.game_signs where id = p_id for update;
      if not found then raise exception 'Butir tidak ditemukan.'; end if;
      if lv then update public.game_signs set pending = d, pending_op = 'edit' where id = p_id;
      else update public.game_signs set name = d ->> 'name', category = d ->> 'category', meaning = d ->> 'meaning', image = d ->> 'image' where id = p_id; end if;
    end if;
  elsif p_kind = 'question' then
    if p_id is null then insert into public.game_questions (q, opts, key, expl) values (d ->> 'q', array(select jsonb_array_elements_text(d -> 'opts')), (d ->> 'key')::int, d ->> 'expl') returning id into rid;
    else
      select live into lv from public.game_questions where id = p_id for update;
      if not found then raise exception 'Butir tidak ditemukan.'; end if;
      if lv then update public.game_questions set pending = d, pending_op = 'edit' where id = p_id;
      else update public.game_questions set q = d ->> 'q', opts = array(select jsonb_array_elements_text(d -> 'opts')), key = (d ->> 'key')::int, expl = d ->> 'expl' where id = p_id; end if;
    end if;
  else
    if p_id is null then insert into public.game_scenes (title, prompt, image, img_w, img_h, points) values (d ->> 'title', d ->> 'prompt', d ->> 'image', (d ->> 'img_w')::int, (d ->> 'img_h')::int, d -> 'points') returning id into rid;
    else
      select live into lv from public.game_scenes where id = p_id for update;
      if not found then raise exception 'Butir tidak ditemukan.'; end if;
      if lv then update public.game_scenes set pending = d, pending_op = 'edit' where id = p_id;
      else update public.game_scenes set title = d ->> 'title', prompt = d ->> 'prompt', image = d ->> 'image', img_w = (d ->> 'img_w')::int, img_h = (d ->> 'img_h')::int, points = d -> 'points' where id = p_id; end if;
    end if;
  end if;
  return rid;
end $$;

create or replace function public.game_admin_delete_item(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  perform public.game_require_admin();
  t := case p_kind when 'word' then 'game_words' when 'sign' then 'game_signs' when 'question' then 'game_questions' when 'scene' then 'game_scenes' end;
  if t is null then raise exception 'Jenis butir tidak dikenal.'; end if;
  -- butir yang sudah tayang hanya ditandai hapus sampai diterbitkan; butir draf langsung dihapus
  execute format('update public.%I set pending_op = ''delete'', pending = null where id = $1 and live', t) using p_id;
  execute format('delete from public.%I where id = $1 and not live', t) using p_id;
end $$;

-- Memeriksa tata letak TTS terhadap kata-kata (hasil akhir): batas kotak, huruf bertabrakan,
-- kata sejenis bertumpuk, huruf bersebelahan yang membentuk kata tak sengaja, penomoran.
create or replace function public.game_check_layout(p_grid jsonb, p_exact boolean default false) returns void
language plpgsql stable security definer set search_path = public as $$
declare
  R int; C int; it jsonb; wid uuid; w text; dr int; dc int; rr int; cc int; k int; idx int; ch text; n int := 0;
  cell text[]; aw int[]; dw int[]; seen uuid[] := '{}'; wmap jsonb; starts jsonb := '{}'::jsonb; nums jsonb := '{}'::jsonb; key text; num int; total int;
begin
  if p_grid is null or jsonb_typeof(p_grid) <> 'object' then raise exception 'Tata letak teka-teki silang belum dibuat.'; end if;
  if coalesce(p_grid ->> 'rows', '') !~ '^[0-9]+$' or coalesce(p_grid ->> 'cols', '') !~ '^[0-9]+$' then raise exception 'Ukuran kotak tidak valid.'; end if;
  R := (p_grid ->> 'rows')::int; C := (p_grid ->> 'cols')::int;
  if R not between 1 and 40 or C not between 1 and 40 then raise exception 'Ukuran kotak harus 1 sampai 40.'; end if;
  if jsonb_typeof(p_grid -> 'items') <> 'array' or jsonb_array_length(p_grid -> 'items') < 1 then raise exception 'Tata letak belum memuat kata.'; end if;
  select coalesce(jsonb_object_agg(id::text, word), '{}'::jsonb) into wmap from public.game_res_words();
  cell := array_fill(''::text, array[R * C]); aw := array_fill(0, array[R * C]); dw := array_fill(0, array[R * C]);
  for it in select * from jsonb_array_elements(p_grid -> 'items') loop
    n := n + 1;
    begin wid := (it ->> 'id')::uuid; exception when others then raise exception 'Id kata ke-% pada tata letak tidak valid.', n; end;
    w := wmap ->> wid::text;
    if w is null then raise exception 'Tata letak memuat kata yang tidak ada atau sudah dihapus.'; end if;
    if wid = any(seen) then raise exception 'Kata "%" muncul lebih dari sekali pada tata letak.', w; end if;
    seen := seen || wid;
    if coalesce(it ->> 'dir', '') not in ('A', 'D') then raise exception 'Arah kata "%" harus A (mendatar) atau D (menurun).', w; end if;
    if coalesce(it ->> 'row', '') !~ '^[0-9]+$' or coalesce(it ->> 'col', '') !~ '^[0-9]+$' or coalesce(it ->> 'num', '') !~ '^[0-9]+$' then raise exception 'Posisi atau nomor kata "%" tidak valid.', w; end if;
    dr := case when it ->> 'dir' = 'D' then 1 else 0 end; dc := 1 - dr;
    rr := (it ->> 'row')::int; cc := (it ->> 'col')::int; num := (it ->> 'num')::int;
    if rr + dr * (length(w) - 1) >= R or cc + dc * (length(w) - 1) >= C then raise exception 'Kata "%" keluar dari kotak.', w; end if;
    for k in 0 .. length(w) - 1 loop
      idx := (rr + dr * k) * C + (cc + dc * k) + 1; ch := substr(w, k + 1, 1);
      if cell[idx] <> '' and cell[idx] <> ch then raise exception 'Huruf bertabrakan pada baris %, kolom % (kata "%").', rr + dr * k + 1, cc + dc * k + 1, w; end if;
      cell[idx] := ch;
      if dr = 0 then
        if aw[idx] <> 0 then raise exception 'Dua kata mendatar saling tumpang tindih pada baris %.', rr + 1; end if;
        aw[idx] := n;
      else
        if dw[idx] <> 0 then raise exception 'Dua kata menurun saling tumpang tindih pada kolom %.', cc + 1; end if;
        dw[idx] := n;
      end if;
    end loop;
    key := rr::text || ',' || cc::text;
    if starts ? key and (starts ->> key)::int <> num then raise exception 'Nomor kotak awal tidak konsisten pada baris %, kolom %.', rr + 1, cc + 1; end if;
    starts := jsonb_set(starts, array[key], to_jsonb(num));
    if nums ? num::text and nums ->> num::text <> key then raise exception 'Nomor % dipakai oleh dua kotak awal yang berbeda.', num; end if;
    nums := jsonb_set(nums, array[num::text], to_jsonb(key));
  end loop;
  for rr in 0 .. R - 1 loop
    for cc in 0 .. C - 1 loop
      idx := rr * C + cc + 1;
      continue when cell[idx] = '';
      if cc + 1 < C and cell[idx + 1] <> '' and (aw[idx] = 0 or aw[idx + 1] = 0 or aw[idx] <> aw[idx + 1]) then
        raise exception 'Huruf bersebelahan membentuk kata tak disengaja pada baris %, kolom %.', rr + 1, cc + 1;
      end if;
      if rr + 1 < R and cell[idx + C] <> '' and (dw[idx] = 0 or dw[idx + C] = 0 or dw[idx] <> dw[idx + C]) then
        raise exception 'Huruf bertumpuk membentuk kata tak disengaja pada baris %, kolom %.', rr + 1, cc + 1;
      end if;
    end loop;
  end loop;
  if p_exact then
    select count(*) into total from public.game_res_words();
    if n <> total then raise exception 'Tata letak harus memuat semua kata (% dari % kata).', n, total; end if;
  end if;
end $$;

create or replace function public.game_admin_save_layout(p_grid jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.game_require_admin();
  perform public.game_check_layout(p_grid, false);
  update public.game_layout set grid = p_grid, updated_at = now() where id = 1;
end $$;

-- Terbitkan: validasi dulu, lalu semua perubahan berlaku sekaligus
create or replace function public.game_publish() returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.game_settings; errs text[] := '{}'; n int; g jsonb; bad record; res jsonb;
begin
  perform public.game_require_admin();
  select * into s from public.game_settings where id = 1;
  if 1 = any(s.active_levels) then
    select count(*) into n from public.game_res_words();
    if n < 4 then errs := errs || format('Teka-teki silang: minimal 4 kata (sekarang %s).', n); end if;
    if exists (select 1 from public.game_res_words() group by word having count(*) > 1) then errs := array_append(errs, 'Teka-teki silang: ada kata yang kembar.'::text); end if;
    select grid into g from public.game_layout where id = 1;
    if g is null then errs := array_append(errs, 'Teka-teki silang: tata letak belum dibuat.'::text);
    else begin perform public.game_check_layout(g, true); exception when others then errs := errs || ('Teka-teki silang: ' || sqlerrm); end; end if;
  end if;
  if 2 = any(s.active_levels) then
    select count(*) into n from public.game_res_signs();
    if n < 4 then errs := errs || format('Tebak rambu: minimal 4 rambu (sekarang %s).', n); end if;
    if exists (select 1 from public.game_res_signs() group by lower(name) having count(*) > 1) then errs := array_append(errs, 'Tebak rambu: ada nama rambu yang kembar.'::text); end if;
  end if;
  if 3 = any(s.active_levels) then
    select count(*) into n from public.game_res_questions();
    if n < 3 then errs := errs || format('Pilihan ganda: minimal 3 soal (sekarang %s).', n); end if;
  end if;
  if 4 = any(s.active_levels) then
    select count(*) into n from public.game_res_scenes();
    if n < 1 then errs := array_append(errs, 'Tebak bahaya: minimal 1 foto.'::text); end if;
    for bad in select title from public.game_res_scenes() where npoints < 1 loop
      errs := errs || format('Tebak bahaya: foto "%s" belum punya titik bahaya.', bad.title);
    end loop;
  end if;
  if array_length(errs, 1) > 0 then
    raise exception 'Belum bisa diterbitkan: %', array_to_string(errs, ' ');
  end if;

  delete from public.game_words where pending_op = 'delete';
  update public.game_words set word = pending ->> 'word', clue = pending ->> 'clue', pending = null, pending_op = null where pending_op = 'edit';
  update public.game_words set live = true where not live;

  delete from public.game_signs where pending_op = 'delete';
  update public.game_signs set name = pending ->> 'name', category = pending ->> 'category', meaning = pending ->> 'meaning', image = pending ->> 'image', pending = null, pending_op = null where pending_op = 'edit';
  update public.game_signs set live = true where not live;

  delete from public.game_questions where pending_op = 'delete';
  update public.game_questions set q = pending ->> 'q', opts = array(select jsonb_array_elements_text(pending -> 'opts')), key = (pending ->> 'key')::int, expl = pending ->> 'expl', pending = null, pending_op = null where pending_op = 'edit';
  update public.game_questions set live = true where not live;

  delete from public.game_scenes where pending_op = 'delete';
  update public.game_scenes set title = pending ->> 'title', prompt = pending ->> 'prompt', image = pending ->> 'image', img_w = (pending ->> 'img_w')::int, img_h = (pending ->> 'img_h')::int, points = pending -> 'points', pending = null, pending_op = null where pending_op = 'edit';
  update public.game_scenes set live = true where not live;

  if 1 = any(s.active_levels) then update public.game_layout set live_grid = grid where id = 1 and grid is not null; end if;
  res := jsonb_build_object('words', (select count(*) from public.game_words where live), 'signs', (select count(*) from public.game_signs where live),
    'questions', (select count(*) from public.game_questions where live), 'scenes', (select count(*) from public.game_scenes where live));
  return res;
end $$;

-- Menghapus skor: 'week' (minggu ini), 'user' (satu peserta), 'all' (semua)
create or replace function public.game_admin_reset_scores(p_scope text, p_user uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public.game_require_admin();
  if p_scope = 'week' then delete from public.game_attempts where week = public.game_week_start();
  elsif p_scope = 'user' then
    if p_user is null then raise exception 'Pilih peserta.'; end if;
    delete from public.game_attempts where user_id = p_user;
  elsif p_scope = 'all' then delete from public.game_attempts;
  else raise exception 'Cakupan tidak dikenal.'; end if;
  get diagnostics n = row_count;
  return n;
end $$;

-- =====================================================================
-- 15) Data awal: 15 kata TTS dan 12 soal (hanya sekali; tidak dimasukkan ulang bila sudah dihapus)
-- =====================================================================
do $$
begin
  if (select seeded from public.game_settings where id = 1) then return; end if;
  insert into public.game_words (word, clue, live) values
    ('HAZARD', 'Sumber atau situasi yang berpotensi menimbulkan cedera, penyakit, atau kerusakan', true),
    ('APD', 'Alat pelindung diri', true),
    ('INSIDEN', 'Kejadian tidak diinginkan, dengan atau tanpa cedera', true),
    ('PENGENDALIAN', 'Langkah menurunkan risiko, dari eliminasi sampai APD', true),
    ('EVAKUASI', 'Perpindahan orang ke tempat aman saat keadaan darurat', true),
    ('ISOLASI', 'Pemisahan sumber energi sebelum perbaikan (lockout tagout)', true),
    ('RISIKO', 'Gabungan kemungkinan dan keparahan dari suatu bahaya', true),
    ('KESELAMATAN', 'Kondisi bebas dari cedera dan kerugian akibat kerja', true),
    ('APAR', 'Alat pemadam api ringan', true),
    ('HELM', 'APD untuk melindungi kepala dari benturan', true),
    ('SEPATU', 'APD untuk melindungi kaki di area kerja', true),
    ('KACAMATA', 'APD untuk melindungi mata dari percikan dan debu', true),
    ('TOOLBOX', 'Pertemuan singkat sebelum kerja untuk membahas bahaya hari itu', true),
    ('LANGKAH', 'Tahapan pekerjaan yang diurai satu per satu dalam JSA', true),
    ('PELAPORAN', 'Penyampaian informasi insiden atau bahaya kepada atasan', true);
  insert into public.game_questions (q, opts, key, expl, live) values
    ('Dalam hierarki pengendalian risiko, tindakan yang paling efektif adalah...', array['Eliminasi bahaya','Memakai APD','Membuat prosedur tertulis','Memasang rambu peringatan'], 0, 'Eliminasi menghilangkan bahaya dari sumbernya, sehingga paling efektif. APD adalah lapisan terakhir.', true),
    ('JSA (Job Safety Analysis) disusun untuk...', array['Mencatat jam kerja karyawan','Menguraikan langkah kerja, bahaya, dan pengendaliannya','Menghitung biaya perbaikan alat','Menilai kinerja atasan'], 1, 'JSA memecah pekerjaan menjadi langkah, lalu mengenali bahaya dan cara mengendalikannya pada tiap langkah.', true),
    ('Saat menemukan kebakaran kecil, langkah yang benar adalah...', array['Langsung pulang','Membiarkannya sampai padam sendiri','Membunyikan alarm dan melapor, lalu memadamkan bila aman','Menyiramnya dengan air, apa pun penyebabnya'], 2, 'Utamakan peringatan dan laporan. Padamkan hanya jika aman dan Anda terlatih. Air tidak boleh dipakai pada api listrik atau minyak.', true),
    ('Rambu berbentuk lingkaran berwarna biru menandakan...', array['Larangan','Peringatan bahaya','Kondisi aman','Kewajiban'], 3, 'Lingkaran biru adalah rambu wajib, misalnya wajib memakai helm.', true),
    ('Near miss adalah...', array['Kecelakaan dengan korban jiwa','Kejadian nyaris celaka tanpa cedera atau kerugian','Kerusakan alat yang sudah dilaporkan','Pelanggaran jam kerja'], 1, 'Near miss adalah peringatan dini. Melaporkannya mencegah kejadian serupa yang berakibat cedera.', true),
    ('Sebelum memperbaiki mesin, energi berbahaya harus diisolasi dengan prosedur...', array['Toolbox meeting','Housekeeping','Lockout tagout (LOTO)','Briefing akhir shift'], 2, 'LOTO mengunci dan menandai sumber energi agar mesin tidak menyala tiba-tiba saat diperbaiki.', true),
    ('Titik kumpul (assembly point) digunakan untuk...', array['Beristirahat saat makan siang','Memastikan semua orang selamat saat evakuasi','Menyimpan alat pemadam','Menunggu giliran absen'], 1, 'Di titik kumpul, jumlah orang dihitung untuk memastikan tidak ada yang tertinggal.', true),
    ('APD sebaiknya diperiksa...', array['Setahun sekali','Hanya bila rusak parah','Setiap sebelum dipakai','Hanya saat ada audit'], 2, 'APD yang retak, aus, atau rusak tidak melindungi. Periksa setiap sebelum dipakai.', true),
    ('Siapa yang berhak menghentikan pekerjaan yang tidak aman (Stop Work Authority)?', array['Hanya petugas K3','Hanya supervisor','Hanya manajer','Setiap pekerja'], 3, 'Setiap pekerja berhak dan wajib menghentikan pekerjaan yang tidak aman tanpa takut sanksi.', true),
    ('Untuk api yang berasal dari peralatan listrik, jenis APAR yang cocok adalah...', array['Air','CO2 atau serbuk kering','Busa','Pasir basah'], 1, 'CO2 dan serbuk kering tidak menghantarkan listrik. Air dan busa berbahaya pada api listrik.', true),
    ('Risiko merupakan...', array['Sumber bahaya itu sendiri','Gabungan kemungkinan dan keparahan dampak dari bahaya','Alat untuk mengurangi bahaya','Hasil investigasi insiden'], 1, 'Bahaya adalah sumbernya. Risiko adalah seberapa mungkin dan seberapa parah dampaknya.', true),
    ('Laporan insiden sebaiknya disampaikan...', array['Segera setelah kejadian','Menunggu akhir bulan','Hanya bila ada korban','Setelah masalah selesai'], 0, 'Laporan cepat membantu penanganan korban, pengamanan lokasi, dan pencegahan kejadian ulang.', true);
  update public.game_settings set seeded = true,
    departments = case when departments = '{}' then array['Produksi','Plant','Engineering','SCM-FAW','HCGA','SHE','Office'] else departments end
  where id = 1;
end $$;

-- =====================================================================
-- 16) Hak akses fungsi: tutup untuk umum, buka hanya untuk yang masuk
-- =====================================================================
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'game\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
grant execute on function
  public.game_my_status(), public.game_start(int), public.game_answer(uuid, int, int), public.game_hint(uuid, int, int),
  public.game_tap(uuid, numeric, numeric), public.game_finish(uuid, jsonb), public.game_leaderboard(date, text, boolean, date),
  public.game_set_department(text),
  public.game_settings_public(),
  public.game_admin_save_item(text, uuid, jsonb), public.game_admin_delete_item(text, uuid), public.game_admin_save_layout(jsonb),
  public.game_publish(), public.game_admin_reset_scores(text, uuid)
to authenticated;
