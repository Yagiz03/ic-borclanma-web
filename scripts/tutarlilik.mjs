#!/usr/bin/env node
/**
 * Tutarlilik kontrolu -- paylasilan bilesenleri atlayan kodu yakalar.
 *
 * Bu oturumda uc kez ayni sinif sorun cikti: bir sayfa Table yerine ham
 * <table> kullanmis (baslik seridini almiyordu), bir bilesen bg-card'i elle
 * yazmis (token degisince guncellenmedi), sayilar bicim.ts yerine toFixed ile
 * basilmis (nokta/virgul karisikligi). Ucu de goze carpmadan birikiyor.
 *
 * Kullanim: npm run tutarlilik
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const dosyalar = globSync("src/**/*.tsx", { exclude: (p) => p.includes("__tests__") });

const KURALLAR = [
  {
    ad: "Ham <table>",
    desen: /<table[\s>]/,
    aciklama: "Table bilesenini kullan (@/components/ui/table) -- ham <table> gri baslik seridini ve dikey ayraclari almiyor.",
    haric: ["src/components/ui/table.tsx"],
  },
  {
    ad: "Elle bg-card / bg-white",
    desen: /className="[^"]*\b(bg-white|bg-card)\b/,
    aciklama: "Yuzey rengini token uzerinden ver; elle yazilan degerler token degisince guncellenmiyor.",
    haric: ["src/components/ui/"],
  },
  {
    ad: "toFixed",
    desen: /\.toFixed\(/,
    aciklama: "Sayilari @/lib/bicim ile bicimle (sayi/yuzde/bps) -- toFixed nokta uretiyor, tr-TR virgul bekliyor.",
    haric: ["src/lib/bicim.ts", "src/lib/"],
  },
];

let toplam = 0;
for (const kural of KURALLAR) {
  const bulgular = [];
  for (const yol of dosyalar) {
    if (kural.haric.some((h) => yol.startsWith(h) || yol === h)) continue;
    const satirlar = readFileSync(yol, "utf8").split("\n");
    satirlar.forEach((s, i) => {
      if (kural.desen.test(s)) bulgular.push(`${yol}:${i + 1}`);
    });
  }
  if (bulgular.length) {
    console.log(`\n${kural.ad} — ${bulgular.length} yer`);
    console.log(`  ${kural.aciklama}`);
    for (const b of bulgular.slice(0, 12)) console.log(`  ${b}`);
    if (bulgular.length > 12) console.log(`  ... ve ${bulgular.length - 12} tane daha`);
    toplam += bulgular.length;
  } else {
    console.log(`\n${kural.ad} — temiz`);
  }
}

console.log(`\nToplam ${toplam} bulgu.`);
// Uyari amacli: mevcut birikmis borcu CI'i kirmadan gorunur kiliyor.
process.exit(0);
