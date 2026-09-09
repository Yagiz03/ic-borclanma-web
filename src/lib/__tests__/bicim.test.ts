/**
 * Biçimlendirme birliği. Bu testlerin asıl işi bir regresyonu önlemek:
 * `toFixed()` yerelden bağımsız NOKTA üretiyor, bu yüzden yüzdeler
 * `%35.12`, yanındaki sayılar `281,9` olarak çıkıyordu.
 */
import { describe, expect, it } from "vitest";
import { BOS, bps, milyarTl, milyonTl, sayi, sayiEsnek, tl, yuzde } from "../bicim";

describe("yuzde", () => {
  it("ondalık ayracı VİRGÜL, işaret önde", () => {
    expect(yuzde(35.12)).toBe("%35,12");
    expect(yuzde(0)).toBe("%0,00");
    expect(yuzde(-3.5)).toBe("%-3,50");
  });

  it("hiçbir çıktıda nokta ondalık ayracı olmaz", () => {
    for (const v of [1.5, 99.999, 0.01, 1234.5]) {
      expect(yuzde(v)).not.toMatch(/\.\d+$/);
    }
  });

  it("ondalık basamağı ayarlanabilir", () => {
    expect(yuzde(35.126, 1)).toBe("%35,1");
    expect(yuzde(35.4, 0)).toBe("%35");
  });
});

describe("sayi / sayiEsnek", () => {
  it("binlik ayracı NOKTA, ondalık VİRGÜL", () => {
    expect(sayi(1234.5, 2)).toBe("1.234,50");
    expect(sayi(1234567, 0)).toBe("1.234.567");
  });

  it("sayiEsnek gereksiz sıfır yazmaz", () => {
    expect(sayiEsnek(1234.5, 2)).toBe("1.234,5");
    expect(sayiEsnek(1235, 2)).toBe("1.235");
  });
});

describe("bps", () => {
  it("artıyı açıkça işaretler", () => {
    expect(bps(86)).toBe("+86 bps");
    expect(bps(-364)).toBe("-364 bps");
    expect(bps(0)).toBe("+0 bps");
  });
});

describe("para birimleri", () => {
  it("tek bir birim sözlüğü kullanır", () => {
    expect(milyonTl(725)).toBe("725 Mn TL");
    expect(milyarTl(281.9)).toBe("281,9 Mlr TL");
    expect(tl(245848127)).toBe("245.848.127 TL");
  });
});

describe("boş değerler", () => {
  it("null / undefined / boş metin tire döner", () => {
    for (const f of [sayi, sayiEsnek, yuzde, bps, milyonTl, milyarTl, tl]) {
      expect(f(null)).toBe(BOS);
      expect(f(undefined)).toBe(BOS);
      expect(f("")).toBe(BOS);
    }
  });

  it("sayıya çevrilemeyen metin de tire döner", () => {
    expect(yuzde("abc")).toBe(BOS);
    expect(sayi("–")).toBe(BOS);
  });

  it("metin olarak gelen sayıyı kabul eder (Postgres numeric)", () => {
    expect(yuzde("35.12")).toBe("%35,12");
    expect(sayi("1234.5", 1)).toBe("1.234,5");
  });
});
