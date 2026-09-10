/**
 * ÖST anomali tespiti.
 *
 * Hem Özel sektör sayfasındaki liste hem panele girişte çıkan uyarı penceresi
 * (components/ost-anomali-penceresi.tsx) aynı hesabı kullanıyor; iki yerde
 * kopyalanırsa eşikler zamanla ayrışır.
 *
 * Referans: eski Streamlit projesi pages/ozel_sektor.py.
 */

/** Bir kağıdın "anormal" sayılması için eşikler -- biri aşılırsa listeye girer. */
export const FIYAT_ANOMALI_ESIK_PCT = 3.0;
export const GETIRI_ANOMALI_ESIK_BPS = 300.0;
/** Karşılaştırılan önceki işlem bundan eskiyse anlamlı sinyal sayılmıyor. */
export const MAX_KARSILASTIRMA_GUN = 45;
const KUPON_RESET_TOLERANS_GUN = 3;
const KUPON_RESET_PAR_TOLERANS = 3.0;
export type BistSatiri = {
  tarih: string;
  isin: string;
  temiz_fiyat: number | null;
  kapanis_bilesik_getiri_pct: number | null;
};

export type MkbSatiri = {
  isin: string;
  ihracci_kurum: string | null;
  itfa_tarihi: string | null;
  kupon_sikligi: string | null;
  ilk_ihrac_tarihi: string | null;
};

export type Anomali = {
  isin: string;
  ihracci: string;
  fiyatDegisimPct: number | null;
  getiriDegisimBps: number | null;
  oncekiFiyat: number | null;
  oncekiGetiri: number | null;
  bugunFiyat: number | null;
  bugunGetiri: number | null;
  gunFarki: number;
  kuponResetiyleAciklanabilir: boolean;
};

function trTarihiParcala(s: string | null): Date | null {
  if (!s) return null;
  const [g, a, y] = s.split(".").map(Number);
  if (!g || !a || !y) return null;
  return new Date(Date.UTC(y, a - 1, g));
}

/** Python'un round()'u gibi: tam .5 ise EN YAKIN ÇİFT sayıya yuvarlar.
 *  Python tarafı round(365/2)=182 verirken JS'in Math.round'u 183 veriyordu;
 *  altı aylık kupon ÖST'te en yaygın sıklık olduğu için bu 1 günlük fark her
 *  dönemde birikip 3 günlük toleransı aşabiliyordu. */
function cifteYuvarla(x: number): number {
  const asagi = Math.floor(x);
  if (x - asagi !== 0.5) return Math.round(x);
  return asagi % 2 === 0 ? asagi : asagi + 1;
}

/** `ilk_ihrac_tarihi` + `kupon_sikligi`den periyodik ödeme tarihlerini kabaca
 *  hesaplayıp biri (önceki, bugün] aralığına denk geliyor mu diye bakar.
 *  Resmi bir ÖST kupon takvimi kaynağı yok -- YAKLAŞIK tahmin. */
function kuponAraliginaMi(
  ilkIhrac: string | null, kuponSikligi: string | null, oncekiTarih: string, buguninTarih: string,
): boolean {
  const siklik = kuponSikligi != null ? Number(kuponSikligi) : NaN;
  if (!Number.isFinite(siklik) || siklik <= 0) return false;
  const ilkIhracDate = trTarihiParcala(ilkIhrac);
  if (!ilkIhracDate) return false;
  const periyotGun = cifteYuvarla(365 / siklik);
  if (periyotGun <= 0) return false;

  const oncekiMs = new Date(oncekiTarih).getTime() - KUPON_RESET_TOLERANS_GUN * 86_400_000;
  const bugunMs = new Date(buguninTarih).getTime() + KUPON_RESET_TOLERANS_GUN * 86_400_000;
  let d = ilkIhracDate.getTime() + periyotGun * 86_400_000;
  for (let guard = 0; d <= bugunMs && guard < 60; guard++) {
    if (d >= oncekiMs) return true;
    d += periyotGun * 86_400_000;
  }
  return false;
}

function pariyeYakinMi(v: number | null): boolean {
  return v != null && Math.abs(v - 100) <= KUPON_RESET_PAR_TOLERANS;
}

/**
 * Seçili tarihteki her kağıdı KENDİ bir önceki gerçek işlem gününe göre
 * karşılaştırır. ÖST'lerin çoğu her gün işlem görmediği için "önceki takvim
 * günü" değil, o ISIN'in kendi son işlem satırı temel alınıyor.
 */
