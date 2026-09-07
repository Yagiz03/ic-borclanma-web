// core/takas_repo.py'ye karşı golden-value testleri.
import { describe, expect, it } from "vitest";
import { takasHesapla, mevduatHesapla } from "../takas-repo";
import golden from "./fixtures/golden-takas-repo.json";

function isoTarihe(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

describe("takas-repo golden values (Python core/takas_repo.py'ye karşı)", () => {
  for (const vaka of golden) {
    const baslangic = isoTarihe(vaka.baslangic);
    const etiket = `gün=${vaka.gun} oran=${vaka.oran} başlangıç=${vaka.baslangic}`;

    it(`takasHesapla -- ${etiket}`, () => {
      const r = takasHesapla(vaka.gun, vaka.oran, baslangic);
      expect(r.getiri).toBeCloseTo(vaka.takas.getiri, 6);
      expect(r.isGunu).toBe(vaka.takas.is_gunu);
      expect(r.onEslenik).toBeCloseTo(vaka.takas.on_eslenik, 6);
      expect(r.netOnEslenik).toBeCloseTo(vaka.takas.net_on_eslenik, 6);
      expect(r.mevduatEslenigi).toBeCloseTo(vaka.takas.mevduat_eslenigi, 6);
    });

    it(`mevduatHesapla -- ${etiket}`, () => {
      const r = mevduatHesapla(vaka.gun, vaka.oran, baslangic);
      expect(r.getiri).toBeCloseTo(vaka.mevduat.getiri, 6);
      expect(r.isGunu).toBe(vaka.mevduat.is_gunu);
      expect(r.onEslenik).toBeCloseTo(vaka.mevduat.on_eslenik, 6);
      expect(r.netOnEslenik).toBeCloseTo(vaka.mevduat.net_on_eslenik, 6);
      expect(r.takasEslenigi).toBeCloseTo(vaka.mevduat.takas_eslenigi, 6);
    });
  }
});
