/**
 * TLREF'e Endeksli ve Değişken Faizli kağıtlarda TS motorunun Python
 * motoruyla (tahvil_fiyatlama.py -- eski sitenin motoru) BİREBİR aynı
 * sonucu verdiğini doğrular.
 *
 * Sabit kuponlu tarafın golden testleri zaten vardı; bu iki tip en karmaşık
 * olanlar (gerçekleşen TLREF endeksinden birikmiş kupon + 21 günlük log-lineer
 * projeksiyon; FRN'de geçmiş ihalelere endeksli dönem kuponu) ve test
 * edilmiyorlardı.
 *
 * Fixture'daki değerler Python'dan üretildi (valör 11.09.2026).
 */
import { describe, expect, it } from "vitest";

import {
  degiskenFaizliDonemKuponu,
  degiskenFaizliYaklasikGetiri,
  type ReferansIhale,
  type TlrefSeri,
} from "@/lib/bond-math/floater";
import fixture from "./fixtures/floater-motor-paritesi.json";

const g = (s: string) => new Date(`${s}T00:00:00Z`);
const valor = g(fixture.valor);
const seri: TlrefSeri = {
  tarihler: fixture.tlref.tarihler.map(g),
  degerler: fixture.tlref.degerler,
};
const referansIhaleler: ReferansIhale[] = fixture.referansIhaleler.map((r) => ({
  valor: g(r.valor),
  vade: g(r.vade),
  bf: r.bf,
  ts: r.ts,
}));

/** TS camelCase alanı -> Python snake_case karşılığı. */
const ALANLAR: Record<string, string> = {
  yaklasikGetiriPct: "yaklasik_getiri_pct",
  guncelTlrefOraniPct: "guncel_tlref_orani_pct",
  birikmisGercekPct: "birikmis_gercek_pct",
  donemKuponPct: "donem_kupon_pct",
  yillikKuponPct: "yillik_kupon_pct",
  gunKupona: "gun_kupona",
  gerceklesenGun: "gerceklesen_gun",
  gunKalanVade: "gun_kalan_vade",
};

describe("floater motor paritesi (TS = Python)", () => {
  for (const k of fixture.kagitlar) {
    const py = k.fiyattanGetiriye as unknown as Record<string, number | null> | null;

    it(`${k.tip} — ${k.isin}: fiyattan getiriye`, () => {
      const ts = degiskenFaizliYaklasikGetiri(seri, g(k.ihrac), g(k.vade), valor, 100, 0, k.periyotGun);
      if (py == null) {
        expect(ts).toBeNull();
        return;
      }
      expect(ts).not.toBeNull();
      for (const [tsAlan, pyAlan] of Object.entries(ALANLAR)) {
        const beklenen = py[pyAlan];
        if (beklenen == null) continue;
        expect(
          (ts as unknown as Record<string, number>)[tsAlan],
          `${k.isin}.${tsAlan}`,
        ).toBeCloseTo(beklenen, 9);
      }
    });

    it(`${k.tip} — ${k.isin}: dönem kuponu`, () => {
      const ts = degiskenFaizliDonemKuponu(g(k.donemBasi), referansIhaleler, k.periyotGun);
      const beklenen = k.donemKuponu as [number, number] | null;
      if (beklenen == null) {
        expect(ts).toBeNull();
        return;
      }
      expect(ts).not.toBeNull();
      // Python tuple dönüyor: (dönemsel_kupon_pct, ağırlıklı ort. yıllık bileşik).
      expect(ts!.donemselKuponPct).toBeCloseTo(beklenen[0], 9);
      expect(ts!.aofPct).toBeCloseTo(beklenen[1], 9);
    });
  }
});
