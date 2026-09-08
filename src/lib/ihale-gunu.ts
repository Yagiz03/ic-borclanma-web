/** İhale günü sayfasının "Tahmin" sekmesi -- core/ihale_gunu.py'nin
 * (özellikle _aylik_dagilim_tahmini_olustur, _benzer_ihaleleri_bul,
 * _ozet_penceresi_sec) TS portu. HMB'nin YAYIMLAMADIĞI bilgiyi (her
 * ihalenin tam büyüklüğü) geçmiş istatistiklere dayanarak KABA bir
 * şekilde kestirmeye çalışan bir YAKLAŞIKLIKTIR, kesin bir taahhüt
 * değildir -- bkz. orijinal docstring'ler. */
import { trTarihAyristir, trTarihPadle } from "@/lib/tarih";

export type IhaleHam = {
  isin: string;
  senet_tanimi: string | null;
  ihale_tarihi: string;
  vade_tarihi: string;
  ihrac_tipi: string | null;
  toplam_gerceklesme_mn: number | null;
  kamu_kurumlari_gerceklesme_mn: number | null;
  ort_yillik_bilesik_gerceklesme: number | null;
  en_dusuk_bilesik_gerceklesme: number | null;
  en_yuksek_bilesik_gerceklesme: number | null;
  tail_bps: number | null;
  toplam_oran_pct: number | null;
  bid_to_cover: number | null;
};

export type IhalePrep = IhaleHam & {
  ihaleTarihiD: Date;
  vadeTarihiD: Date;
  vadeYil: number;
  piyasadanIhaleMn: number;
};

const MS_YIL = 365 * 86_400_000;
const MIN_BENZER_IHALE = 3;
const DETAY_TABLO_SAYISI = 6;
const VADE_TOLERANSI_YIL = 1.5;

export function ihaleVerisiHazirla(ham: IhaleHam[]): IhalePrep[] {
  const sonuc: IhalePrep[] = [];
  for (const r of ham) {
    const ihaleTarihiD = trTarihAyristir(r.ihale_tarihi);
    const vadeTarihiD = trTarihAyristir(r.vade_tarihi);
    if (!ihaleTarihiD || !vadeTarihiD) continue;
    const vadeYil = (vadeTarihiD.getTime() - ihaleTarihiD.getTime()) / MS_YIL;
    const piyasadanIhaleMn = (r.toplam_gerceklesme_mn ?? 0) - (r.kamu_kurumlari_gerceklesme_mn ?? 0);
    sonuc.push({ ...r, ihaleTarihiD, vadeTarihiD, vadeYil, piyasadanIhaleMn });
  }
  return sonuc;
}

export function benzerIhaleleriBul(
  ihale: IhalePrep[],
  senetTipi: string,
  hedefVadeYil: number,
  tolerans = VADE_TOLERANSI_YIL,
): IhalePrep[] {
  return ihale
    .filter((r) => r.senet_tanimi === senetTipi && Math.abs(r.vadeYil - hedefVadeYil) <= tolerans)
    .sort((a, b) => b.ihaleTarihiD.getTime() - a.ihaleTarihiD.getTime());
}

export function ozetPenceresiSec(benzer: IhalePrep[]): IhalePrep[] {
  const yilBasi = new Date(new Date().getFullYear(), 0, 1).getTime();
  const ytd = benzer.filter((r) => r.ihaleTarihiD.getTime() >= yilBasi);
  if (ytd.length >= MIN_BENZER_IHALE) return ytd;
  return benzer.slice(0, DETAY_TABLO_SAYISI);
}

export function medyan(degerler: number[]): number | null {
  const gecerli = degerler.filter((d) => Number.isFinite(d)).sort((a, b) => a - b);
  if (gecerli.length === 0) return null;
  const orta = gecerli.length / 2;
  return gecerli.length % 2 === 0 ? (gecerli[orta - 1] + gecerli[orta]) / 2 : gecerli[Math.floor(orta)];
}

export function ortalama(degerler: (number | null | undefined)[]): number | null {
  const gecerli = degerler.filter((d): d is number => d != null && Number.isFinite(d));
  if (gecerli.length === 0) return null;
  return gecerli.reduce((a, b) => a + b, 0) / gecerli.length;
}

function ayniIsinOrtalamaMiktar(ihale: IhalePrep[], isin: string, haric?: IhalePrep): number | null {
  if (isin === "–") return null;
  const kendi = ihale.filter((r) => r.isin === isin && r !== haric);
  if (kendi.length === 0) return null;
  return ortalama(kendi.map((r) => r.piyasadanIhaleMn));
}

/** ihrac_takvimi tablosundan bir satır -- vade "X Yıl / N Gün" biçiminde. */
export type TakvimSatiri = {
  tarih: string; // ISO YYYY-MM-DD
  yontem: string;
  senet_turu: string;
  vade: string;
  itfa_tarihi: string;
};

