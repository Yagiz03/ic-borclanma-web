/**
 * Golden-value test: tlrefKirliPatika, Python'daki
 * core/tlref_senaryo.py::tlref_kirli_patika'nın GERÇEK çıktılarıyla
 * karşılaştırılır (fixtures/golden-tlref-senaryo.json).
 *
 * Bu hesap iş günü bloklarına ve TR tatil takvimine bağlı; iki taraf aynı
 * tatil listesini kullanmazsa sonuç sessizce kayar -- o yüzden gün gün
 * karşılaştırılıyor.
 */
import { describe, expect, it } from "vitest";
import { tlrefKirliPatika } from "../takas-repo";
import goldenHam from "./fixtures/golden-tlref-senaryo.json";

const g = (s: string) => new Date(`${s}T00:00:00Z`);

type Senaryo = {
  ad: string;
  temiz: number;
  birikmis: number;
  gun: number;
  oranlar: [string, number][];
  kuponlar: string[];
  ek: number;
  bas: string;
  beklenenPatika: Record<string, number>;
  beklenenOdemeler: Record<string, number>;
};

// JSON'dan gelen [tarih, oran] çiftleri (string | number)[] olarak
// çıkarsanıyor; tuple tipine burada bir kez daraltılıyor.
const golden = goldenHam as unknown as Senaryo[];

describe("tlrefKirliPatika (PPK sonrası TLREF senaryosu)", () => {
  for (const s of golden) {
    it(s.ad, () => {
      const { patika, odemeler } = tlrefKirliPatika(
        s.temiz,
        s.birikmis,
        s.gun,
        s.oranlar.map(([t, o]) => ({ baslangic: g(t), oran: o })),
        s.kuponlar.map(g),
        s.ek,
        g(s.bas),
      );

      const beklenenGunler = Object.keys(s.beklenenPatika).sort();
      expect([...patika.keys()].sort()).toEqual(beklenenGunler);
      for (const gun of beklenenGunler) {
        expect(patika.get(gun)!).toBeCloseTo(s.beklenenPatika[gun], 10);
      }

      expect([...odemeler.keys()].sort()).toEqual(Object.keys(s.beklenenOdemeler).sort());
      for (const [gun, deger] of Object.entries(s.beklenenOdemeler)) {
        expect(odemeler.get(gun)!).toBeCloseTo(deger, 10);
      }
    });
  }

  it("kupon gününde birikmiş sıfırlanır (kirli = temiz)", () => {
    const s = golden[0];
    const { patika } = tlrefKirliPatika(
      s.temiz, s.birikmis, s.gun,
      s.oranlar.map(([t, o]) => ({ baslangic: g(t), oran: o })),
      s.kuponlar.map(g), s.ek, g(s.bas),
    );
    expect(patika.get(s.kuponlar[0])!).toBeCloseTo(s.temiz, 10);
  });

  it("ufukta kupon yoksa hiç ödeme üretmez", () => {
    const s = golden.find((x) => x.ad.includes("kupon yok"))!;
    const { odemeler } = tlrefKirliPatika(
      s.temiz, s.birikmis, s.gun,
      s.oranlar.map(([t, o]) => ({ baslangic: g(t), oran: o })),
      s.kuponlar.map(g), s.ek, g(s.bas),
    );
    expect(odemeler.size).toBe(0);
  });
});
