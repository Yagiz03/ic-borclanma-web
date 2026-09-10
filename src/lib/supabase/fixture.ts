import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Fixture modu: sayfalari canli Supabase yerine diske kaydedilmis
 * yanitlarla besler.
 *
 * Ne ise yarar: canli veri her gun degisiyor, bu yuzden tasarim
 * degisikliginden sonra ekran goruntusu karsilastirmasi (npm run ekran-fark)
 * hep gurultulu cikiyordu -- veri kaydigi icin. Fixture modunda ayni girdi
 * hep ayni ekrani veriyor, dolayisiyla farkin tamami senin degisikligin.
 * Ayrica internet olmadan da sayfalar acilir.
 *
 *   FIXTURE=kaydet npm run dev   -> gezindigin her sorgu diske yazilir
 *   FIXTURE=1      npm run dev   -> yalnizca diskten okunur
 *
 * Sorgular URL'nin (yol + query) SHA-1'i ile anahtarlanir, yani `.select()`
 * veya filtrelerden birini degistirdiginde o sorgunun fixture'i yeniden
 * kaydedilmelidir.
 *
 * Kullaniciya ozel tablolar da kaydedilir; fixture/ dizini gitignore'da.
 */
const MOD = process.env.FIXTURE;
export const fixtureAcik = MOD === "1" || MOD === "kaydet";
const KAYDET = MOD === "kaydet";
const DIZIN = join(process.cwd(), "fixture");

function anahtar(url: string, govde: string) {
  const u = new URL(url);
  const tablo = u.pathname.split("/").pop() || "sorgu";
  const ozet = createHash("sha1").update(u.pathname + u.search + govde).digest("hex").slice(0, 12);
  return join(DIZIN, `${tablo}-${ozet}.json`);
}

/** supabase-js'e `global: { fetch }` olarak verilir. */
export function fixtureFetch(): typeof fetch {
  return async (girdi, ayar) => {
    const url = typeof girdi === "string" ? girdi : girdi instanceof URL ? girdi.href : girdi.url;
    const govde = typeof ayar?.body === "string" ? ayar.body : "";
    const yol = anahtar(url, govde);

    if (!KAYDET) {
      try {
        return new Response(readFileSync(yol, "utf8"), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      } catch {
        console.warn(`[fixture] eksik: ${yol}\n           ${url}\n           FIXTURE=kaydet ile bir kez gezin.`);
        return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
      }
    }

    const yanit = await fetch(girdi, ayar);
    const metin = await yanit.clone().text();
    if (yanit.ok) {
      mkdirSync(DIZIN, { recursive: true });
      writeFileSync(yol, metin);
    }
    return yanit;
  };
}
