/**
 * isin_ozet/ihale_sonuclari gibi tabloların tarih kolonları Postgres'te
 * `text` -- SQLite kaynağıyla aynı ham metin ("DD.MM.YYYY" ya da ISO
 * "YYYY-MM-DD...") korunuyor. Metin olarak sıralamak (`.order()`)
 * kronolojik olarak YANLIŞ sonuç verir (ör. "01.03.2028" < "01.10.2025"
 * sözlük sırasında) -- bu yüzden sıralama/karşılaştırma hep bu
 * yardımcılardan geçmeli.
 */
export function trTarihAyristir(deger: string | null | undefined): Date | null {
  if (!deger) return null;
  const parca = deger.slice(0, 10);
  if (parca.includes(".")) {
    const [gun, ay, yil] = parca.split(".");
    if (!gun || !ay || !yil) return null;
    const d = new Date(Number(yil), Number(ay) - 1, Number(gun));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(parca);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function trTarihSirala<T>(satirlar: T[], tarihAl: (satir: T) => string | null | undefined): T[] {
  return [...satirlar].sort((a, b) => {
    const ta = trTarihAyristir(tarihAl(a));
    const tb = trTarihAyristir(tarihAl(b));
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    return ta.getTime() - tb.getTime();
  });
}

/** "4.10.2028" / "04.10.2028" -> "04.10.2028" -- ihrac_takvimi gibi bazı
 * kaynaklarda gün/ay sıfır doldurmasız gelebiliyor, ihale_sonuclari'nın
 * DD.MM.YYYY biçimiyle eşleştirmek için normalize eder. */
export function trTarihPadle(deger: string | null | undefined): string | null {
  if (!deger) return null;
  const parca = deger.trim().split(".");
  if (parca.length !== 3) return null;
  const [g, a, y] = parca;
  return `${g.padStart(2, "0")}.${a.padStart(2, "0")}.${y}`;
}

export function isoTarihGoster(deger: string | null | undefined): string {
  const d = trTarihAyristir(deger);
  return d ? d.toLocaleDateString("tr-TR") : "–";
}

/** isin_ozet'in text tarih kolonlarını (DD.MM.YYYY ya da ISO YYYY-MM-DD...)
 * bond-math motorunun beklediği UTC gece yarısı Date'e çevirir -- yerel
 * saat dilimi kaymasının gün sayımını bozmaması için, string'ten DOĞRUDAN
 * yıl/ay/gün okuyarak (ara adımda yerel saatli bir Date'e hiç uğramadan;
 * bkz. tahvil-fiyatlama.ts). */
export function utcTarihe(deger: string | null | undefined): Date | null {
  if (!deger) return null;
  const parca = deger.slice(0, 10);
  if (parca.includes(".")) {
    const [gun, ay, yil] = parca.split(".").map(Number);
    if (!gun || !ay || !yil) return null;
    return new Date(Date.UTC(yil, ay - 1, gun));
  }
  const [yil, ay, gun] = parca.split("-").map(Number);
  if (!yil || !ay || !gun) return null;
  return new Date(Date.UTC(yil, ay - 1, gun));
}
