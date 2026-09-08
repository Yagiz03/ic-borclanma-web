/**
 * Golden-value testler: floater.ts çıktıları, Python tahvil_fiyatlama.py'nin
 * GERÇEK çıktılarıyla (fixtures/golden-floater.json, gerçek TLREF endeksi /
 * TÜFE düzeyleri / referans ihale arşiviyle üretildi) karşılaştırılır.
 */
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/golden-floater.json";
import {
  degiskenFaizliYaklasikGetiri,
  gecmisIhalelereEndeksliGetiri,
  referansTufeEndeksi,
  tufeEndeksOrani,
  type ReferansIhale,
  type TlrefSeri,
  type TufeSeri,
} from "../bond-math/floater";
import { tufeSerileriniZincirle } from "../bond-math/tufe-zincir";

const g = (s: string) => new Date(`${s}T00:00:00Z`);

const tlrefSeri: TlrefSeri = {
  tarihler: fixture.tlref_seri.tarihler.map(g),
  degerler: fixture.tlref_seri.degerler,
};
const tufeSeri: TufeSeri = {
  tarihler: fixture.tufe_seri.tarihler.map(g),
  duzeyler: fixture.tufe_seri.duzeyler,
};
const referansIhaleler: ReferansIhale[] = fixture.referans_ihaleler.map((r) => ({
  valor: g(r.valor),
  vade: g(r.vade),
  bf: r.bf,
  ts: r.ts,
}));

describe("TLREF'e endeksli (degiskenFaizliYaklasikGetiri)", () => {
  for (const k of fixture.tlref) {
    it(`${k.isin} @ ${k.bugun} fiyat ${k.temizFiyat}`, () => {
      const s = degiskenFaizliYaklasikGetiri(
        tlrefSeri,
        g(k.ilkIhrac),
        g(k.vade),
        g(k.bugun),
        k.temizFiyat,
        k.ekGetiri,
        k.periyotGun,
      );
      expect(s).not.toBeNull();
      const b = k.beklenen;
      expect(s!.yaklasikGetiriPct).toBeCloseTo(b.yaklasik_getiri_pct, 8);
      expect(s!.donemKuponPct).toBeCloseTo(b.donem_kupon_pct, 10);
      expect(s!.yillikKuponPct).toBeCloseTo(b.yillik_kupon_pct, 10);
      expect(s!.guncelTlrefOraniPct).toBeCloseTo(b.guncel_tlref_orani_pct, 10);
      expect(s!.birikmisGercekPct).toBeCloseTo(b.birikmis_gercek_pct, 10);
      expect(s!.donemKuponKesinMi).toBe(b.donem_kupon_kesin_mi);
      expect(s!.gerceklesenGun).toBe(b.gerceklesen_gun);
      expect(s!.gunKupona).toBe(b.gun_kupona);
      expect(s!.gunKalanVade).toBe(b.gun_kalan_vade);
      expect(s!.donemBasi.toISOString().slice(0, 10)).toBe(b.donem_basi);
      expect(s!.donemSonu.toISOString().slice(0, 10)).toBe(b.donem_sonu);
      if (b.son_odenen_kupon_pct === null) expect(s!.sonOdenenKuponPct).toBeNull();
      else expect(s!.sonOdenenKuponPct!).toBeCloseTo(b.son_odenen_kupon_pct, 10);
    });
  }
});

describe("Değişken Faizli / Geçmiş İhalelere Endeksli", () => {
  for (const k of fixture.frn) {
    it(`${k.isin} @ ${k.bugun} fiyat ${k.temizFiyat}`, () => {
      const s = gecmisIhalelereEndeksliGetiri(
        g(k.ilkIhrac),
        g(k.vade),
        g(k.bugun),
        k.temizFiyat,
        referansIhaleler,
        k.periyotGun,
      );
      expect(s).not.toBeNull();
      const b = k.beklenen;
      expect(s!.getiriPct).toBeCloseTo(b.getiri_pct, 8);
      expect(s!.donemKuponPct).toBeCloseTo(b.donem_kupon_pct, 10);
      expect(s!.aofPct).toBeCloseTo(b.aof_pct, 10);
      expect(s!.birikmisFaiz).toBeCloseTo(b.birikmis_faiz, 10);
      expect(s!.kirliFiyat).toBeCloseTo(b.kirli_fiyat, 10);
      expect(s!.donemBasi.toISOString().slice(0, 10)).toBe(b.donem_basi);
      expect(s!.donemSonu.toISOString().slice(0, 10)).toBe(b.donem_sonu);
    });
  }
});

describe("TÜFE'ye endeksli referans endeks / endeks oranı", () => {
  for (const k of fixture.tufe_endeks) {
    it(`${k.isin} @ ${k.tarih}`, () => {
      const r = referansTufeEndeksi(g(k.tarih), tufeSeri);
      const o = tufeEndeksOrani(g(k.tarih), g(k.ihrac), tufeSeri);
      if (k.referansEndeks === null) expect(r).toBeNull();
      else expect(r!).toBeCloseTo(k.referansEndeks, 10);
      if (k.endeksOrani === null) expect(o).toBeNull();
      else expect(o!).toBeCloseTo(k.endeksOrani, 12);
    });
  }
});

describe("TÜFE endeks düzeyi zincirleme (2003=100 -> 2025=100)", () => {
  it("TS zincirlemesi Python'un ürettiği seriyle birebir aynı", () => {
    const zincirli = tufeSerileriniZincirle(fixture.tufe_ham.eski, fixture.tufe_ham.yeni);
    // fixture.tufe_seri, core/data.py::tufe_duzey_serisi_yukle'nin çıktısı.
    expect(zincirli.tarihler).toEqual(fixture.tufe_seri.tarihler);
    expect(zincirli.degerler.length).toBe(fixture.tufe_seri.duzeyler.length);
    zincirli.degerler.forEach((v, i) => {
      expect(v).toBeCloseTo(fixture.tufe_seri.duzeyler[i], 9);
    });
  });

  it("taban değişiminden sonraki aylar eski tabanın ölçeğine çekiliyor", () => {
    const z = tufeSerileriniZincirle(fixture.tufe_ham.eski, fixture.tufe_ham.yeni);
    const sonEski = fixture.tufe_ham.eski.tarihler[fixture.tufe_ham.eski.tarihler.length - 1];
    const i = z.tarihler.indexOf(sonEski);
    // Çapa ayı eski değeriyle aynı kalmalı, sonraki aylar ondan büyük olmalı.
    expect(z.degerler[i]).toBeCloseTo(
      fixture.tufe_ham.eski.degerler[fixture.tufe_ham.eski.degerler.length - 1],
      9,
    );
    expect(z.degerler[z.degerler.length - 1]).toBeGreaterThan(z.degerler[i]);
    expect(z.tarihler.length).toBeGreaterThan(fixture.tufe_ham.eski.tarihler.length);
  });

  it("yeni seri yoksa eski seriyle devam eder", () => {
    const bos = { tarihler: [], degerler: [] };
    expect(tufeSerileriniZincirle(fixture.tufe_ham.eski, bos)).toEqual(fixture.tufe_ham.eski);
  });
});
