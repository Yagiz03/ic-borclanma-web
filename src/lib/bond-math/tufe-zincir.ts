/**
 * TÜFE endeks düzeyi serilerinin taban değişimi üzerinden zincirlenmesi.
 * Saf fonksiyon (veri erişimi yok) -- Python'daki core/data.py
 * ::tufe_duzey_serisi_yukle karşılığına karşı golden test ediliyor.
 */

export type SeriNoktalari = { tarihler: string[]; degerler: number[] };

/**
 * İki TÜFE endeks düzeyi serisini (eski 2003=100, yeni 2025=100) tek seriye
 * zincirler: ortak son ayı çapa alıp yeni seriyi eskinin ölçeğine çeker.
 * Saf fonksiyon -- Python'daki core/data.py karşılığına karşı golden test
 * ediliyor (floater.golden.test.ts).
 */
export function tufeSerileriniZincirle(eski: SeriNoktalari, yeni: SeriNoktalari): SeriNoktalari {
  if (yeni.tarihler.length === 0) return eski;
  if (eski.tarihler.length === 0) return yeni;

  const eskiH = new Map(eski.tarihler.map((t, i) => [t, eski.degerler[i]]));
  const yeniH = new Map(yeni.tarihler.map((t, i) => [t, yeni.degerler[i]]));
  const ortak = [...eskiH.keys()].filter((t) => yeniH.has(t)).sort();
  // Ortak ay yoksa zincirleme yapılamaz -- eski seriyle devam et (yanlış
  // ölçekli bir seri, eksik seriden daha tehlikeli olurdu).
  if (ortak.length === 0) return eski;

  const capa = ortak[ortak.length - 1];
  const capaYeni = yeniH.get(capa)!;
  if (!capaYeni) return eski;
  const katsayi = eskiH.get(capa)! / capaYeni;

  const birlesik = new Map(eskiH);
  for (const [t, v] of yeniH) if (t > capa) birlesik.set(t, v * katsayi);

  const tarihler = [...birlesik.keys()].sort();
  return { tarihler, degerler: tarihler.map((t) => birlesik.get(t)!) };
}
