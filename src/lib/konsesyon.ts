/**
 * İhale Konsesyonu (Event Study) özet hesapları.
 *
 * core/ml_deneyler.py::konsesyon_ozet_hesapla'nın TS karşılığı. Ağır kısım
 * (Nelson-Siegel eğrisinin ~1600 gün için yeniden uydurulması) gece
 * pipeline'ında yapılıp konsesyon_olay / konsesyon_ihale tablolarına
 * yazılıyor; burada yalnızca dönem filtresine göre YENİDEN toplama var --
 * eski sayfada da aynı ayrım vardı (fit'i tekrarlamadan filtre değiştirmek).
 */

export type KonsesyonOlay = {
  isin: string;
  ihale_dt: string;
  offset: number;
  spread_bps: number | null;
};

export type KonsesyonIhale = {
  isin: string;
  ihale_tarihi: string;
  senet_tanimi: string | null;
  spread_once: number | null;
  spread_sonra: number | null;
  degisim_bps: number | null;
  tail_bps: number | null;
  bid_to_cover: number | null;
};

export type EventNoktasi = { offset: number; ortalama: number; adet: number; sem: number };

export type KonsesyonOzeti = {
  nIhale: number;
  spreadOnceOrt: number | null;
  spreadSonraOrt: number | null;
  degisimOrt: number | null;
  degisimStd: number | null;
  /** |t| > ~2 kaba %5 anlamlılık kuralı. n<2'de null. */
  tStat: number | null;
  /** Değişimi NEGATİF olan (beklenen yön: ihale sonrası zenginleşme) ihale yüzdesi. */
  zenginlesenOran: number | null;
  korelasyonOnceTail: number | null;
};

const ort = (v: number[]) => (v.length === 0 ? null : v.reduce((a, b) => a + b, 0) / v.length);

/** Örneklem standart sapması (ddof=1) -- Python'daki std(ddof=1) ile aynı. */
function stdOrneklem(v: number[]): number | null {
  if (v.length < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

function korelasyon(x: number[], y: number[]): number | null {
  if (x.length <= 4) return null;
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  const payda = Math.sqrt(sxx * syy);
  return payda === 0 ? null : sxy / payda;
}

/** Offset bazlı olay eğrisi: her offset için ortalama spread ve standart hata. */
export function eventEgrisi(olaylar: KonsesyonOlay[]): EventNoktasi[] {
  const gruplar = new Map<number, number[]>();
  for (const o of olaylar) {
    if (o.spread_bps == null) continue;
    (gruplar.get(o.offset) ?? gruplar.set(o.offset, []).get(o.offset)!).push(o.spread_bps);
  }
  return [...gruplar.entries()]
    .map(([offset, v]) => {
      const s = stdOrneklem(v);
      return {
        offset,
        ortalama: ort(v)!,
        adet: v.length,
        sem: s == null ? 0 : s / Math.sqrt(v.length),
      };
    })
    .sort((a, b) => a.offset - b.offset);
}

export function konsesyonOzeti(ihaleler: KonsesyonIhale[]): KonsesyonOzeti {
  const fark = ihaleler.map((i) => i.degisim_bps).filter((v): v is number => v != null);
  const std = stdOrneklem(fark);
  const ikili = ihaleler.filter((i) => i.spread_once != null && i.tail_bps != null);

  return {
    nIhale: ihaleler.length,
    spreadOnceOrt: ort(ihaleler.map((i) => i.spread_once).filter((v): v is number => v != null)),
    spreadSonraOrt: ort(ihaleler.map((i) => i.spread_sonra).filter((v): v is number => v != null)),
    degisimOrt: ort(fark),
    degisimStd: std,
    // scipy yok -- Python tarafındaki gibi normal yaklaşıklığıyla manuel t.
    tStat: fark.length > 1 && std && std > 0 ? ort(fark)! / (std / Math.sqrt(fark.length)) : null,
    zenginlesenOran:
      fark.length === 0 ? null : (fark.filter((v) => v < 0).length / fark.length) * 100,
    korelasyonOnceTail: korelasyon(
      ikili.map((i) => i.spread_once!),
      ikili.map((i) => i.tail_bps!),
    ),
  };
}
