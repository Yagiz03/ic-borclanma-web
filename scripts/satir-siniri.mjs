#!/usr/bin/env node
/**
 * Sessiz kesilme kontrolu: PostgREST tek sorguda 1000 satir donduruyor ve
 * asildiginda HATA VERMIYOR -- eksik veriyle calismaya devam ediyorsun.
 *
 * Bugun tam bu oldu: Ihale gunu > Performans sekmesi bist_bap_fiyatlar'in
 * tamamini (76.221 satir) cekiyordu; 1000 satir geliyor, kagitlarin cogu
 * "veri yok" goruunuyordu. Hicbir yerde hata cikmadigi icin fark edilmedi.
 *
 * Bu betik canli tablo boyutlarina bakip, esigin uzerindeki bir tablodan
 * sayfalama (.range) ya da daraltma (.eq/.in/.like/.limit/.maybeSingle)
 * OLMADAN cekim yapan yerleri bildirir.
 *
 * Kullanim: npm run satir
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ESIK = 900; // 1000'e yaklasanlari da uyar

function env() {
  for (const d of [".env.local", ".env.production"]) {
    if (!existsSync(d)) continue;
    const m = readFileSync(d, "utf8");
    const url = /NEXT_PUBLIC_SUPABASE_URL=(\S+)/.exec(m)?.[1];
    const anon = /NEXT_PUBLIC_SUPABASE_ANON_KEY=(\S+)/.exec(m)?.[1];
    if (url && anon) return { url, anon };
  }
  return null;
}

const ayar = env();
if (!ayar) {
  console.error("Supabase URL/anon anahtar bulunamadi.");
  process.exit(1);
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

// Kaynakta gecen tablolar
const kullanimlar = [];
for (const yol of dosyalar("src")) {
  const kaynak = readFileSync(yol, "utf8");
  for (const m of kaynak.matchAll(
    /\.from\(\s*["'`]([a-z0-9_]+)["'`]\s*\)([\s\S]{0,500}?)(?=\.from\(|;\s*\n|\n\s*\n)/g,
  )) {
    kullanimlar.push({
      yol,
      tablo: m[1],
      guvenli: /\.range\(|\.limit\(|\.eq\(|\.in\(|\.like\(|\.maybeSingle\(|\.single\(/.test(m[2]),
      satirNo: kaynak.slice(0, m.index).split("\n").length,
    });
  }
}

/** Tablonun satir sayisi (HEAD + Content-Range, veri indirmeden). */
async function satirSayisi(tablo) {
  const y = await fetch(`${ayar.url}/rest/v1/${tablo}?select=*&limit=1`, {
    method: "HEAD",
    headers: { apikey: ayar.anon, Authorization: `Bearer ${ayar.anon}`, Prefer: "count=exact" },
  });
  const aralik = y.headers.get("content-range");
  return aralik ? Number(aralik.split("/")[1]) : null;
}

const tablolar = [...new Set(kullanimlar.map((k) => k.tablo))];
const sayilar = new Map();
for (const t of tablolar) {
  try { sayilar.set(t, await satirSayisi(t)); } catch { sayilar.set(t, null); }
}

let bulgu = 0;
for (const k of kullanimlar) {
  const n = sayilar.get(k.tablo);
  if (n == null || n < ESIK || k.guvenli) continue;
  console.log(`${k.yol}:${k.satirNo}  ${k.tablo} (${n.toLocaleString("tr-TR")} satir) — sayfalama yok`);
  bulgu++;
}

console.log(
  bulgu === 0
    ? `\nSessiz kesilme riski yok (${ESIK}+ satirli tablolarin hepsi sayfalaniyor ya da daraltiliyor).\n`
    : `\n${bulgu} yerde 1000 satir sinirina takilma riski var. lib/supabase-sayfali.ts kullan.\n`,
);
process.exitCode = bulgu === 0 ? 0 : 1;
