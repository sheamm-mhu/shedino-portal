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

## Uji pembaca dokumen

`node tests/shegames/parse_test.js` menguji pembaca .docx, .xlsx, .csv, .txt dan pengurai soal (19 pemeriksaan).
Berkas contoh dibuat dengan python-docx, openpyxl, dan reportlab; atur `SG_FIXTURES` ke foldernya.

## Uji tahap 3 dan 4 (level 1, 2, 4 dan panel Admin)

Buat dulu berkas contoh: `pip install python-docx openpyxl reportlab pillow` lalu `python tests/shegames/buat_berkas_uji.py` (hasil di `tests/shegames/fixtures`).

| Berkas | Isi |
|---|---|
| `cw_test.js` | pembuat teka-teki silang otomatis (12 pemeriksaan), jalankan dengan `node` |
| `parse_test.js` | pembaca dokumen, pengurai soal, dan pengurai kata (26 pemeriksaan) |
| `t6_data_contoh_dan_pembuat_tts.py` | data contoh, pembaruan instalasi lama, dan 40 tata letak buatan JavaScript yang diperiksa pemeriksa server |
| `e2e5_*` | Admin level 1: kata, impor, pembuat kotak, terbit |
| `e2e6_*` | Admin level 2 (unggah rambu massal) dan level 4 (editor titik bahaya), termasuk ponsel |
| `e2e7_*` | perjalanan pemain level 1 sampai 4 dengan aturan berurutan |
| `e2e8_*` | tebak bahaya, ponsel, dan aksesibilitas semua layar permainan |

Uji `e2e*` membutuhkan PostgREST, Playwright, axe, dan server statis seperti yang dijelaskan di atas.

## Uji dasbor manajemen (tahap 5)

| Berkas | Isi |
|---|---|
| `t7_dasbor_manajemen.py` | angka dasbor di database: KPI, per level, per departemen, topik sering salah, peringkat dengan NIK, periode minggu, bulan, semua waktu, hanya admin (21 pemeriksaan) |
| `e2e9_admin_dasbor_ekspor.py` | dasbor di browser: angka, pergantian periode, ekspor Excel 5 lembar (dibuka ulang dengan openpyxl), cetak, aksesibilitas, ponsel (20 pemeriksaan) |
