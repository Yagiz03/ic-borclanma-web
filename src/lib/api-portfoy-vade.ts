/**
 * TCMB APİ portföyünün vade analizleri -- pages/tcmb_gostergeler.py'deki
 * "Vade dağılımı (kalan vadeye göre)" ve "Ağırlıklı ortalama kalan vade --
 * son 5 yıl (gün gün)" bölümlerinin hesap çekirdeği.
 */

export const VADE_KOVALARI = ["1 yıldan kısa", "1-2 yıl", "2-5 yıl", "5 yıldan uzun"] as const;
export type VadeKovasi = (typeof VADE_KOVALARI)[number];

/** Kalan gün -> vade kovası (Python'daki _vade_bucket_bul ile birebir). */
export function vadeKovasiBul(kalanGun: number): VadeKovasi {
  const kalanYil = kalanGun / 365.25;
  if (kalanYil < 1) return "1 yıldan kısa";
  if (kalanYil < 2) return "1-2 yıl";
  if (kalanYil < 5) return "2-5 yıl";
  return "5 yıldan uzun";
}

export type AlimKaydi = { ihaleMs: number; vadeMs: number; nominalMn: number };

/**
 * Her gün için portföyde HÂLÂ aktif olan kağıtların NOMİNAL AĞIRLIKLI ortalama
 * kalan vadesi (yıl). Bir alım kendi ihale tarihinde deftere girer, vade
 * tarihinde tamamen düşer -- Python tarafındaki aynı defter mantığı.
 *
 * Python'da (gün x işlem) numpy matrisi kuruluyor; burada aynı sonucu veren
 * ama bellek harcamayan bir döngü var (~1.150 işlem x ~1.825 gün).
 */
export function agirlikliOrtalamaKalanVade(
  alimlar: AlimKaydi[],
  baslangicMs: number,
  bitisMs: number,
): { tarih: string; ortVadeYil: number }[] {
  const GUN = 86_400_000;
  const sonuc: { tarih: string; ortVadeYil: number }[] = [];
  for (let g = baslangicMs; g <= bitisMs; g += GUN) {
    let toplamNominal = 0;
    let agirlikliToplam = 0;
    for (const a of alimlar) {
      if (g < a.ihaleMs || g >= a.vadeMs) continue;
      const kalanYil = (a.vadeMs - g) / GUN / 365.25;
      toplamNominal += a.nominalMn;
      agirlikliToplam += a.nominalMn * kalanYil;
    }
    if (toplamNominal > 0) {
      sonuc.push({
        tarih: new Date(g).toISOString().slice(0, 10),
        ortVadeYil: agirlikliToplam / toplamNominal,
      });
    }
  }
  return sonuc;
}
