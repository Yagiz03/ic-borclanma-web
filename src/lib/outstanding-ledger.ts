import { trTarihAyristir } from "@/lib/tarih";
import { TIP_SIRASI, isinTipTahminEt } from "@/lib/isin-tip";

/**
 * TCMB'nin ihale istatistiklerinden (tcmb_ihale_istatistikleri) kağıt
 * tipine göre GERÇEK outstanding (stok) defteri -- her ihraç, ihraç
 * ayında nominal tutarı stoka ekler; o ISIN'in (tüm taplarının) toplamı
 * vade ayında stoktan tamamen düşülür (bullet itfa varsayımı).
 * pages/tcmb_gostergeler.py::_outstanding_ledger_yuzdesi'nin TS portu.
 */

export type IhaleIstatistikRow = {
  isin: string;
  ihrac_tarihi: string;
  vade_tarihi: string;
  nominal_mn: number | null;
  doviz_kodu: string | null;
};

export type AylikKumulatif = { ay: string; degerler: Record<string, number>; ayToplam: number };

function ayAnahtari(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function outstandingDefteriHesapla(
  rows: IhaleIstatistikRow[],
  tipSozluk: Map<string, string>,
): AylikKumulatif[] {
  const filtreli = rows.filter(
    (r) => (r.doviz_kodu ?? "TRY") === "TRY" && r.nominal_mn != null,
  );
  if (filtreli.length === 0) return [];

  const tipCache = new Map<string, string>();
  function tipOf(isin: string): string {
    let t = tipCache.get(isin);
    if (!t) {
      t = isinTipTahminEt(isin, tipSozluk);
      tipCache.set(isin, t);
    }
    return t;
  }

  // isin_toplam: (isin, vade_tarihi) -> toplam nominal -- ISIN'in TÜM
  // taplarının toplamı, tek bir vade ayında topluca itfa olduğu varsayımıyla.
  const isinToplam = new Map<string, { tip: string; vade: string; nominal: number }>();
  for (const r of filtreli) {
    const key = `${r.isin}|${r.vade_tarihi}`;
    const cur = isinToplam.get(key);
    if (cur) {
      cur.nominal += r.nominal_mn!;
    } else {
      isinToplam.set(key, { tip: tipOf(r.isin), vade: r.vade_tarihi, nominal: r.nominal_mn! });
    }
  }

  // aylik_degisim: ay -> tip -> delta (ihraç: +, itfa: -)
  const aylikDegisim = new Map<string, Map<string, number>>();
  function ekle(ay: string, tip: string, deger: number) {
    const m = aylikDegisim.get(ay) ?? new Map<string, number>();
    m.set(tip, (m.get(tip) ?? 0) + deger);
    aylikDegisim.set(ay, m);
  }
  for (const r of filtreli) {
    const d = trTarihAyristir(r.ihrac_tarihi);
    if (!d) continue;
    ekle(ayAnahtari(d), tipOf(r.isin), r.nominal_mn!);
  }
  for (const { tip, vade, nominal } of isinToplam.values()) {
    const d = trTarihAyristir(vade);
    if (!d) continue;
    ekle(ayAnahtari(d), tip, -nominal);
  }

  const ayAnahtarlari = [...aylikDegisim.keys()].sort();
  if (ayAnahtarlari.length === 0) return [];

  const [ilkYil, ilkAy] = ayAnahtarlari[0].split("-").map(Number);
  const bugun = new Date();
  const sonYil = bugun.getUTCFullYear();
  const sonAy = bugun.getUTCMonth() + 1;

  const tumAylar: string[] = [];
  for (let y = ilkYil, a = ilkAy; y < sonYil || (y === sonYil && a <= sonAy); ) {
    tumAylar.push(`${y}-${String(a).padStart(2, "0")}`);
    a += 1;
    if (a > 12) {
      a = 1;
      y += 1;
    }
  }

  // Kümülatif toplam (klipsiz taşınır -- her ayın GÖRÜNEN değeri 0'a
  // klipleniyor, ama bir sonraki ayın toplamı klipsiz devam eden gerçek
  // kümülatife eklenir; pandas'ın cumsum() sonra clip(lower=0) sırasıyla aynı).
  const running: Record<string, number> = {};
  for (const tip of TIP_SIRASI) running[tip] = 0;

  const sonuc: AylikKumulatif[] = [];
  for (const ay of tumAylar) {
    const delta = aylikDegisim.get(ay);
    if (delta) {
      for (const [tip, v] of delta.entries()) {
        if (!(tip in running)) running[tip] = 0;
        running[tip] += v;
      }
    }
    const degerler: Record<string, number> = {};
    let ayToplam = 0;
    for (const tip of Object.keys(running)) {
      const klip = Math.max(0, running[tip]);
      degerler[tip] = klip;
      ayToplam += klip;
    }
    sonuc.push({ ay, degerler, ayToplam });
  }
  return sonuc;
}

/** Belirli bir kümülatif dizisinde, tüm aralık boyunca hiç sıfırdan
 * farklı olmamış tip sütunlarını eler -- python'un
 * `kumulatif.loc[:, kumulatif.abs().sum() > 0]` karşılığı. */
export function kullanilanTipler(dilim: AylikKumulatif[]): string[] {
  const toplamlar = new Map<string, number>();
  for (const { degerler } of dilim) {
    for (const [tip, v] of Object.entries(degerler)) {
      toplamlar.set(tip, (toplamlar.get(tip) ?? 0) + Math.abs(v));
    }
  }
  return TIP_SIRASI.filter((t) => (toplamlar.get(t) ?? 0) > 0);
}
