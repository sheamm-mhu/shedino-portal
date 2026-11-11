-- =====================================================================
-- SHEDINO - Skema akun (jalankan sekali di Supabase > SQL Editor)
-- =====================================================================

-- 1) Tabel profil: satu baris untuk setiap akun
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  full_name    text not null default '',
  employee_id  text not null default '',
  role         text not null default 'karyawan' check (role in ('karyawan','admin')),
  status       text not null default 'pending'  check (status in ('pending','approved','rejected')),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 2) Fungsi pengecekan admin (security definer agar tidak memicu rekursi RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

-- 3) Setiap akun baru otomatis dibuatkan profil berstatus "pending" dan peran "karyawan".
--    Peran dan status SENGAJA tidak diambil dari input pengguna.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, employee_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'employee_id', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) Kebijakan akses (RLS)
drop policy if exists "baca profil sendiri"   on public.profiles;
drop policy if exists "admin baca semua"      on public.profiles;
drop policy if exists "admin ubah profil"     on public.profiles;

create policy "baca profil sendiri"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "admin baca semua"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

create policy "admin ubah profil"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Tidak ada kebijakan insert/update/delete untuk pengguna biasa,
-- sehingga karyawan tidak bisa menyetujui dirinya sendiri.

-- 4b) Fungsi pengecekan akun yang sudah disetujui
create or replace function public.is_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

-- 4c) Tabel statistik SHE (angka yang tampil di beranda untuk akun yang disetujui)
create table if not exists public.she_stats (
  key         text primary key,
  label       text not null,
  value       text not null default '-',
  unit        text not null default '',
  note        text not null default '',
  sort_order  int  not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.she_stats enable row level security;

drop policy if exists "statistik dibaca akun disetujui" on public.she_stats;
drop policy if exists "statistik diubah admin"          on public.she_stats;

create policy "statistik dibaca akun disetujui"
  on public.she_stats for select
  to authenticated
  using (public.is_approved());

create policy "statistik diubah admin"
  on public.she_stats for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Baris awal (aman dijalankan berulang; tidak menimpa angka yang sudah diisi)
insert into public.she_stats (key, label, value, unit, note, sort_order) values
  ('insiden',    'Jumlah insiden',        '0',  'kasus',   '', 1),
  ('afr',        'AFR',                   '0',  '',        '', 2),
  ('cidera',     'Jumlah cidera',         '0',  'orang',   '', 3),
  ('nearmiss',   'Near miss dilaporkan',  '0',  'laporan', '', 4),
  ('lingkungan', 'Pencemaran lingkungan', '0',  'kasus',   '', 5),
  ('skor',       'Skor program SHE',      '0',  '/ 100',   '', 6),
  ('closing',    'Closing rate hazard',   '0',  '%',       '', 7),
  ('inspeksi',   'Inspeksi terlaksana',   '0',  '%',       '', 8)
on conflict (key) do nothing;

-- =====================================================================
-- 4d) KONTEN SITUS (diedit lewat panel Admin)
-- Nama tabel diawali "site_" / "media_" agar tidak bentrok dengan tabel lain
-- jika project Supabase ini dipakai bersama aplikasi lain.
-- =====================================================================

