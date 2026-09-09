/**
 * "Fiyattan getiriye" yönünün SÖZLEŞMESİ.
 *
 * Bu port bir kez yanlış yapıldı: varsayılan yön "Getiriden fiyata" idi ve
 * fiyat girdisi KİRLİ fiyat olarak etiketlenmişti. Eski sitede
 * (pages/pricing.py:828-861) varsayılan "Fiyattan getiriye" ve girdi TEMİZ
 * fiyat. Aşağıdaki test o davranışı sabitliyor: temiz fiyat girilip getiri
 * bulunduğunda, aynı getiriden geri hesaplanan temiz fiyat girdiye eşit
 * dönmeli -- yani girdinin temiz mi kirli mi olduğu karışırsa test kırılır.
 */
import { describe, expect, it } from "vitest";
import {
  birikmisFaizHesapla,
  getiriBul,
  temizFiyatHesapla,
} from "@/lib/bond-math/tahvil-fiyatlama";

const VADE = new Date(Date.UTC(2027, 6, 14));
const ANCHOR = new Date(Date.UTC(2025, 6, 14));
const VALOR = new Date(Date.UTC(2026, 8, 9));
const KUPON = 0.268;

describe("Fiyattan getiriye yönü", () => {
  it("girdi TEMİZ fiyattır: temiz -> getiri -> temiz gidiş dönüşü aynı sayıyı verir", () => {
    const temizGirdi = 100;

    // Sayfanın yaptığı hesabın aynısı: birikmiş faiz getiriden bağımsız,
    // temizin üstüne eklenip kirli kuruluyor, getiri kirliden bulunuyor.
    const birikmis = birikmisFaizHesapla(VADE, ANCHOR, VALOR, KUPON);
    const kirli = temizGirdi + birikmis;
    const getiri = getiriBul(VADE, ANCHOR, VALOR, KUPON, kirli);

    const geri = temizFiyatHesapla(VADE, ANCHOR, VALOR, KUPON, getiri);

    expect(geri.temiz).toBeCloseTo(temizGirdi, 6);
    expect(geri.kirli).toBeCloseTo(kirli, 6);
    expect(geri.birikmis).toBeCloseTo(birikmis, 10);
  });

  it("girdiyi KİRLİ sanmak farklı bir getiri verir (hatanın kendisi)", () => {
    const temizGirdi = 100;
    const birikmis = birikmisFaizHesapla(VADE, ANCHOR, VALOR, KUPON);

    const dogru = getiriBul(VADE, ANCHOR, VALOR, KUPON, temizGirdi + birikmis);
    const yanlis = getiriBul(VADE, ANCHOR, VALOR, KUPON, temizGirdi);

    // Birikmiş faiz sıfır olmadığı sürece iki sonuç aynı OLAMAZ; bu test
    // yukarıdaki iddianın boş olmadığını gösteriyor.
    expect(birikmis).toBeGreaterThan(0);
    expect(Math.abs(dogru - yanlis)).toBeGreaterThan(0.01);
  });
});
