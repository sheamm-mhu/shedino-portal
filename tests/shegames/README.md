# Uji SHEGAMES (sisi server)

Uji ini menjalankan `supabase/schema.sql` dan `supabase/games.sql` di Postgres 16 sungguhan (sementara, di komputer pengembang),
lalu mencoba semua aturan: skor, minggu ISO, peringkat, keamanan akses, satu putaran tiap level, draf dan penerbitan.

```
pip install pgserver "psycopg[binary]"
python tests/shegames/run_all.py
```

Peringatan: uji ini TIDAK menyentuh Supabase Anda. Struktur Supabase (tabel `auth.users`, peran `anon` dan `authenticated`, `storage`) ditiru di `base.py`.

## Uji menyeluruh (browser sampai database)

`e2e1_*.py` dan `e2e2_*.py` menjalankan halaman SHEGAMES di Chromium, lewat supabase-js dan PostgREST 12, sampai Postgres dengan `games.sql` yang asli.
Hanya layanan login yang diganti penerbit token sederhana. Kebutuhan: `pip install playwright pgserver "psycopg[binary]"`,
`playwright install chromium`, berkas biner PostgREST 12 (atur `POSTGREST_BIN`), `axe.min.js` dari paket npm axe-core (atur `AXE_JS`),
dan server statis untuk folder `public` di port 8769 (misalnya `python -m http.server 8769` dari folder `public`).
