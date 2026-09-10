#!/usr/bin/env node
/**
 * Sema kaymasi: Supabase'de VAR olup sayfalarda hic cekilmeyen kolonlar.
 *
 * Bugun tam bu oldu: tcmb_dogrudan_alim tablosunda teklif_tutari,
 * kabul_orani_pct ve ort_bilesik_faiz aylarca doluydu, sayfa yalnizca
 * kazanan_tutar'i cekiyordu. Hicbir yerde hata cikmadigi icin kimse fark
 * etmedi -- veri orada oturuyor, sadece kullanilmiyor.
 *
 * Sema anlik goruntusu TUTULMUYOR (bayatlar): kaynakta gecen her tablodan
 * bir satir cekilip kolon adlari oradan okunuyor. Yalnizca public/anon
 * anahtar kullaniliyor.
 *
 * Kullanim: npm run sema
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

function env() {
  for (const dosya of [".env.local", ".env.production"]) {
    if (!existsSync(dosya)) continue;
    const metin = readFileSync(dosya, "utf8");
    const url = /NEXT_PUBLIC_SUPABASE_URL=(\S+)/.exec(metin)?.[1];
    const anon = /NEXT_PUBLIC_SUPABASE_ANON_KEY=(\S+)/.exec(metin)?.[1];
    if (url && anon) return { url, anon };
  }
  return null;
}

const ayar = env();
if (!ayar) {
  console.error("Supabase URL/anon anahtar bulunamadi (.env.local veya .env.production).");
  process.exit(1);
}

/** Kullanici verisi: kapsam disi. */
const HARIC = new Set(["watchlist", "positions", "auction_tracks", "auction_orders"]);

function kaynakDosyalari(kok) {
  const cikti = [];
  for (const ad of readdirSync(kok)) {
    const yol = join(kok, ad);
    if (statSync(yol).isDirectory()) cikti.push(...kaynakDosyalari(yol));
    else if (/\.(tsx|ts)$/.test(ad) && !yol.includes("__tests__")) cikti.push(yol);
  }
  return cikti;
}

// Kaynakta hangi tablodan hangi kolonlar cekiliyor
const cekilen = new Map();
for (const yol of kaynakDosyalari("src")) {
  const kaynak = readFileSync(yol, "utf8");
  for (const m of kaynak.matchAll(
    /\.from\(\s*["'`]([a-z0-9_]+)["'`]\s*\)([\s\S]{0,400}?)\.select\(\s*["'`]([^"'`]*)["'`]/g,
  )) {
    const kume = cekilen.get(m[1]) ?? new Set();
    for (const parca of m[3].split(",")) {
      const ad = parca.trim().split(/[\s(:]/)[0];
      if (ad) kume.add(ad);
    }
    cekilen.set(m[1], kume);
  }
}

let toplam = 0;
for (const [tablo, kume] of [...cekilen].sort()) {
  if (HARIC.has(tablo) || kume.has("*")) continue;
  let satir;
  try {
    const y = await fetch(`${ayar.url}/rest/v1/${tablo}?select=*&limit=1`, {
      headers: { apikey: ayar.anon, Authorization: `Bearer ${ayar.anon}` },
    });
    if (!y.ok) { console.log(`\n${tablo} — okunamadi (HTTP ${y.status})`); continue; }
    satir = (await y.json())[0];
  } catch (e) {
    console.log(`\n${tablo} — istek basarisiz: ${e.message}`);
    continue;
  }
  if (!satir) { console.log(`\n${tablo} — tablo bos, karsilastirilamadi`); continue; }

  const kullanilmayan = Object.keys(satir).filter((k) => !kume.has(k));
  if (kullanilmayan.length) {
    console.log(`\n${tablo} — ${kullanilmayan.length} kolon cekilmiyor (${kume.size} cekiliyor)`);
    console.log(`  ${kullanilmayan.join(", ")}`);
    toplam += kullanilmayan.length;
  }
}

console.log(
  `\n${toplam} kolon sayfalarda kullanilmiyor.\n` +
    "Hepsi eksik demek degil -- cogu bilerek disarida. Ama \"veri vardi,\n" +
    "sorgu cekmiyordu\" durumunu burada gorursun.\n",
);