export function vadeYilCikar(vade: string): number | null {
  const m = /\/\s*(\d+)\s*Gün/.exec(vade || "");
  return m ? Math.round((Number(m[1]) / 365) * 10) / 10 : null;
}

export type YaklasanIhale = { tarihD: Date; tarih: string; senet_turu: string; vade: string };

/** core/finansman_ilerleme.py::yaklasan_ihaleleri_bul(ay_boyunca=True) portu --
 * ihrac_takvimi'nden bu ayın "İhale" yöntemiyle yapılan (Doğrudan Satış hariç)
 * planlı ihalelerini tarihe göre artan sırada döner. */
export function yaklasanIhaleleriBul(takvim: TakvimSatiri[], bugun: Date): YaklasanIhale[] {
  const yil = bugun.getFullYear();
  const ay = bugun.getMonth();
  // ihrac_takvimi arka arkaya yayımlanan strateji belgelerinin hepsini
  // biriktirdiği için aynı ihale birden çok satır olabiliyor -- listede iki
  // kez görünmesin diye (tarih + senet + vade + itfa) ile tekilleştiriliyor.
  const gorulen = new Set<string>();
  return takvim
    .filter((r) => r.yontem?.startsWith("İhale"))
    .map((r) => ({ ...r, tarihD: trTarihAyristir(r.tarih) }))
    .filter((r): r is TakvimSatiri & { tarihD: Date } => r.tarihD != null && r.tarihD.getFullYear() === yil && r.tarihD.getMonth() === ay)
    .filter((r) => {
      const anahtar = `${r.tarih}|${r.senet_turu}|${r.vade}|${r.itfa_tarihi ?? ""}`;
      if (gorulen.has(anahtar)) return false;
      gorulen.add(anahtar);
      return true;
    })
    .sort((a, b) => a.tarihD.getTime() - b.tarihD.getTime())
    .map((r) => ({ tarihD: r.tarihD, tarih: r.tarih, senet_turu: r.senet_turu, vade: r.vade }));
}

export type DagilimSatiri = {
  ihaleTarihi: string;
  tarihD: Date;
  isin: string;
  senet: string;
  miktar: number | null;
  yuzde: number | null;
  tailBps: number | null;
  gerceklesti: boolean;
  tahminMiktar: number | null;
  tahminTail: number | null;
};

/**
 * `planIhaleMlr`: ayın "Piyasadan İhale" TOPLAM planı (Milyar TL).
 * `kalanMlr`: aynı planın, bugüne kadar gerçekleşenler düşülmüş hâli
 * (core/finansman_ilerleme.py::bu_ayki_kalan_ihale_plani ile aynı hesap
 * -- çağıran bunu ayrıca hesaplayıp geçirir).
 */
