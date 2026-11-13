# Uji SHEGAMES (sisi server)

Uji ini menjalankan `supabase/schema.sql` dan `supabase/games.sql` di Postgres 16 sungguhan (sementara, di komputer pengembang),
lalu mencoba semua aturan: skor, minggu ISO, peringkat, keamanan akses, satu putaran tiap level, draf dan penerbitan.

```
pip install pgserver "psycopg[binary]"
python tests/shegames/run_all.py
```

Peringatan: uji ini TIDAK menyentuh Supabase Anda. Struktur Supabase (tabel `auth.users`, peran `anon` dan `authenticated`, `storage`) ditiru di `base.py`.
