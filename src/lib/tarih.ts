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

export function isoTarihGoster(deger: string | null | undefined): string {
  const d = trTarihAyristir(deger);
  return d ? d.toLocaleDateString("tr-TR") : "–";
}
