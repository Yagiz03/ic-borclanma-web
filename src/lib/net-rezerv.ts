/**
 * TCMB Net Rezerv (NUR) hesabı -- core/net_rezerv.py'nin TS portu.
 *
 * Brüt Rezerv (USD) = (Dış Varlıklar - Döviz Yükümlülükleri) * 1000 / kur
 * Lokal Swap Stok (USD) = (alım yönlü - satım yönlü) * 1e6
 * Toplam Swap'ın "çıpa" (as-of) noktaları: haftalık URDL tablosu (II.2+II.3)
 * -- haftalık birikimin başlamadığı eski dönem için EVDS'nin aylık ay-sonu
 * serisi. Her çıpada Yabancı Swap = Toplam - Lokal(o günkü); ara günlerde
 * Yabancı son çıpadan sabit taşınır (ffill), Toplam = Yabancı + Lokal(t).
 * Net Rezerv = Brüt Rezerv + Toplam Swap.
 */

const BASLANGIC = "2025-01-01";

export type GunlukNetRezerv = {
  tarih: string;
  brutRezerv: number;
  lokalSwap: number;
  yabanciSwap: number;
  toplamSwap: number;
  netRezerv: number;
  cipaKaynak: "haftalık" | "aylık";
};

type SeriRow = { tarih: string; deger: number | null };

function seriyeCevir(rows: SeriRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) if (r.deger != null) m.set(r.tarih, r.deger);
  return m;
}

/** sortedDates içinde hedefTarih'e eşit ya da ondan küçük en büyük tarihin indeksi (yoksa -1). */
function asOfIndex(sortedDates: string[], hedefTarih: string): number {
  let lo = 0, hi = sortedDates.length - 1, sonuc = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedDates[mid] <= hedefTarih) {
      sonuc = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return sonuc;
}

export function netRezervHesapla(
  disvarRows: SeriRow[],
  yukumRows: SeriRow[],
  kurRows: SeriRow[],
  alimRows: SeriRow[],
  satimRows: SeriRow[],
  urdlHaftalik: { tarih: string; forward_future: number | null; diger: number | null }[],
  urdlFfAylikRows: SeriRow[],
  urdlDigerAylikRows: SeriRow[],
): GunlukNetRezerv[] {
  const disvar = seriyeCevir(disvarRows);
  const yukum = seriyeCevir(yukumRows);
  const kur = seriyeCevir(kurRows);
  const alim = seriyeCevir(alimRows);
  const satim = seriyeCevir(satimRows);

  const alimTarihleri = [...alim.keys()].sort();
  const satimTarihleri = [...satim.keys()].sort();

  const gunlukTarihleri = [...disvar.keys()]
    .filter((t) => yukum.has(t) && kur.has(t) && t >= BASLANGIC)
    .sort();

  const gunluk: { tarih: string; brutRezerv: number; lokalSwap: number }[] = [];
  for (const t of gunlukTarihleri) {
    const aIdx = asOfIndex(alimTarihleri, t);
    const sIdx = asOfIndex(satimTarihleri, t);
    if (aIdx < 0 || sIdx < 0) continue;
    const a = alim.get(alimTarihleri[aIdx])!;
    const s = satim.get(satimTarihleri[sIdx])!;
    const brut = ((disvar.get(t)! - yukum.get(t)!) * 1000) / kur.get(t)!;
    const lokal = (a - s) * 1_000_000;
    gunluk.push({ tarih: t, brutRezerv: brut, lokalSwap: lokal });
  }
  if (gunluk.length === 0) return [];

  const gunlukTarihSirali = gunluk.map((g) => g.tarih);
  const lokalMap = new Map(gunluk.map((g) => [g.tarih, g.lokalSwap]));

  type Cipa = { tarih: string; toplamSwap: number; kaynak: "haftalık" | "aylık" };

  const haftalikCipa: Cipa[] = urdlHaftalik
    .filter((r) => r.forward_future != null && r.diger != null)
    .map((r) => ({
      tarih: r.tarih,
      toplamSwap: (r.forward_future! + r.diger!) * 1_000_000,
      kaynak: "haftalık" as const,
    }))
    .sort((a, b) => a.tarih.localeCompare(b.tarih));

  const ffAylik = seriyeCevir(urdlFfAylikRows);
  const digerAylik = seriyeCevir(urdlDigerAylikRows);
  const ilkHaftalikTarih = haftalikCipa.length > 0 ? haftalikCipa[0].tarih : null;
  const aylikCipa: Cipa[] = [...ffAylik.keys()]
    .filter((t) => digerAylik.has(t))
    .map((t) => {
      // EVDS aylık damgası ayın 1'i -- deger ay SONU stoku, ay sonuna kaydır.
      const [y, m] = t.split("-").map(Number);
      const aySonu = new Date(Date.UTC(y, m, 0));
      const aySonuStr = aySonu.toISOString().slice(0, 10);
      return { tarih: aySonuStr, toplamSwap: (ffAylik.get(t)! + digerAylik.get(t)!) * 1_000_000, kaynak: "aylık" as const };
    })
    .filter((c) => ilkHaftalikTarih == null || c.tarih < ilkHaftalikTarih);

  let tumCipalar = [...aylikCipa, ...haftalikCipa].sort((a, b) => a.tarih.localeCompare(b.tarih));
  const gorulen = new Set<string>();
  tumCipalar = tumCipalar.filter((c) => {
    if (gorulen.has(c.tarih)) return false;
    gorulen.add(c.tarih);
    return true;
  });
  tumCipalar = tumCipalar.filter((c) => c.tarih >= BASLANGIC);
  if (tumCipalar.length === 0) return [];

  const cipaYabanci: { tarih: string; yabanciSwap: number; kaynak: "haftalık" | "aylık" }[] = [];
  for (const c of tumCipalar) {
    const idx = asOfIndex(gunlukTarihSirali, c.tarih);
    if (idx < 0) continue;
    const lokalAsOf = lokalMap.get(gunlukTarihSirali[idx])!;
    cipaYabanci.push({ tarih: c.tarih, yabanciSwap: c.toplamSwap - lokalAsOf, kaynak: c.kaynak });
  }
  if (cipaYabanci.length === 0) return [];

  const cipaTarihleri = cipaYabanci.map((c) => c.tarih);
  const yabanciMap = new Map(cipaYabanci.map((c) => [c.tarih, c.yabanciSwap]));
  const kaynakMap = new Map(cipaYabanci.map((c) => [c.tarih, c.kaynak]));

  const sonuc: GunlukNetRezerv[] = [];
  for (const g of gunluk) {
    const idx = asOfIndex(cipaTarihleri, g.tarih);
    if (idx < 0) continue;
    const anchorTarih = cipaTarihleri[idx];
    const yabanciSwap = yabanciMap.get(anchorTarih)!;
    const cipaKaynak = kaynakMap.get(anchorTarih)!;
    const toplamSwap = yabanciSwap + g.lokalSwap;
    sonuc.push({
      tarih: g.tarih,
      brutRezerv: g.brutRezerv,
      lokalSwap: g.lokalSwap,
      yabanciSwap,
      toplamSwap,
      netRezerv: g.brutRezerv + toplamSwap,
      cipaKaynak,
    });
  }
  return sonuc;
}
