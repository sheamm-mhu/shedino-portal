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

-- 5) Buat admin pertama.
--    Daftar dulu lewat halaman Masuk > Daftar, lalu jalankan baris di bawah
--    (ganti emailnya, hapus tanda -- di depan), lalu klik Run.
-- update public.profiles
--   set role = 'admin', status = 'approved'
--   where email = 'email-admin@perusahaan.co.id';
