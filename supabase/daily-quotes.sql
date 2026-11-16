-- =====================================================================
-- SHEDINO: Daily Quotes (pembuat poster dari templat, dengan persetujuan admin)
-- Jalankan SETELAH schema.sql. Aman dijalankan berulang.
-- =====================================================================

-- 1) Tombol aksi pada artikel: '' = otomatis (judul memuat "Daily Safety Quotes"), 'dailyquotes' = selalu, 'none' = tidak ada
alter table public.media_posts add column if not exists cta text not null default '';
alter table public.media_posts drop constraint if exists media_posts_cta_check;
alter table public.media_posts add constraint media_posts_cta_check check (cta in ('', 'dailyquotes', 'none'));

-- 2) Pengaturan
create table if not exists public.dq_settings (
  id              int primary key default 1 check (id = 1),
  enabled         boolean not null default true,
  require_login   boolean not null default false,
  max_pending     int not null default 100 check (max_pending between 1 and 2000),
  per_token_daily int not null default 5 check (per_token_daily between 1 and 100),
  notice          text not null default 'Karya Anda akan tampil di galeri setelah disetujui admin.' check (char_length(notice) <= 300),
  updated_at      timestamptz not null default now()
);
insert into public.dq_settings (id) values (1) on conflict (id) do nothing;

-- 3) Templat. photo = kotak tempat orang diletakkan; fields = kotak-kotak teks (semua dalam persen dari lebar/tinggi gambar)
create or replace function public.dq_valid_template(p_photo jsonb, p_fields jsonb) returns boolean
language plpgsql immutable as $$
declare f jsonb; keys text[] := '{}';
begin
  if jsonb_typeof(p_photo) <> 'object' or jsonb_typeof(p_fields) <> 'array' then return false; end if;
  if jsonb_array_length(p_fields) > 8 then return false; end if;
  if jsonb_typeof(p_photo -> 'x') <> 'number' or jsonb_typeof(p_photo -> 'y') <> 'number' or jsonb_typeof(p_photo -> 'w') <> 'number' or jsonb_typeof(p_photo -> 'h') <> 'number' then return false; end if;
  if (p_photo ->> 'x')::numeric not between 0 and 100 or (p_photo ->> 'y')::numeric not between 0 and 100
     or (p_photo ->> 'w')::numeric not between 1 and 100 or (p_photo ->> 'h')::numeric not between 1 and 100 then return false; end if;
  for f in select * from jsonb_array_elements(p_fields) loop
    if jsonb_typeof(f) <> 'object' then return false; end if;
    if coalesce(f ->> 'key', '') !~ '^[a-z][a-z0-9_]{0,19}$' or (f ->> 'key') = any(keys) then return false; end if;
    keys := keys || (f ->> 'key');
    if char_length(coalesce(f ->> 'label', '')) not between 1 and 60 or char_length(coalesce(f ->> 'sample', '')) > 300 then return false; end if;
    if coalesce(f ->> 'x', 'z') !~ '^[0-9.]+$' or coalesce(f ->> 'y', 'z') !~ '^[0-9.]+$' or coalesce(f ->> 'w', 'z') !~ '^[0-9.]+$' or coalesce(f ->> 'h', 'z') !~ '^[0-9.]+$' or coalesce(f ->> 'size', 'z') !~ '^[0-9.]+$' then return false; end if;
    if (f ->> 'x')::numeric > 100 or (f ->> 'y')::numeric > 100 or (f ->> 'w')::numeric not between 1 and 100 or (f ->> 'h')::numeric not between 1 and 100 or (f ->> 'size')::numeric not between 0.5 and 30 then return false; end if;
    if coalesce(f ->> 'font', '') not in ('display', 'body', 'serif') or coalesce(f ->> 'align', '') not in ('left', 'center', 'right') then return false; end if;
    if coalesce(f ->> 'weight', '') not in ('400', '500', '600', '700', '800', '900') or coalesce(f ->> 'color', '') !~ '^#[0-9A-Fa-f]{6}$' then return false; end if;
    if coalesce(f ->> 'maxlines', 'z') !~ '^[1-8]$' then return false; end if;
    if jsonb_typeof(f -> 'italic') <> 'boolean' or jsonb_typeof(f -> 'upper') <> 'boolean' or jsonb_typeof(f -> 'shadow') <> 'boolean' then return false; end if;
  end loop;
  return true;
end $$;

create table if not exists public.dq_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  back_image  text not null check (back_image ~ '^(https://|assets/)' and char_length(back_image) <= 600),
  front_image text not null default '' check (front_image = '' or (front_image ~ '^(https://|assets/)' and char_length(front_image) <= 600)),
  w           int not null default 1080 check (w between 300 and 4000),
  h           int not null default 1350 check (h between 300 and 4000),
  photo       jsonb not null default '{"x":10,"y":27,"w":80,"h":55}'::jsonb,
  fields      jsonb not null default '[]'::jsonb,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint dq_templates_shape check (public.dq_valid_template(photo, fields))
);

