/**
 * İhale Konsesyonu özet hesaplarının Python ile (core/ml_deneyler.py::
 * konsesyon_ozet_hesapla) birebir aynı sonucu verdiğini doğrular.
 *
 * Ağır kısım (NS fit) gece pipeline'ında; burada test edilen, sitenin dönem
 * filtrelerinde YENİDEN çalıştırdığı toplama/istatistik katmanı.
 */
import { describe, expect, it } from "vitest";

import { eventEgrisi, konsesyonOzeti, type KonsesyonIhale, type KonsesyonOlay } from "@/lib/konsesyon";
import fixture from "./fixtures/konsesyon.json";

const ihaleler = fixture.ihaleler as KonsesyonIhale[];
const olaylar = fixture.olaylar as KonsesyonOlay[];

describe("konsesyon özeti (TS = Python)", () => {
  const ozet = konsesyonOzeti(ihaleler);

  it("ihale sayısı", () => expect(ozet.nIhale).toBe(fixture.ozet.n_ihale));
  it("ihale öncesi ortalama spread", () =>
    expect(ozet.spreadOnceOrt!).toBeCloseTo(fixture.ozet.spread_once_ort!, 9));
  it("ihale sonrası ortalama spread", () =>
    expect(ozet.spreadSonraOrt!).toBeCloseTo(fixture.ozet.spread_sonra_ort!, 9));
  it("ortalama değişim (bps)", () =>
    expect(ozet.degisimOrt!).toBeCloseTo(fixture.ozet.degisim_ort!, 9));
  it("değişim standart sapması", () =>
    expect(ozet.degisimStd!).toBeCloseTo(fixture.ozet.degisim_std!, 9));
  it("t istatistiği", () => expect(ozet.tStat!).toBeCloseTo(fixture.ozet.t_stat!, 9));
  it("zenginleşen ihale oranı", () =>
    expect(ozet.zenginlesenOran!).toBeCloseTo(fixture.ozet.zenginlesen_oran!, 9));
  it("öncesi spread ↔ tail korelasyonu", () =>
    expect(ozet.korelasyonOnceTail!).toBeCloseTo(fixture.ozet.korelasyon_once_tail!, 9));
});

describe("olay eğrisi (TS = Python)", () => {
  const egri = eventEgrisi(olaylar);
  const beklenen = fixture.event as { offset: number; ortalama: number; adet: number; sem: number }[];

  it("aynı offset kümesi", () =>
    expect(egri.map((e) => e.offset)).toEqual(beklenen.map((e) => e.offset)));

  for (const b of beklenen) {
    it(`offset ${b.offset}: ortalama, adet ve standart hata`, () => {
      const e = egri.find((x) => x.offset === b.offset)!;
      expect(e.adet).toBe(b.adet);
      expect(e.ortalama).toBeCloseTo(b.ortalama, 9);
      expect(e.sem).toBeCloseTo(b.sem, 9);
    });
  }
});
