// tahvil_fiyatlama.py'ye karşı golden-value testleri -- fixture'lar
// /tmp'de gerçek Python fonksiyonları çağrılarak üretildi (bkz. commit
// mesajı). Burada TS portu (bond-math/tahvil-fiyatlama.ts) aynı girdiler
// için aynı çıktıyı üretiyor mu diye doğrulanıyor -- sessizce sapan bir
// hesap hatası (ör. gün sayımı, faiz formülü) buradan yakalanır.
import { describe, expect, it } from "vitest";
import {
  nakitAkislariniOlustur,
  kirliFiyatHesapla,
  birikmisFaizHesapla,
  getiriBul,
  modifiedDurationHesapla,
  dv01Hesapla,
  konveksiteHesapla,
} from "../bond-math/tahvil-fiyatlama";
import golden from "./fixtures/golden-bond-math.json";

function isoTarihe(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

describe("bond-math golden values (Python tahvil_fiyatlama.py'ye karşı)", () => {
  for (const vaka of golden) {
    const etiket = `${vaka.vade} kupon%${vaka.kuponPct} valor=${vaka.valor} getiri%${vaka.getiriPct}`;

    it(`kirli/temiz/birikmiş fiyat -- ${etiket}`, () => {
      const vade = isoTarihe(vaka.vade);
      const anchor = isoTarihe(vaka.anchor);
      const valor = isoTarihe(vaka.valor);
      const kuponOrani = vaka.kuponPct / 100;
      const getiri = vaka.getiriPct / 100;

      const akislar = nakitAkislariniOlustur(vade, anchor, kuponOrani);
      const kirli = kirliFiyatHesapla(akislar, valor, getiri);
      const birikmis = birikmisFaizHesapla(vade, anchor, valor, kuponOrani);
      const temiz = kirli - birikmis;

      expect(kirli).toBeCloseTo(vaka.kirli, 6);
      expect(birikmis).toBeCloseTo(vaka.birikmis, 6);
      expect(temiz).toBeCloseTo(vaka.temiz, 6);
    });

    it(`getiri geri çözümü (Newton-Raphson) -- ${etiket}`, () => {
      const vade = isoTarihe(vaka.vade);
      const anchor = isoTarihe(vaka.anchor);
      const valor = isoTarihe(vaka.valor);
      const kuponOrani = vaka.kuponPct / 100;

      const geriCozulen = getiriBul(vade, anchor, valor, kuponOrani, vaka.kirli);
      expect(geriCozulen * 100).toBeCloseTo(vaka.getiriGeriCozulen, 4);
    });

    it(`modified duration / DV01 / konveksite -- ${etiket}`, () => {
      const vade = isoTarihe(vaka.vade);
      const anchor = isoTarihe(vaka.anchor);
      const valor = isoTarihe(vaka.valor);
      const kuponOrani = vaka.kuponPct / 100;
      const getiri = vaka.getiriPct / 100;

      const akislar = nakitAkislariniOlustur(vade, anchor, kuponOrani);
      const { modified } = modifiedDurationHesapla(akislar, valor, getiri);
      const dv01 = dv01Hesapla(akislar, valor, getiri);
      const konveksite = konveksiteHesapla(akislar, valor, getiri);

      expect(modified).toBeCloseTo(vaka.modDur, 4);
      expect(dv01).toBeCloseTo(vaka.dv01, 4);
      expect(konveksite).toBeCloseTo(vaka.konveksite, 2);
    });
  }
});
