#!/usr/bin/env node
/**
 * Sayfa ekran goruntuleri -- kurulu Chrome'un headless modunu kullanir.
 *
 * Tarayici paneli bu projede sik sik bos kare donduruyor (uzun sayfalar,
 * Suspense akisi, gizli pane). Chrome headless ayni sayfayi tam cozunurlukte
 * ve yuklenmis halde veriyor, ustelik ek bagimlilik yok -- Playwright ve
 * ~300 MB tarayici indirmeye gerek kalmiyor.
 *
 * Kullanim -- tasarim degisikligini dogrulamanin akisi:
 *   npm run ekran -- --referans    (degisiklikten ONCE: cek ve sabitle)
 *   ... degisikligi yap, deploy et ...
 *   npm run ekran                  (SONRA: tekrar cek)
 *   npm run ekran-fark             (piksel farkini raporla)
 *
 *   --yerel  localhost:3000'e bakar (canli yerine)
 *
 * NOT: sayfalar her gun degisen canli veri gosteriyor, bu yuzden repoda
 * kalici bir referans tutulmuyor -- karsilastirma ayni oturum icinde
 * anlamli. Tek istisna /tasarim: verisi sabit, orada fark yalnizca
 * bilesen degisikliginden gelir.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(CHROME)) {
  console.error("Chrome bulunamadi:", CHROME);
  process.exit(1);
}

const arg = process.argv.slice(2);
const yerel = arg.includes("--yerel");
const referansYap = arg.includes("--referans");
const karsilastir = arg.includes("--karsilastir");
const TEMEL = yerel ? "http://localhost:3000" : "https://tahvil.vercel.app";

const ROTALAR = [
  "ihale-detay", "ihale-gunu", "dibs-detay", "getiri-egrisi", "pricing",
  "tcmb", "hazine", "takasbank-tpp", "ozel-sektor", "strateji", "takvim", "deneysel",
];

const KLASOR = "ekran";
const REFERANS = join(KLASOR, "referans");
mkdirSync(KLASOR, { recursive: true });

if (!karsilastir) {
  console.log(`Kaynak: ${TEMEL}\n`);
  // /tasarim once: bilesen degisikliklerini tek karede gosterir
  for (const rota of ["tasarim", ...ROTALAR.map((r) => `dashboard/${r}`)]) {
    const ad = rota.replace("dashboard/", "") + ".png";
    const hedef = join(KLASOR, ad);
    try {
      execFileSync(CHROME, [
        "--headless", "--disable-gpu", "--hide-scrollbars",
        `--screenshot=${hedef}`, "--window-size=1440,900",
        "--virtual-time-budget=9000", `${TEMEL}/${rota}`,
      ], { stdio: "ignore", timeout: 60_000 });
      console.log(`  ✓ ${ad}`);
    } catch {
      console.log(`  ✗ ${ad} — alinamadi`);
    }
  }
}

if (referansYap) {
  mkdirSync(REFERANS, { recursive: true });
  for (const f of readdirSync(KLASOR).filter((f) => f.endsWith(".png"))) {
    copyFileSync(join(KLASOR, f), join(REFERANS, f));
  }
  console.log(`\nReferans sabitlendi (${REFERANS}).`);
}

if (karsilastir) {
  if (!existsSync(REFERANS)) {
    console.error("Referans yok. Once: npm run ekran -- --referans");
    process.exit(1);
  }
  console.log("Karsilastirma icin: npm run ekran-fark");
}
