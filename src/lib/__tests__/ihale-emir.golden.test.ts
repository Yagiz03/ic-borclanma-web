/**
 * Golden-value test: emirOzetHesapla, Python'daki
 * pages/ihale_gunu.py::_emir_ozet_hesapla'nın GERÇEK çıktılarıyla
 * karşılaştırılır (fixtures/golden-ihale-emir.json).
 */
import { describe, expect, it } from "vitest";
import { emirOzetHesapla, type Emir } from "../ihale-emir";
import golden from "./fixtures/golden-ihale-emir.json";

type Beklenen = {
  emirler: (Emir & { geldi: boolean | null })[];
  toplam_talep: number;
  toplam_gerceklesen: number | null;
  gerceklesme_orani: number | null;
  ort_gerceklesen_fiyat: number | null;
};

describe("emirOzetHesapla (çoklu fiyat ihalesi kuralı)", () => {
  for (const k of golden as { ad: string; emirler: Emir[]; kesmeFiyati: number | null; beklenen: Beklenen }[]) {
    it(k.ad, () => {
      const s = emirOzetHesapla(k.emirler, k.kesmeFiyati);
      const b = k.beklenen;

      expect(s.emirler.map((e) => e.geldi)).toEqual(b.emirler.map((e) => e.geldi));
      expect(s.toplamTalep).toBe(b.toplam_talep);
      expect(s.toplamGerceklesen).toBe(b.toplam_gerceklesen);

      for (const [ts, py] of [
        [s.gerceklesmeOrani, b.gerceklesme_orani],
        [s.ortGerceklesenFiyat, b.ort_gerceklesen_fiyat],
      ] as const) {
        if (py === null) expect(ts).toBeNull();
        else expect(ts!).toBeCloseTo(py, 10);
      }
    });
  }
});

describe("emirOzetHesapla — kenar durumlar", () => {
  it("kesme fiyatına EŞİT emir gerçekleşir (>= kuralı)", () => {
    const s = emirOzetHesapla([{ id: "a", fiyat: 98.5, nominal: 100 }], 98.5);
    expect(s.emirler[0].geldi).toBe(true);
    expect(s.toplamGerceklesen).toBe(100);
  });

  it("kesme fiyatının bir kuruş altındaki emir gerçekleşmez", () => {
    const s = emirOzetHesapla([{ id: "a", fiyat: 98.49, nominal: 100 }], 98.5);
    expect(s.emirler[0].geldi).toBe(false);
    expect(s.toplamGerceklesen).toBe(0);
    expect(s.ortGerceklesenFiyat).toBeNull();
  });

  it("kesme fiyatı bilinmiyorsa hiçbir emir işaretlenmez", () => {
    const s = emirOzetHesapla([{ id: "a", fiyat: 98.5, nominal: 100 }], null);
    expect(s.emirler[0].geldi).toBeNull();
    expect(s.gerceklesmeOrani).toBeNull();
  });

  it("ortalama fiyat nominal ağırlıklıdır (basit ortalama değil)", () => {
    const s = emirOzetHesapla(
      [
        { id: "a", fiyat: 100, nominal: 900 },
        { id: "b", fiyat: 110, nominal: 100 },
      ],
      99,
    );
    expect(s.ortGerceklesenFiyat).toBeCloseTo(101, 10); // basit ortalama 105 olurdu
  });

  it("boş liste sıfır talep verir, orana bölme yapmaz", () => {
    const s = emirOzetHesapla([], 98.5);
    expect(s.toplamTalep).toBe(0);
    expect(s.gerceklesmeOrani).toBeNull();
  });
});
