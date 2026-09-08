/**
 * Tarih yardımcıları. Bu modül veri katmanının en sessiz hata kaynağı:
 * tabloların tarih kolonları Postgres'te `text` ve iki AYRI biçim
 * ("DD.MM.YYYY" ve ISO "YYYY-MM-DD...") aynı şemada yan yana bulunabiliyor.
 * Metin olarak sıralamak kronolojik olarak yanlış sonuç verdiği için
 * (modül docstring'indeki uyarı) o tuzak burada açıkça test ediliyor.
 */
import { describe, expect, it } from "vitest";
import {
  isoTarihGoster,
  trTarihAyristir,
  trTarihPadle,
  trTarihSirala,
  utcTarihe,
} from "../tarih";

describe("trTarihAyristir", () => {
  it("DD.MM.YYYY biçimini gün/ay karıştırmadan ayrıştırır", () => {
    const d = trTarihAyristir("04.10.2028")!;
    expect(d.getFullYear()).toBe(2028);
    expect(d.getMonth() + 1).toBe(10); // 4 Ekim -- 10 Nisan DEĞİL
    expect(d.getDate()).toBe(4);
  });

  it("ISO biçimini ve zaman damgalı ISO'yu kabul eder", () => {
    expect(trTarihAyristir("2026-01-23")!.getFullYear()).toBe(2026);
    expect(trTarihAyristir("2026-01-23T00:00:00Z")!.getMonth() + 1).toBe(1);
  });

  it("boş/bozuk değerlerde null döner", () => {
    for (const v of [null, undefined, "", "abc", "..", "12.2028"]) {
      expect(trTarihAyristir(v as string | null)).toBeNull();
    }
  });
});

describe("trTarihSirala", () => {
  it("sözlük sırasının yanıldığı yerde kronolojik sıralar", () => {
    // Metin olarak "01.03.2028" < "01.10.2025" -- ham .order() bu yüzden yanlış.
    const satirlar = [{ t: "01.03.2028" }, { t: "01.10.2025" }, { t: "15.01.2026" }];
    expect(trTarihSirala(satirlar, (r) => r.t).map((r) => r.t)).toEqual([
      "01.10.2025",
      "15.01.2026",
      "01.03.2028",
    ]);
  });

  it("iki biçim karışıkken de doğru sıralar", () => {
    const satirlar = [{ t: "2027-05-01" }, { t: "04.10.2026" }, { t: "2026-01-01" }];
    expect(trTarihSirala(satirlar, (r) => r.t).map((r) => r.t)).toEqual([
      "2026-01-01",
      "04.10.2026",
      "2027-05-01",
    ]);
  });

  it("ayrıştırılamayanları sona atar ve girdiyi değiştirmez", () => {
    const satirlar = [{ t: null }, { t: "01.01.2026" }];
    const kopya = [...satirlar];
    expect(trTarihSirala(satirlar, (r) => r.t).map((r) => r.t)).toEqual(["01.01.2026", null]);
    expect(satirlar).toEqual(kopya);
  });
});

describe("trTarihPadle", () => {
  it("sıfır doldurmasız gün/ayı DD.MM.YYYY'ye normalize eder", () => {
    expect(trTarihPadle("4.10.2028")).toBe("04.10.2028");
    expect(trTarihPadle("4.1.2028")).toBe("04.01.2028");
    expect(trTarihPadle("04.10.2028")).toBe("04.10.2028");
  });

  it("nokta ile ayrılmayan değerlerde null döner", () => {
    expect(trTarihPadle("2028-10-04")).toBeNull();
    expect(trTarihPadle(null)).toBeNull();
  });
});

describe("utcTarihe", () => {
  it("saat dilimine bakmaksızın UTC gece yarısı döner", () => {
    for (const g of ["04.10.2028", "2028-10-04"]) {
      const d = utcTarihe(g)!;
      expect(d.toISOString()).toBe("2028-10-04T00:00:00.000Z");
    }
  });

  it("gün sayımı yerel saatten kaymaz", () => {
    // Bond-math gün farkını bu Date'ler üzerinden sayıyor: iki tarih arası
    // fark tam gün olmalı, 23/25 saat değil.
    const a = utcTarihe("01.01.2026")!;
    const b = utcTarihe("01.02.2026")!;
    expect((b.getTime() - a.getTime()) / 86_400_000).toBe(31);
  });

  it("eksik/bozuk parçalarda null döner", () => {
    for (const v of [null, "", "2028-10", "..2028"]) {
      expect(utcTarihe(v as string | null)).toBeNull();
    }
  });
});

describe("isoTarihGoster", () => {
  it("veri yoksa tire gösterir", () => {
    expect(isoTarihGoster(null)).toBe("–");
    expect(isoTarihGoster("abc")).toBe("–");
  });

  it("her iki biçimi de aynı TR metnine çevirir", () => {
    expect(isoTarihGoster("04.10.2028")).toBe(isoTarihGoster("2028-10-04"));
  });
});