-- Kabar SHE dan Edukasi
create table if not exists public.media_posts (
  id          text primary key,
  tab         text not null default 'kabar',
  title       text not null,
  excerpt     text not null default '',
  category    text not null default '',
  pub_date    date not null default current_date,
  tags        text[] not null default '{}',
  image       text not null default '',
  file_url    text not null default '',
  body        jsonb not null default '[]'::jsonb,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Untuk project yang sudah memakai versi sebelumnya:
-- jenis konten tidak lagi dibatasi (Kabar, Edukasi, Hari Besar, Buletin, Kampanye, dan seterusnya)
alter table public.media_posts add column if not exists file_url text not null default '';
alter table public.media_posts drop constraint if exists media_posts_tab_check;

-- Pustaka dokumen
create table if not exists public.site_docs (
  id          text primary key,
  title       text not null,
  doc_type    text not null default 'Panduan',
  fmt         text not null default 'PDF',
  doc_date    date not null default current_date,
  url         text not null default '',
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Layanan
create table if not exists public.site_services (
  id          text primary key,
  grp         text not null default 'Layanan',
  icon        text not null default 'file',
  login       boolean not null default true,
  featured    boolean not null default false,
  title       text not null,
  descr       text not null default '',
  url         text not null default '',
  btn_label   text not null default '',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Untuk project yang sudah memakai versi sebelumnya
alter table public.site_services add column if not exists btn_label text not null default '';
alter table public.site_services drop constraint if exists site_services_grp_check;

-- Tab / kelompok layanan (bisa ditambah, diganti nama, atau dijadikan tautan)
create table if not exists public.site_groups (
  id          text primary key,
  name        text not null,
  icon        text not null default 'file',
  tone        text not null default 'blue',
  note        text not null default '',
  url         text not null default '',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Pertanyaan umum
create table if not exists public.site_faq (
  id          bigint generated always as identity primary key,
  q           text not null,
  a           text not null default '',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Pengaturan umum (nama perusahaan, kontak, status sistem, dan lain-lain)
create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null default 'null'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.media_posts   enable row level security;
alter table public.site_docs     enable row level security;
alter table public.site_services enable row level security;
alter table public.site_faq      enable row level security;
alter table public.site_groups   enable row level security;
alter table public.site_settings enable row level security;

-- Konten bersifat publik (siapa pun boleh membaca), hanya admin yang boleh mengubah.
-- Artikel dan dokumen berstatus draf hanya terlihat oleh admin.
drop policy if exists "shedino baca artikel"  on public.media_posts;
drop policy if exists "shedino ubah artikel"  on public.media_posts;
drop policy if exists "shedino baca dokumen"  on public.site_docs;
drop policy if exists "shedino ubah dokumen"  on public.site_docs;
drop policy if exists "shedino baca layanan"  on public.site_services;
drop policy if exists "shedino ubah layanan"  on public.site_services;
drop policy if exists "shedino baca tab"      on public.site_groups;
drop policy if exists "shedino ubah tab"      on public.site_groups;
drop policy if exists "shedino baca faq"      on public.site_faq;
drop policy if exists "shedino ubah faq"      on public.site_faq;
drop policy if exists "shedino baca setelan"  on public.site_settings;
drop policy if exists "shedino ubah setelan"  on public.site_settings;

create policy "shedino baca artikel" on public.media_posts for select to anon, authenticated
  using (published or public.is_admin());
create policy "shedino ubah artikel" on public.media_posts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "shedino baca dokumen" on public.site_docs for select to anon, authenticated
  using (published or public.is_admin());
create policy "shedino ubah dokumen" on public.site_docs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "shedino baca layanan" on public.site_services for select to anon, authenticated using (true);
create policy "shedino ubah layanan" on public.site_services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "shedino baca tab" on public.site_groups for select to anon, authenticated using (true);
create policy "shedino ubah tab" on public.site_groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "shedino baca faq" on public.site_faq for select to anon, authenticated using (true);
create policy "shedino ubah faq" on public.site_faq for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "shedino baca setelan" on public.site_settings for select to anon, authenticated using (true);
create policy "shedino ubah setelan" on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Penyimpanan foto dan file (bucket publik "site-media").
-- Hanya admin yang boleh mengunggah, mengganti, dan menghapus.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media', 'site-media', true, 10485760,
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shedino media dilihat publik"  on storage.objects;
drop policy if exists "shedino media diunggah admin"  on storage.objects;
drop policy if exists "shedino media diganti admin"   on storage.objects;
drop policy if exists "shedino media dihapus admin"   on storage.objects;

create policy "shedino media dilihat publik" on storage.objects for select to anon, authenticated
  using (bucket_id = 'site-media');
create policy "shedino media diunggah admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and public.is_admin());
create policy "shedino media diganti admin" on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and public.is_admin())
  with check (bucket_id = 'site-media' and public.is_admin());
create policy "shedino media dihapus admin" on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and public.is_admin());

-- 5) Buat admin pertama.
--    Daftar dulu lewat halaman Masuk > Daftar, lalu jalankan baris di bawah
--    (ganti emailnya, hapus tanda -- di depan), lalu klik Run.
-- update public.profiles
--   set role = 'admin', status = 'approved'
--   where email = 'email-admin@perusahaan.co.id';
