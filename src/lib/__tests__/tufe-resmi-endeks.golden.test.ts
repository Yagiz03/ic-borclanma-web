/**
 * HMB'nin RESMİ Referans Endeks tablosundan okunan Endeks Oranı'nın
 * Python (tahvil_fiyatlama.resmi_tufe_endeks_orani) ile birebir aynı
 * olduğunu doğrular.
 *
 * Neden var: site bu oranı EVDS'in aylık endeksinden kendisi interpole
 * ediyordu ve TÜFE'nin baz yılı değişimini (2003=100 -> 2025=100) tek
 * sürekli seri gibi ele aldığı için sapıyordu. 10.09.2026'da ölçülen fark:
 * çoğu kağıtta %0,05-0,3, TRT070727T13'te %38.
 */
import { describe, expect, it } from "vitest";

import { resmiTufeEndeksOrani, type ResmiEndeksTablosu } from "@/lib/bond-math/floater";
import altin from "./fixtures/tufe-resmi-endeks.json";

const tablo: ResmiEndeksTablosu = {
  gunluk: new Map(Object.entries(altin.gunluk)),
  ihrac: new Map(
    Object.entries(altin.kagitlar).map(([isin, k]) => [isin, [k.tabanYili, k.ihracEndeks]] as const),
  ),
};

describe("resmiTufeEndeksOrani", () => {
  const tarih = new Date(`${altin.tarih}T00:00:00Z`);

  for (const [isin, k] of Object.entries(altin.kagitlar)) {
    it(`${isin} — Python ile aynı oran`, () => {
      const oran = resmiTufeEndeksOrani(isin, tarih, tablo);
      expect(oran).not.toBeNull();
      expect(oran!).toBeCloseTo(k.beklenenOran, 10);
    });
  }

  it("tabloda olmayan ISIN icin null doner (cagiran EVDS yedegine duser)", () => {
    expect(resmiTufeEndeksOrani("YOK000000000", tarih, tablo)).toBeNull();
  });

  it("tablonun kapsamadigi tarih icin null doner", () => {
    expect(resmiTufeEndeksOrani(Object.keys(altin.kagitlar)[0], new Date("1999-01-01T00:00:00Z"), tablo)).toBeNull();
  });
});