-- 4) Kiriman. Pengunjung tidak menulis langsung ke tabel ini; hanya lewat dq_submit().
create table if not exists public.dq_submissions (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid references public.dq_templates(id) on delete set null,
  image        text not null unique check (image ~ '^https://' and char_length(image) <= 600),
  name         text not null default '' check (char_length(name) <= 80),
  job          text not null default '' check (char_length(job) <= 100),
  quote        text not null default '' check (char_length(quote) <= 400),
  date_text    text not null default '' check (char_length(date_text) <= 30),
  sender       text not null default '' check (char_length(sender) <= 80),
  token        text not null,
  user_id      uuid,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason       text not null default '' check (char_length(reason) <= 300),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid
);
create index if not exists dq_submissions_status_idx on public.dq_submissions (status, created_at desc);
create index if not exists dq_submissions_token_idx on public.dq_submissions (token, created_at desc);

-- 5) Hak akses
alter table public.dq_settings enable row level security;
alter table public.dq_templates enable row level security;
alter table public.dq_submissions enable row level security;
drop policy if exists "dq pengaturan dilihat semua" on public.dq_settings;
drop policy if exists "dq pengaturan diubah admin" on public.dq_settings;
drop policy if exists "dq templat dilihat" on public.dq_templates;
drop policy if exists "dq templat dikelola admin" on public.dq_templates;
drop policy if exists "dq galeri dilihat semua" on public.dq_submissions;
drop policy if exists "dq kiriman dikelola admin" on public.dq_submissions;
create policy "dq pengaturan dilihat semua" on public.dq_settings for select to anon, authenticated using (true);
create policy "dq pengaturan diubah admin" on public.dq_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "dq templat dilihat" on public.dq_templates for select to anon, authenticated using (active or public.is_admin());
create policy "dq templat dikelola admin" on public.dq_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "dq galeri dilihat semua" on public.dq_submissions for select to anon, authenticated using (status = 'approved' or public.is_admin());
create policy "dq kiriman dikelola admin" on public.dq_submissions for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.dq_settings, public.dq_templates to anon, authenticated;
grant select on public.dq_submissions to anon, authenticated;
grant update on public.dq_settings to authenticated;
grant insert, update, delete on public.dq_templates, public.dq_submissions to authenticated;
-- anon tidak boleh membaca kolom pribadi (token, pengirim, user) walau barisnya disetujui
revoke select on public.dq_submissions from anon;
grant select (id, template_id, image, name, job, quote, date_text, status, created_at) on public.dq_submissions to anon;

-- 6) Pengiriman dari pengunjung (tanpa atau dengan login, sesuai pengaturan). Semuanya masuk antrean "pending".
create or replace function public.dq_submit(p_template uuid, p_image text, p_name text, p_job text, p_quote text, p_date text, p_sender text, p_token text, p_hp text default '')
returns uuid
language plpgsql security definer set search_path = public as $$
declare s public.dq_settings; v_path text; v_id uuid; v_name text; v_job text; v_quote text; v_date text; v_sender text; v_uid uuid := auth.uid();
  clean constant text := '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]';
begin
  if coalesce(p_hp, '') <> '' then return null; end if;                           -- jebakan untuk bot: pura-pura berhasil
  select * into s from public.dq_settings where id = 1;
  if not s.enabled then raise exception 'Fitur Daily Quotes sedang dinonaktifkan oleh admin.'; end if;
  if s.require_login and (v_uid is null or not exists (select 1 from public.profiles where id = v_uid and status = 'approved')) then
    raise exception 'Silakan masuk dengan akun SHEDINO untuk mengirim karya.';
  end if;
  if coalesce(p_token, '') !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception 'Pengiriman tidak valid. Muat ulang halaman lalu coba lagi.'; end if;
  if not exists (select 1 from public.dq_templates where id = p_template and active) then raise exception 'Templat tidak tersedia. Pilih templat lain.'; end if;
  v_name := btrim(regexp_replace(coalesce(p_name, ''), clean, '', 'g'));   v_job := btrim(regexp_replace(coalesce(p_job, ''), clean, '', 'g'));
  v_quote := btrim(regexp_replace(coalesce(p_quote, ''), clean, '', 'g')); v_date := btrim(regexp_replace(coalesce(p_date, ''), clean, '', 'g'));
  v_sender := btrim(regexp_replace(coalesce(p_sender, ''), clean, '', 'g'));
  if v_name = '' or v_quote = '' then raise exception 'Nama dan kata-kata wajib diisi.'; end if;
  if char_length(v_name) > 80 or char_length(v_job) > 100 or char_length(v_quote) > 400 or char_length(v_date) > 30 or char_length(v_sender) > 80 then raise exception 'Ada isian yang terlalu panjang.'; end if;
  if coalesce(p_image, '') !~ '^https://[^ ]+/storage/v1/object/public/dq-submissions/p/[0-9]{6}/[A-Za-z0-9_-]{10,60}\.(jpg|jpeg|webp|png)$' then raise exception 'Alamat gambar tidak valid.'; end if;
  v_path := substring(p_image from '/storage/v1/object/public/dq-submissions/(.*)$');
  if not exists (select 1 from storage.objects where bucket_id = 'dq-submissions' and name = v_path) then raise exception 'Gambar belum terunggah. Coba kirim lagi.'; end if;
  if (select count(*) from public.dq_submissions where status = 'pending') >= s.max_pending then raise exception 'Antrean persetujuan sedang penuh. Coba lagi nanti.'; end if;
  if (select count(*) from public.dq_submissions where token = p_token and created_at > now() - interval '1 day') >= s.per_token_daily then raise exception 'Batas pengiriman hari ini sudah tercapai. Coba lagi besok.'; end if;
  insert into public.dq_submissions (template_id, image, name, job, quote, date_text, sender, token, user_id)
    values (p_template, p_image, v_name, v_job, v_quote, v_date, v_sender, p_token, v_uid) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.dq_submit(uuid, text, text, text, text, text, text, text, text) from public;
