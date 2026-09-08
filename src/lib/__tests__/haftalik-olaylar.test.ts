/**
 * "Bu hafta" bildiriminin olay kurulumu -- Supabase'ten alınmış GERÇEK
 * takvim satırlarıyla (fixtures/hafta-takvim.json) test ediliyor:
 * biri ihaleli hafta (14-20 Eylül 2026), biri PPK'lı hafta (8-13 Eylül).
 */
import { describe, expect, it } from "vitest";
import { haftaAraligi, olaylariKur } from "../haftalik-olaylar";
import veri from "./fixtures/hafta-takvim.json";

const kur = (h: typeof veri.ihaleHaftasi) =>
  olaylariKur(h.tcmb, h.ihrac, { baslangic: h.baslangic, bitis: h.bitis });

describe("olaylariKur — ihaleli hafta (14-20 Eylül 2026)", () => {
  const olaylar = kur(veri.ihaleHaftasi);

  it("ihaleleri senet türü ve vadesiyle listeler", () => {
    const etiketler = olaylar.map((o) => o.etiket);
    expect(etiketler).toContain("İhale: Sabit Kuponlu Devlet Tahvili (2 Yıl / 728 Gün)");
    expect(etiketler).toContain("İhale: TLREF'e Endeksli Devlet Tahvili (4 Yıl / 1456 Gün)");
    expect(etiketler).toContain("İhale: Sabit Kuponlu Devlet Tahvili (8 Yıl / 2933 Gün)");
  });

  it("doğrudan satışı ihaleden ayırır", () => {
    const dogrudan = olaylar.filter((o) => o.etiket.startsWith("Doğrudan satış"));
    expect(dogrudan.length).toBeGreaterThan(0);
    expect(dogrudan[0].etiket).toBe("Doğrudan satış: Kira Sertifikası (2 Yıl / 728 Gün)");
    expect(dogrudan.every((o) => o.tur === "ihale")).toBe(true);
  });

  it("aynı ihaleyi iki kez göstermez", () => {
    // Kaynakta 9 satır var ama bunların bir kısmı birebir yinelenmiş
    // (aynı gün + senet + vade) -- bildirimde tekilleşmeli.
    expect(veri.ihaleHaftasi.ihrac.length).toBe(9);
    const anahtarlar = olaylar.map((o) => `${o.tarih}|${o.etiket}`);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
    expect(olaylar.filter((o) => o.tur === "ihale").length).toBeLessThan(9);
  });

  it("olayları güne göre sıralar", () => {
    const tarihler = olaylar.map((o) => o.tarih);
    expect([...tarihler].sort()).toEqual(tarihler);
  });

  it("her olay hafta aralığının içinde kalır", () => {
    for (const o of olaylar) {
      expect(o.tarih >= veri.ihaleHaftasi.baslangic).toBe(true);
      expect(o.tarih <= veri.ihaleHaftasi.bitis).toBe(true);
    }
  });

  it("ihale günleri 14 ve 15 Eylül'e düşer", () => {
    const ihaleGunleri = new Set(olaylar.filter((o) => o.tur === "ihale").map((o) => o.tarih));
    expect([...ihaleGunleri].sort()).toEqual(["2026-09-14", "2026-09-15"]);
  });
});

describe("olaylariKur — PPK'lı hafta (8-13 Eylül 2026)", () => {
  const olaylar = kur(veri.ppkHaftasi);

  it("PPK kararını ppk türüyle işaretler", () => {
    const ppk = olaylar.find((o) => o.etiket.includes("PPK"));
    expect(ppk).toBeDefined();
    expect(ppk!.tur).toBe("ppk");
    expect(ppk!.tarih).toBe("2026-09-10");
  });

  it("global olayları (ECB, ABD TÜFE/ÜFE) da kapsar", () => {
    const global = olaylar.filter((o) => o.tur === "global").map((o) => o.etiket);
    expect(global.some((e) => e.includes("ECB"))).toBe(true);
    expect(global.some((e) => e.includes("TÜFE"))).toBe(true);
    expect(global.some((e) => e.includes("ÜFE"))).toBe(true);
  });

  it("bu haftada ihale yok", () => {
    expect(olaylar.filter((o) => o.tur === "ihale")).toHaveLength(0);
  });
});

describe("haftaAraligi", () => {
  it("bugünden haftanın Pazar gününe kadar sürer", () => {
    // 8 Eylül 2026 Salı -> 13 Eylül Pazar
    expect(haftaAraligi(new Date("2026-09-08T10:00:00Z"))).toEqual({
      baslangic: "2026-09-08",
      bitis: "2026-09-13",
    });
  });

  it("Pazar günü tek günlük aralık verir", () => {
    expect(haftaAraligi(new Date("2026-09-13T10:00:00Z"))).toEqual({
      baslangic: "2026-09-13",
      bitis: "2026-09-13",
    });
  });

  it("Pazartesi tüm haftayı kapsar", () => {
    expect(haftaAraligi(new Date("2026-09-14T10:00:00Z"))).toEqual({
      baslangic: "2026-09-14",
      bitis: "2026-09-20",
    });
  });
});