export function aylikDagilimTahminiOlustur(
  ihale: IhalePrep[],
  ayinTakvimi: TakvimSatiri[],
  planIhaleMlr: number | null,
  kalanMlr: number | null,
  bugun: Date,
): DagilimSatiri[] {
  if (planIhaleMlr == null || kalanMlr == null) return [];

  const isinLookup = new Map<string, string>();
  for (const r of ihale) {
    if (!r.senet_tanimi) continue;
    const anahtar = `${r.senet_tanimi}|${trTarihPadle(r.vade_tarihi)}`;
    if (!isinLookup.has(anahtar)) isinLookup.set(anahtar, r.isin);
  }

  type Aday = { ihaleTarihi: string; tarihD: Date; isin: string; senetTuru: string; vadeYil: number; itfaNorm: string | null };
  const adaylar: Aday[] = [];
  for (const r of ayinTakvimi) {
    if (!r.yontem?.startsWith("İhale")) continue;
    const tarihD = new Date(r.tarih);
    if (Number.isNaN(tarihD.getTime())) continue;
    const vadeYil = vadeYilCikar(r.vade);
    if (vadeYil == null) continue;
    const itfaNorm = trTarihPadle(r.itfa_tarihi);
    const anahtar = itfaNorm ? `${r.senet_turu}|${itfaNorm}` : "";
    adaylar.push({
      ihaleTarihi: tarihD.toLocaleDateString("tr-TR"), tarihD, isin: isinLookup.get(anahtar) ?? "–",
      senetTuru: r.senet_turu, vadeYil, itfaNorm,
    });
  }
  if (adaylar.length === 0) return [];

  type AraSatir = Aday & {
    agirlik: number | null; gercekMiktar: number | null; tahminTail: number | null;
    tailGoster: number | null; gerceklesti: boolean;
  };
  const ara: AraSatir[] = adaylar.map((a) => {
    let gercek: IhalePrep | undefined;
    if (a.tarihD.getTime() < bugun.getTime() && a.itfaNorm) {
      gercek = ihale.find(
        (r) => r.senet_tanimi === a.senetTuru && trTarihPadle(r.vade_tarihi) === a.itfaNorm
          && r.ihaleTarihiD.toDateString() === a.tarihD.toDateString(),
      );
    }
    let benzer = benzerIhaleleriBul(ihale, a.senetTuru, a.vadeYil);
    if (gercek) benzer = benzer.filter((r) => r !== gercek);
    const yeterli = benzer.length >= MIN_BENZER_IHALE;
    const sonBenzer = yeterli ? ozetPenceresiSec(benzer) : benzer;
    const tipikBuyuklukTipVade = yeterli ? ortalama(sonBenzer.map((r) => r.piyasadanIhaleMn)) : null;
    const ortTailI = yeterli ? medyan(sonBenzer.map((r) => r.tail_bps ?? NaN)) : null;

    const ayniIsinOrt = ayniIsinOrtalamaMiktar(ihale, a.isin, gercek);
    const agirlik = ayniIsinOrt ?? tipikBuyuklukTipVade;

    return {
      ...a,
      agirlik,
      gercekMiktar: gercek ? gercek.piyasadanIhaleMn : null,
      tahminTail: ortTailI,
      tailGoster: gercek && gercek.tail_bps != null ? gercek.tail_bps : ortTailI,
      gerceklesti: !!gercek,
    };
  });

  // Karşılaştırma amaçlı "tahmin": TÜM adayların ağırlığına göre, ayın
  // TOPLAM planına orantılı.
  const agirlikOrt = ortalama(ara.map((a) => a.agirlik)) ?? 1;
  const agirlikTumu = ara.map((a) => a.agirlik ?? agirlikOrt);
  const agirlikTumuToplam = agirlikTumu.reduce((s, v) => s + v, 0) || 1;
  const tahminMiktarlar = agirlikTumu.map((a) => Math.round((a / agirlikTumuToplam) * planIhaleMlr * 1000));

  // Gerçekleşmemiş satırlar: SADECE kalan adayların ağırlığına göre kalan
  // havuzu (kalanMlr) dağıt.
  const kalanIndeksler = ara.map((a, i) => (!a.gerceklesti ? i : -1)).filter((i) => i >= 0);
  const kalanAgirlikOrt = ortalama(kalanIndeksler.map((i) => ara[i].agirlik)) ?? 1;
  const kalanAgirlik = kalanIndeksler.map((i) => ara[i].agirlik ?? kalanAgirlikOrt);
  const kalanAgirlikToplam = kalanAgirlik.reduce((s, v) => s + v, 0) || 1;
  const kalanMiktarlar = new Map<number, number>();
  kalanIndeksler.forEach((idx, k) => {
    kalanMiktarlar.set(idx, Math.round((kalanAgirlik[k] / kalanAgirlikToplam) * kalanMlr * 1000));
  });

  const satirlar: DagilimSatiri[] = ara.map((a, i) => {
    const miktar = a.gerceklesti ? a.gercekMiktar : (kalanMiktarlar.get(i) ?? null);
    return {
      ihaleTarihi: a.ihaleTarihi, tarihD: a.tarihD, isin: a.isin,
      senet: `${a.senetTuru} (~${a.vadeYil.toFixed(1)} yıl)`,
      miktar, yuzde: null, tailBps: a.tailGoster, gerceklesti: a.gerceklesti,
      tahminMiktar: tahminMiktarlar[i], tahminTail: a.tahminTail,
    };
  });

  const toplamGosterim = satirlar.reduce((s, r) => s + (r.miktar ?? 0), 0);
  for (const s of satirlar) {
    s.yuzde = toplamGosterim ? Math.round(((s.miktar ?? 0) / toplamGosterim) * 1000) / 10 : null;
  }

  return satirlar.sort((a, b) => a.tarihD.getTime() - b.tarihD.getTime());
}

/** core/finansman_ilerleme.py::bu_ayki_kalan_ihale_plani ile aynı hesap
 * (Milyar TL) -- ihale-gunu sayfası hem içinde bulunulan ay hem gelecek
 * ay için bunu ayrı ayrı çağırır. */
export function ayKalanPlanHesapla(
  ihale: IhalePrep[], planIhaleMlr: number | null, yil: number, ay: number,
): number | null {
  if (planIhaleMlr == null) return null;
  const gerceklesenMn = ihale
    .filter((r) => r.ihaleTarihiD.getFullYear() === yil && r.ihaleTarihiD.getMonth() + 1 === ay)
    .reduce((s, r) => s + r.piyasadanIhaleMn, 0);
  return Math.max(planIhaleMlr - gerceklesenMn / 1000, 0);
}