export function ostAnomalileriBul(
  bist: BistSatiri[], mkb: MkbSatiri[], seciliTarih: string,
): Anomali[] {
  if (!seciliTarih) return [];
  const mkbHarita = new Map(mkb.map((m) => [m.isin, m]));

  const oncekiPerIsin = new Map<string, BistSatiri>();
  for (const r of bist) {
    if (r.tarih >= seciliTarih) continue;
    const mevcut = oncekiPerIsin.get(r.isin);
    if (!mevcut || r.tarih > mevcut.tarih) oncekiPerIsin.set(r.isin, r);
  }
  const bugunPerIsin = new Map<string, BistSatiri>();
  for (const r of bist) if (r.tarih === seciliTarih) bugunPerIsin.set(r.isin, r);

  const sonuc: Anomali[] = [];
  for (const [isin, bugun] of bugunPerIsin) {
    const onceki = oncekiPerIsin.get(isin);
    if (!onceki) continue;
    const gunFarki = Math.round(
      (new Date(seciliTarih).getTime() - new Date(onceki.tarih).getTime()) / 86_400_000,
    );
    if (gunFarki > MAX_KARSILASTIRMA_GUN) continue;

    const fiyatDegisimPct =
      bugun.temiz_fiyat != null && onceki.temiz_fiyat != null
        ? ((bugun.temiz_fiyat - onceki.temiz_fiyat) / onceki.temiz_fiyat) * 100
        : null;
    const getiriDegisimBps =
      bugun.kapanis_bilesik_getiri_pct != null && onceki.kapanis_bilesik_getiri_pct != null
        ? (bugun.kapanis_bilesik_getiri_pct - onceki.kapanis_bilesik_getiri_pct) * 100
        : null;

    const anormal =
      (fiyatDegisimPct != null && Math.abs(fiyatDegisimPct) >= FIYAT_ANOMALI_ESIK_PCT) ||
      (getiriDegisimBps != null && Math.abs(getiriDegisimBps) >= GETIRI_ANOMALI_ESIK_BPS);
    if (!anormal) continue;

    const m = mkbHarita.get(isin);
    const kuponAraliginda =
      (pariyeYakinMi(bugun.temiz_fiyat) || pariyeYakinMi(onceki.temiz_fiyat)) &&
      kuponAraliginaMi(m?.ilk_ihrac_tarihi ?? null, m?.kupon_sikligi ?? null, onceki.tarih, seciliTarih);

    sonuc.push({
      isin, ihracci: m?.ihracci_kurum ?? "–", fiyatDegisimPct, getiriDegisimBps,
      oncekiFiyat: onceki.temiz_fiyat, oncekiGetiri: onceki.kapanis_bilesik_getiri_pct,
      bugunFiyat: bugun.temiz_fiyat, bugunGetiri: bugun.kapanis_bilesik_getiri_pct,
      gunFarki, kuponResetiyleAciklanabilir: kuponAraliginda,
    });
  }

  const buyukluk = (a: Anomali) =>
    Math.max(Math.abs(a.fiyatDegisimPct ?? 0), Math.abs(a.getiriDegisimBps ?? 0) / 100);
  return sonuc.sort((a, b) => buyukluk(b) - buyukluk(a));
}

/** Uyarı satırının metni. Kupon reseti açıklaması sona eklenir. */
export function ostAnomaliMesaji(a: Anomali): string {
  const parcalar = [`${a.isin} (${a.ihracci})`];
  if (a.getiriDegisimBps != null && Math.abs(a.getiriDegisimBps) >= GETIRI_ANOMALI_ESIK_BPS) {
    parcalar.push(
      `getiri ${a.getiriDegisimBps >= 0 ? "+" : ""}${a.getiriDegisimBps.toFixed(0)} bps ` +
        `(%${a.oncekiGetiri?.toFixed(2)} → %${a.bugunGetiri?.toFixed(2)})`,
    );
  }
  if (a.fiyatDegisimPct != null && Math.abs(a.fiyatDegisimPct) >= FIYAT_ANOMALI_ESIK_PCT) {
    parcalar.push(
      `fiyat %${a.fiyatDegisimPct >= 0 ? "+" : ""}${a.fiyatDegisimPct.toFixed(1)} ` +
        `(${a.oncekiFiyat?.toFixed(2)} → ${a.bugunFiyat?.toFixed(2)})`,
    );
  }
  parcalar.push(a.gunFarki <= 1 ? "önceki gün işlem gördü" : `${a.gunFarki} gün önce işlem gördü`);
  if (a.kuponResetiyleAciklanabilir) {
    const fiyatDusuyor = a.fiyatDegisimPct != null && a.fiyatDegisimPct < 0;
    parcalar.push(
      fiyatDusuyor
        ? "muhtemelen kira/kupon ödendi, pariye indi"
        : "muhtemelen yeni dönem başladı, pariden birikime geçti",
    );
  }
  return parcalar.join(", ");
}
