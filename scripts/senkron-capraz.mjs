#!/usr/bin/env node
/**
 * Capraz kontrol: Python tarafinin "bilerek senkronlanmayan" dedigi bir
 * kolonu web sayfalari cekiyor mu?
 *
 * Bugun tam bu oldu: ihale_sonuclari.en_dusuk_fiyat_gerceklesme yerelde
 * 489/489 doluydu ama BILEREK_SENKRONLANMAYAN listesindeydi, yani
 * Supabase'e hic yazilmiyordu. Ihale gunu > "kesme fiyati onerisi" bu
 * kolonu okuyor -- oneri kagitlarin %96'sinda sessizce bostu. Sorgu hata
 * vermiyor, kolon var, sadece NULL.
 *
 * Kullanim: npm run capraz
 *   (Python deposunun yolu PROJE_YOLU ile degistirilebilir.)
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const PROJE =
  process.env.PROJE_YOLU ??
  join(process.env.HOME ?? "", "Desktop/Dosyalar/Kodlarım/Proje");
const YUKLEYICI = join(PROJE, "supabase_yukle.py");

if (!existsSync(YUKLEYICI)) {
  console.log(`Python deposu bulunamadi (${YUKLEYICI}) -- kontrol atlandi.`);
  process.exit(0);
}

// BILEREK_SENKRONLANMAYAN = { "tablo": {"kolon", ...}, ... }
const kaynak = readFileSync(YUKLEYICI, "utf8");
const blok = /BILEREK_SENKRONLANMAYAN = \{([\s\S]*?)\n\}/.exec(kaynak)?.[1];
if (!blok) {
  console.error("BILEREK_SENKRONLANMAYAN blogu okunamadi.");
  process.exit(1);
}

const haric = new Map();
for (const m of blok.matchAll(/"([a-z0-9_]+)":\s*\{([\s\S]*?)\}/g)) {
  haric.set(m[1], [...m[2].matchAll(/"([a-z0-9_]+)"/g)].map((x) => x[1]));
}

function dosyalar(kok) {
  const c = [];
  for (const a of readdirSync(kok)) {
    const y = join(kok, a);
    if (statSync(y).isDirectory()) c.push(...dosyalar(y));
    else if (/\.tsx?$/.test(a) && !y.includes("__tests__")) c.push(y);
  }
  return c;
}

const yollar = dosyalar("src");
let bulgu = 0;
for (const [tablo, kolonlar] of haric) {
  for (const kolon of kolonlar) {
    for (const yol of yollar) {
      const metin = readFileSync(yol, "utf8");
      // select("... kolon ...") icinde geciyor mu
      if (!new RegExp(`select\\([^)]*\\b${kolon}\\b`, "s").test(metin)) continue;
      console.log(`${yol}  ${tablo}.${kolon} — Supabase'e YAZILMIYOR, hep NULL doner`);
      bulgu++;
    }
  }
}

console.log(
  bulgu === 0
    ? "\nCapraz kontrol temiz: sayfalar yalnizca senkronlanan kolonlari cekiyor.\n"
    : `\n${bulgu} yerde bos kolon cekiliyor. Ya supabase_yukle.py'de senkrona al, ya sorgudan cikar.\n`,
);
process.exitCode = bulgu === 0 ? 0 : 1;
