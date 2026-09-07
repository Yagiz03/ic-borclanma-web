// core/rv_analiz.py'ye karşı golden-value testleri.
import { describe, expect, it } from "vitest";
import { nelsonSiegelFit, tlrefBilesikFonlama } from "../rv-analiz";
import golden from "./fixtures/golden-nelson-siegel.json";

describe("Nelson-Siegel fit golden values (Python core/rv_analiz.py'ye karşı)", () => {
  it("aynı tau ve beta parametrelerini bulur", () => {
    const fit = nelsonSiegelFit(golden.vadeler, golden.getiriler);
    expect(fit).not.toBeNull();
    expect(fit!.params.tau).toBeCloseTo(golden.params.tau, 6);
    expect(fit!.params.b0).toBeCloseTo(golden.params.b0, 4);
    expect(fit!.params.b1).toBeCloseTo(golden.params.b1, 4);
    expect(fit!.params.b2).toBeCloseTo(golden.params.b2, 4);
  });

  it("fit noktalarında Python ile aynı tahmini üretir", () => {
    const fit = nelsonSiegelFit(golden.vadeler, golden.getiriler)!;
    const tahminler = fit.tahmin(golden.vadeler) as number[];
    golden.tahminlerAyniNoktalar.forEach((beklenen, i) => {
      expect(tahminler[i]).toBeCloseTo(beklenen, 3);
    });
  });

  it("veri setinde olmayan vadeler için de aynı tahmini üretir", () => {
    const fit = nelsonSiegelFit(golden.vadeler, golden.getiriler)!;
    const tahminler = fit.tahmin(golden.ekstraVadeler) as number[];
    golden.ekstraTahminler.forEach((beklenen, i) => {
      expect(tahminler[i]).toBeCloseTo(beklenen, 3);
    });
  });
});

describe("tlrefBilesikFonlama golden values", () => {
  it("%36.9 basit oranı doğru bileşiğe çevirir", () => {
    expect(tlrefBilesikFonlama(36.9)).toBeCloseTo(golden.tlrefBilesik_36_9, 4);
  });
  it("%44.2 basit oranı doğru bileşiğe çevirir", () => {
    expect(tlrefBilesikFonlama(44.2)).toBeCloseTo(golden.tlrefBilesik_44_2, 4);
  });
});