grant execute on function public.dq_submit(uuid, text, text, text, text, text, text, text, text) to anon, authenticated;

-- Jumlah per status untuk lencana di panel admin
create or replace function public.dq_counts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Hanya admin yang boleh membuka ini.'; end if;
  return (select jsonb_build_object('pending', count(*) filter (where status = 'pending'), 'approved', count(*) filter (where status = 'approved'), 'rejected', count(*) filter (where status = 'rejected')) from public.dq_submissions);
end $$;
revoke all on function public.dq_counts() from public; grant execute on function public.dq_counts() to authenticated;

-- 7) Penyimpanan kiriman: pengunjung boleh mengunggah (hanya ke folder p/, gambar kecil), tidak boleh melihat daftar atau menimpa
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dq-submissions', 'dq-submissions', true, 1048576, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg', 'image/webp', 'image/png'];
drop policy if exists "dq unggah kiriman" on storage.objects;
drop policy if exists "dq admin lihat kiriman" on storage.objects;
drop policy if exists "dq admin hapus kiriman" on storage.objects;
create policy "dq unggah kiriman" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'dq-submissions' and name ~ '^p/[0-9]{6}/[A-Za-z0-9_-]{10,60}\.(jpg|jpeg|webp|png)$');
create policy "dq admin lihat kiriman" on storage.objects for select to authenticated using (bucket_id = 'dq-submissions' and public.is_admin());
create policy "dq admin hapus kiriman" on storage.objects for delete to authenticated using (bucket_id = 'dq-submissions' and public.is_admin());

-- 8) Templat contoh (sekali, bila belum ada templat). Ganti dengan latar mentahan Anda lewat Admin > Daily Quotes > Templat.
insert into public.dq_templates (name, back_image, front_image, w, h, photo, fields, sort_order)
select 'Daily Safety Quotes (contoh)', 'assets/dq/templat-latar.jpg', 'assets/dq/templat-depan.png', 1080, 1350,
  '{"x":8,"y":27,"w":84,"h":53}'::jsonb,
  '[
    {"key":"date","label":"Tanggal","sample":"03/NOV/26","x":20,"y":23.6,"w":60,"h":3.6,"size":2.6,"font":"display","weight":"800","italic":false,"upper":true,"color":"#FFFFFF","align":"center","maxlines":1,"shadow":true},
    {"key":"name","label":"Nama","sample":"Nama Pekerja","x":6,"y":81.6,"w":88,"h":4.2,"size":3.4,"font":"display","weight":"800","italic":false,"upper":true,"color":"#FFFFFF","align":"center","maxlines":1,"shadow":false},
    {"key":"job","label":"Jabatan atau departemen","sample":"Operator, Departemen Produksi","x":6,"y":86,"w":88,"h":2.8,"size":2.1,"font":"body","weight":"600","italic":false,"upper":false,"color":"#FBBF24","align":"center","maxlines":1,"shadow":false},
    {"key":"quote","label":"Kata-kata","sample":"Keselamatan bukan pilihan, tetapi tanggung jawab bersama.","x":8,"y":89.2,"w":84,"h":7,"size":2.0,"font":"body","weight":"500","italic":true,"upper":false,"color":"#FFFFFF","align":"center","maxlines":4,"shadow":false}
  ]'::jsonb, 0
where not exists (select 1 from public.dq_templates);
