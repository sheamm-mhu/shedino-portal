"""Menjalankan semua uji SHEGAMES (butuh: pip install pgserver "psycopg[binary]")."""
import os, re, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
total_ok = total_bad = 0
for f in sorted(x for x in os.listdir(here) if re.match(r"t\d_.*\.py$", x)):
    out = subprocess.run([sys.executable, os.path.join(here, f)], capture_output=True, text=True).stdout
    for line in out.splitlines():
        if line.startswith("FAIL"): print(f, line)
    m = re.search(r"TOTAL (\d+) lulus, (\d+) gagal", out)
    if not m: print(f, "TIDAK SELESAI"); total_bad += 1; continue
    total_ok += int(m.group(1)); total_bad += int(m.group(2))
    print(f"{f}: {m.group(1)} lulus, {m.group(2)} gagal")
print(f"JUMLAH: {total_ok} lulus, {total_bad} gagal")
sys.exit(1 if total_bad else 0)
