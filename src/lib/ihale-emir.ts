/** Çoklu fiyat ihalesi kuralı: fiyatı kesme fiyatına (en düşük gerçekleşen
 * fiyat) eşit ya da yüksek olan emirler KENDİ fiyatından gerçekleşir,
 * altındakiler gerçekleşmez -- core/ihale_gunu.py::_emir_ozet_hesapla'nın
 * TS portu. */
export type Emir = { id: string; fiyat: number; nominal: number };

export type EmirOzet = {
  emirler: (Emir & { geldi: boolean | null })[];
  toplamTalep: number;
  toplamGerceklesen: number | null;
  gerceklesmeOrani: number | null;
  ortGerceklesenFiyat: number | null;
};

export function emirOzetHesapla(emirler: Emir[], kesmeFiyati: number | null): EmirOzet {
  const toplamTalep = emirler.reduce((s, e) => s + e.nominal, 0);
  if (kesmeFiyati == null) {
    return {
      emirler: emirler.map((e) => ({ ...e, geldi: null })),
      toplamTalep, toplamGerceklesen: null, gerceklesmeOrani: null, ortGerceklesenFiyat: null,
    };
  }
  const isaretli = emirler.map((e) => ({ ...e, geldi: e.fiyat >= kesmeFiyati }));
  const gerceklesenler = isaretli.filter((e) => e.geldi);
  const toplamGerceklesen = gerceklesenler.reduce((s, e) => s + e.nominal, 0);
  const ortGerceklesenFiyat = toplamGerceklesen
    ? gerceklesenler.reduce((s, e) => s + e.fiyat * e.nominal, 0) / toplamGerceklesen
    : null;
  return {
    emirler: isaretli, toplamTalep, toplamGerceklesen,
    gerceklesmeOrani: toplamTalep ? (toplamGerceklesen / toplamTalep) * 100 : null,
    ortGerceklesenFiyat,
  };
}
