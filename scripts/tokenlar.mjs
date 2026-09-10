#!/usr/bin/env node
/**
 * Tasarim tokenlarini sayiyla dokum.
 *
 * Renk degisikligini ekran goruntusuyle dogrulamak bu oturumda defalarca
 * tikandi (tarayici paneli bos kare donduruyor). Yuzey katmanlarinin
 * ACIKLIK degerlerini yazdirmak ayni soruyu saniyede cevapliyor:
 * "kart sayfadan ayrisiyor mu, baslik karttan ayrisiyor mu".
 *
 * Kullanim: npm run tokenlar
 */
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");

/** Acik ve koyu tema tokenlari. Blogu suslu parantezle kesmek yorum
 *  satirlarindaki } yuzunden erken bitiyordu; .dark sinirindan boluyoruz. */
function temalar() {
  const i = css.indexOf(".dark {");
  const acikMetin = i === -1 ? css : css.slice(0, i);
  const koyuMetin = i === -1 ? "" : css.slice(i);
  const topla = (metin) => {
    const t = {};
    for (const m of metin.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
      if (!(m[1] in t)) t[m[1]] = m[2].trim();   // ilk tanim gecerli
    }
    return t;
  };
  return { acik: topla(acikMetin), koyu: topla(koyuMetin) };
}

/** oklch(L C H) -> L (0-1). Diger formatlarda null. */
function aciklik(deger) {
  const m = /oklch\(\s*([\d.]+)/.exec(deger || "");
  return m ? Number(m[1]) : null;
}

const KATMAN = [
  ["--background", "sayfa zemini"],
  ["--card", "kart / tablo yüzeyi"],
  ["--tablo-baslik", "tablo başlığı"],
  ["--muted", "sessiz yüzey"],
  ["--border", "kenarlık"],
];

const TEMA = temalar();
for (const [ad, t] of [["AÇIK TEMA", TEMA.acik], ["KOYU TEMA", TEMA.koyu]]) {
  if (Object.keys(t).length === 0) continue;
  console.log(`\n${ad}`);
  let onceki = null;
  for (const [anahtar, etiket] of KATMAN) {
    const ham = t[anahtar.replace(/^--/, "")];
    const L = aciklik(ham);
    const fark = L != null && onceki != null ? ` (öncekinden ${((L - onceki) * 100).toFixed(1)} puan)` : "";
    console.log(`  ${etiket.padEnd(22)} ${L != null ? L.toFixed(3) : "—"}  ${ham ?? "tanımsız"}${fark}`);
    if (L != null && anahtar !== "--border") onceki = L;
  }
}

// En kritik iliski: baslik yuzeyden yeterince ayrisiyor mu?
const kart = aciklik(TEMA.acik["card"]);
const baslik = aciklik(TEMA.acik["tablo-baslik"]);
if (kart != null && baslik != null) {
  const fark = Math.abs(kart - baslik) * 100;
  console.log(
    `\nTablo başlığı ↔ yüzey farkı: ${fark.toFixed(1)} puan — ` +
      (fark < 2 ? "ZAYIF, başlık ayrışmıyor" : fark > 9 ? "SERT, fazla kontrast" : "iyi"),
  );
}
console.log();
