#!/usr/bin/env python3
"""Ekran goruntulerini referansla karsilastir, degisen piksel oranini yaz."""
import sys, pathlib
from PIL import Image, ImageChops

klasor = pathlib.Path("ekran")
referans = klasor / "referans"
if not referans.exists():
    sys.exit("Referans yok. Once: npm run ekran -- --referans")

esik = 1.0  # yuzde
degisen = []
for r in sorted(referans.glob("*.png")):
    y = klasor / r.name
    if not y.exists():
        print(f"  ? {r.name:24s} yeni cekim yok"); continue
    a, b = Image.open(r).convert("RGB"), Image.open(y).convert("RGB")
    if a.size != b.size:
        print(f"  ! {r.name:24s} boyut degisti {a.size} -> {b.size}"); degisen.append(r.name); continue
    fark = ImageChops.difference(a, b)
    # belirgin farki olan piksel sayisi (gurultu esigi 12)
    maske = fark.convert("L").point(lambda p: 255 if p > 12 else 0)
    n = sum(maske.histogram()[255:])
    oran = 100 * n / (a.size[0] * a.size[1])
    isaret = "!" if oran > esik else " "
    if oran > esik:
        degisen.append(r.name)
        fark.save(klasor / f"fark-{r.name}")
    print(f"  {isaret} {r.name:24s} %{oran:.2f}")

print(f"\n{len(degisen)} sayfa degismis." if degisen else "\nHicbir sayfa degismemis.")
