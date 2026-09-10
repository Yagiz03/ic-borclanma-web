#!/usr/bin/env node
/**
 * Fixture kaydi: ayakta olan dev sunucusunu gezerek Supabase yanitlarini
 * fixture/ altina dusurur.
 *
 * Akis (Next tek dev sunucusuna izin verdigi icin iki adim):
 *   1) npm run dev:kaydet    -- sunucuyu kayit modunda baslat
 *   2) npm run fixture       -- (baska terminalde) tum sayfalari gez
 *   3) Ctrl-C, sonra: npm run dev:fixture
 *
 * Ucuncu adimdan sonra sayfalar internet olmadan ve veri kaymadan aciliyor.
 * Ekran goruntusu karsilastirmasi ancak boyle anlamli: fark yalnizca
 * tasarim degisikliginden gelir, gunluk veri hareketinden degil.
 */
import { readdirSync } from "node:fs";

const PORT = process.argv.find((a) => /^\d+$/.test(a)) ?? "3000";
const TEMEL = `http://localhost:${PORT}`;
const ROTALAR = [
  "tasarim",
  ...["ihale-detay", "ihale-gunu", "dibs-detay", "getiri-egrisi", "pricing",
      "tcmb", "hazine", "takasbank-tpp", "ozel-sektor", "strateji", "takvim",
      "deneysel"].map((r) => `dashboard/${r}`),
];

function sayi() {
  try { return readdirSync("fixture").length; } catch { return 0; }
}

try {
  await fetch(TEMEL);
} catch {
  console.error(`${TEMEL} kapali. Once: npm run dev:kaydet`);
  process.exit(1);
}

const once = sayi();
for (const rota of ROTALAR) {
  const t0 = Date.now();
  const y = await fetch(`${TEMEL}/${rota}`);
  // Akan sayfa: govdeyi sonuna kadar oku, yoksa Suspense icindeki
  // sorgular hic calismadan baglanti kapanir.
  await y.text();
  console.log(`${y.status}  ${rota}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

const sonra = sayi();
console.log(`\nfixture/: ${once} -> ${sonra} sorgu.`);
if (sonra === once) {
  console.log("Yeni kayit yok -- sunucu kayit modunda mi? (npm run dev:kaydet)");
} else {
  console.log("Simdi: Ctrl-C, ardindan npm run dev:fixture\n");
}
