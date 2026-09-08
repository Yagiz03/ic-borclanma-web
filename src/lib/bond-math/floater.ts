/**
 * Floater (değişken kuponlu) DİBS formülleri -- tahvil_fiyatlama.py'nin
 * 5) TLREF'e Endeksli, 5b) Değişken Faizli (Geçmiş İhalelere Endeksli) ve
 * 6) TÜFE'ye Endeksli bölümlerinin birebir TS portu.
 *
 * Python orijinaliyle golden-value testle doğrulanmadan buradaki hesap
 * mantığı değiştirilmemeli (bkz. floater.golden.test.ts).
 *
 * Tüm tarihler UTC gece yarısı Date -- tahvil-fiyatlama.ts ile aynı konvansiyon.
 */

import {
  gunEkle,
  gunFarki,
  kirliFiyatHesapla,
  type NakitAkisi,
} from "./tahvil-fiyatlama";

/** Python bisect.bisect_left: `deger`den küçük OLMAYAN ilk indeks. */
function bisectLeft(tarihler: Date[], deger: Date): number {
  let lo = 0;
  let hi = tarihler.length;
  const d = deger.getTime();
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tarihler[mid].getTime() < d) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Python bisect.bisect_right. */
function bisectRight(tarihler: Date[], deger: Date): number {
  let lo = 0;
  let hi = tarihler.length;
  const d = deger.getTime();
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (d < tarihler[mid].getTime()) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

// --------------------------------------------------------------------------
// Ortak yardımcılar
// --------------------------------------------------------------------------

/** İlk ihraçtan vadeye `periyotGun`ar gün adımlayarak kupon dönemi sınırları.
 *  Son dönem vadeye "snap" edilir (kırık/stub olabilir). */
export function kuponDonemleri(ilkIhrac: Date, vade: Date, periyotGun = 91): Date[] {
  const donemler = [ilkIhrac];
  let cur = ilkIhrac;
  for (;;) {
    cur = gunEkle(cur, periyotGun);
    if (gunFarki(cur, vade) >= 0) {
      donemler.push(vade);
      break;
    }
    donemler.push(cur);
  }
  return donemler;
}

/** kuponDonemleri'nin TERSİ: vadeden geriye adımlayıp kırık dönemi başa koyar. */
export function kuponDonemleriGeriye(ilkIhrac: Date, vade: Date, periyotGun = 182): Date[] {
  const donemler = [vade];
  let cur = vade;
  for (;;) {
    cur = gunEkle(cur, -periyotGun);
    if (gunFarki(cur, ilkIhrac) <= 0) {
      donemler.push(ilkIhrac);
      break;
    }
    donemler.push(cur);
  }
  return donemler.reverse();
}

/** Dönem sınırları (n+1) + dönemsel kupon yüzdeleri (n) -> nakit akışları. */
export function donemselKuponAkislari(
  donemSinirlari: Date[],
  donemKuponlari: number[],
  nominal = 100,
): NakitAkisi[] {
  return donemKuponlari.map((kuponPct, i) => ({
    tarih: donemSinirlari[i + 1],
    tutar: i === donemKuponlari.length - 1 ? kuponPct + nominal : kuponPct,
  }));
}

/** getiriBul ile aynı Newton-Raphson, ama hazır akış listesi alır. */
export function getiriBulAkislardan(
  akislar: NakitAkisi[],
  valor: Date,
  hedefKirliFiyat: number,
  baslangicTahmini = 0.3,
  tolerans = 1e-8,
  maksIter = 100,
): number {
  let y = baslangicTahmini;
  for (let i = 0; i < maksIter; i++) {
    const fiyat = kirliFiyatHesapla(akislar, valor, y);
    const fark = fiyat - hedefKirliFiyat;
    if (Math.abs(fark) < tolerans) return y;
    const eps = 1e-6;
    const turev = (kirliFiyatHesapla(akislar, valor, y + eps) - fiyat) / eps;
    if (turev === 0) break;
    y = y - fark / turev;
  }
  return y;
}

// --------------------------------------------------------------------------
// 5) TLREF'e Endeksli Devlet Tahvili
// --------------------------------------------------------------------------

/** HMB Yatırımcı Kılavuzu'ndaki resmi dönemsel kupon formülü:
 *  ((E_son / E_bas) ** (n1/n2) - 1) * 100 + ek getiri */
export function tlrefDonemKuponOrani(
  endeksBas: number,
  endeksSon: number,
  n1: number,
  n2: number,
  ekGetiri = 0,
): number {
  return (Math.pow(endeksSon / endeksBas, n1 / n2) - 1) * 100 + ekGetiri;
}

export type TlrefSeri = { tarihler: Date[]; degerler: number[] };

/** Dönem başından bugüne GERÇEKLEŞEN (birikmiş) kupon, doğrudan endeksten. */
export function tlrefBirikmisKupon(
  seri: TlrefSeri,
  donemBasi: Date,
  bugun: Date,
  n1: number,
  ekGetiri = 0,
): {
  birikmisPct: number;
  gecenGun: number;
  endeksBas: number;
  endeksSimdi: number;
  gozlemBas: Date;
  gozlemSimdi: Date;
} | null {
  const idxBas = bisectLeft(seri.tarihler, donemBasi) - 2;
  const idxSimdi = bisectLeft(seri.tarihler, bugun) - 2;
  if (idxBas < 0 || idxSimdi < 0 || idxSimdi < idxBas || n1 <= 0) return null;
  const endeksBas = seri.degerler[idxBas];
  const endeksSimdi = seri.degerler[idxSimdi];
  const gecenGun = gunFarki(bugun, donemBasi);
  return {
    birikmisPct: (endeksSimdi / endeksBas - 1) * 100 + ekGetiri * (gecenGun / n1),
    gecenGun,
    endeksBas,
    endeksSimdi,
    gozlemBas: seri.tarihler[idxBas],
    gozlemSimdi: seri.tarihler[idxSimdi],
  };
}

/** Son `pencereGun` günlük endeks gözlemlerinin günlük log-lineer regresyon eğimi. */
export function tlrefLogEgim(
  seri: TlrefSeri,
  tarih: Date,
  pencereGun = 21,
  gunGeri = 2,
): number | null {
  const hedef = gunEkle(tarih, -gunGeri);
  const idxSon = bisectRight(seri.tarihler, hedef) - 1;
  if (idxSon < 0) return null;
  const hedefBaslangic = gunEkle(seri.tarihler[idxSon], -pencereGun);
  const idxBas = bisectRight(seri.tarihler, hedefBaslangic) - 1;
  if (idxBas < 0 || idxBas >= idxSon) return null;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = idxBas; i <= idxSon; i++) {
    xs.push(gunFarki(seri.tarihler[i], seri.tarihler[idxBas]));
    ys.push(Math.log(seri.degerler[i]));
  }
  const n = xs.length;
  if (n < 3) return null;
  const xOrt = xs.reduce((a, b) => a + b, 0) / n;
  const yOrt = ys.reduce((a, b) => a + b, 0) / n;
  const payda = xs.reduce((a, x) => a + (x - xOrt) ** 2, 0);
  if (payda === 0) return null;
  let pay = 0;
  for (let i = 0; i < n; i++) pay += (xs[i] - xOrt) * (ys[i] - yOrt);
  return pay / payda;
}

/** Güncel TLREF seviyesinin BASİT (piyasa kotasyonu) tahmini: yılbaşından
 *  bugüne endeks büyümesinin günlük geometrik ortalaması x 365. */
export function tlrefYilbasiBasitOran(seri: TlrefSeri, bugun: Date, gunGeri = 2): number | null {
  const idxSon = bisectLeft(seri.tarihler, bugun) - gunGeri;
  if (idxSon < 0) return null;
  const yilbasi = new Date(Date.UTC(seri.tarihler[idxSon].getUTCFullYear(), 0, 1));
  let idxBas = bisectLeft(seri.tarihler, yilbasi);
  if (idxSon - idxBas < 10) idxBas = Math.max(0, idxSon - 30);
  if (idxSon <= idxBas) return null;
  const n = gunFarki(seri.tarihler[idxSon], seri.tarihler[idxBas]);
  if (n <= 0) return null;
  const gunluk = Math.pow(seri.degerler[idxSon] / seri.degerler[idxBas], 1 / n) - 1;
  return gunluk * 365 * 100;
}

/** Log-lineer eğimden yıllıklandırılmış (bileşik) güncel TLREF seviyesi. */
export function tlrefYillikOranTahmini(
  seri: TlrefSeri,
  tarih: Date,
  pencereGun = 21,
  gunGeri = 2,
): number | null {
  const egim = tlrefLogEgim(seri, tarih, pencereGun, gunGeri);
  if (egim === null) return null;
  return (Math.exp(egim * 365) - 1) * 100;
}

export type TlrefGetiriSonucu = {
  yaklasikGetiriPct: number;
  guncelTlrefOraniPct: number;
  sonOdenenKuponPct: number | null;
  birikmisGercekPct: number;
  gunKupona: number;
  donemKuponPct: number;
  yillikKuponPct: number;
  donemKuponKesinMi: boolean;
  gerceklesenGun: number;
  donemBasi: Date;
  donemSonu: Date;
  gunKalanVade: number;
};

/** TLREF'e endeksli DİBS için "iskonto marjı" eşdeğeri yaklaşık bileşik getiri. */
export function degiskenFaizliYaklasikGetiri(
  seri: TlrefSeri,
  ilkIhrac: Date,
  vade: Date,
  bugun: Date,
  temizFiyat: number,
  ekGetiri = 0,
  periyotGun = 91,
): TlrefGetiriSonucu | null {
  if (gunFarki(bugun, vade) >= 0 || temizFiyat == null || temizFiyat <= 0) return null;

  const donemler = kuponDonemleri(ilkIhrac, vade, periyotGun);
  // Vadeye tam oturmayan 1-2 günlük sahte stub dönemi vadeye birleştir.
  if (
    donemler.length >= 3 &&
    gunFarki(donemler[donemler.length - 1], donemler[donemler.length - 2]) <
      Math.floor(periyotGun / 2)
  ) {
    donemler.splice(donemler.length - 2, 1);
  }

  let donemIdx = -1;
  for (let i = 0; i < donemler.length - 1; i++) {
    if (gunFarki(donemler[i], bugun) <= 0 && gunFarki(bugun, donemler[i + 1]) < 0) {
      donemIdx = i;
      break;
    }
  }
  if (donemIdx < 0) return null;
  const donemBasi = donemler[donemIdx];
  const donemSonu = donemler[donemIdx + 1];

  const gunKalanVade = gunFarki(vade, bugun);
  if (gunKalanVade <= 0) return null;

  const idxBas = bisectLeft(seri.tarihler, donemBasi) - 2;
  const idxSimdi = bisectLeft(seri.tarihler, bugun) - 2;
  if (idxBas < 0 || idxSimdi < 0 || idxSimdi < idxBas) return null;

  const endeksBas = seri.degerler[idxBas];
  const tarihBas = seri.tarihler[idxBas];
  const endeksSimdi = seri.degerler[idxSimdi];
  const tarihSimdi = seri.tarihler[idxSimdi];

  const hedefSon = gunEkle(donemSonu, -2);
  let guncelTlrefPct = tlrefYilbasiBasitOran(seri, bugun);

  let endeksSon: number;
  let tarihSon: Date;
  let kesin: boolean;
  if (gunFarki(tarihSimdi, hedefSon) >= 0) {
    const idxSon = Math.min(bisectLeft(seri.tarihler, donemSonu) - 2, seri.tarihler.length - 1);
    if (idxSon < idxBas) return null;
    endeksSon = seri.degerler[idxSon];
    tarihSon = seri.tarihler[idxSon];
    kesin = true;
  } else {
    if (guncelTlrefPct === null) return null;
    const gunlukFaktor = 1 + guncelTlrefPct / 100 / 365;
    endeksSon = endeksSimdi * Math.pow(gunlukFaktor, gunFarki(hedefSon, tarihSimdi));
    tarihSon = hedefSon;
    kesin = false;
  }

  const n1 = gunFarki(donemSonu, donemBasi);
  const n2 = gunFarki(tarihSon, tarihBas);
  if (n1 <= 0 || n2 <= 0) return null;

  const donemKuponPct = tlrefDonemKuponOrani(endeksBas, endeksSon, n1, n2, ekGetiri);
  const yillikKuponPct = (Math.pow(1 + donemKuponPct / 100, 365 / n1) - 1) * 100;

  if (guncelTlrefPct === null) {
    guncelTlrefPct = (Math.pow(endeksSon / endeksBas, 1 / n2) - 1) * 365 * 100;
  }

  const gerceklesenGun = kesin ? n2 : Math.min(gunFarki(tarihSimdi, tarihBas), n2);

  // SON ÖDENEN kupon: bir önceki dönemin resmi formülle kesin kuponu.
  let sonOdenenKuponPct: number | null = null;
  if (donemIdx >= 1) {
    const prevBas = donemler[donemIdx - 1];
    const iPb = bisectLeft(seri.tarihler, prevBas) - 2;
    const iPs = bisectLeft(seri.tarihler, donemBasi) - 2;
    const nP1 = gunFarki(donemBasi, prevBas);
    if (iPb >= 0 && iPs > iPb && nP1 > 0) {
      const nP2 = gunFarki(seri.tarihler[iPs], seri.tarihler[iPb]);
      if (nP2 > 0) {
        sonOdenenKuponPct = tlrefDonemKuponOrani(
          seri.degerler[iPb],
          seri.degerler[iPs],
          nP1,
          nP2,
          ekGetiri,
        );
      }
    }
  }

  const birikmisGercek =
    (endeksSimdi / endeksBas - 1) * 100 + ekGetiri * (gunFarki(bugun, donemBasi) / n1);
  const kirliSimdi = temizFiyat + birikmisGercek;
  const gunKupona = gunFarki(donemSonu, bugun);
  if (gunKupona <= 0 || kirliSimdi <= 0) return null;

  const gunlukKupon = Math.pow(1 + (donemKuponPct - ekGetiri) / 100, 1 / n1) - 1;
  const varsayimDonemleri = donemler.slice(donemIdx);
  const varsayimKuponlari = [donemKuponPct];
  let varsayimGecerli = true;
  for (let i = donemIdx + 1; i < donemler.length - 1; i++) {
    const nI = gunFarki(donemler[i + 1], donemler[i]);
    if (nI <= 0) {
      varsayimGecerli = false;
      break;
    }
    varsayimKuponlari.push((Math.pow(1 + gunlukKupon, nI) - 1) * 100 + ekGetiri);
  }

  const bilesikGetiriPct = varsayimGecerli
    ? getiriBulAkislardan(
        donemselKuponAkislari(varsayimDonemleri, varsayimKuponlari),
        bugun,
        kirliSimdi,
      ) * 100
    : (Math.pow((100 + donemKuponPct) / kirliSimdi, 365 / gunKupona) - 1) * 100;

  return {
    yaklasikGetiriPct: bilesikGetiriPct,
    guncelTlrefOraniPct: guncelTlrefPct,
    sonOdenenKuponPct,
    birikmisGercekPct: birikmisGercek,
    gunKupona,
    donemKuponPct,
    yillikKuponPct,
    donemKuponKesinMi: kesin,
    gerceklesenGun: Math.max(gerceklesenGun, 0),
    donemBasi,
    donemSonu,
    gunKalanVade,
  };
}

// --------------------------------------------------------------------------
// 5b) Değişken Faizli ("Geçmiş İhalelere Endeksli") Devlet Tahvili
// --------------------------------------------------------------------------

export type ReferansIhale = { valor: Date; vade: Date; bf: number; ts: number };

/** HMB'nin resmi formülü: dönem başından önceki periyotGun/2 gün içinde valörü
 *  olan nitelikli ihalelerin TS-ağırlıklı ortalama bileşik faizinden dönemsel kupon. */
export function degiskenFaizliDonemKuponu(
  donemBasi: Date,
  referansIhaleler: ReferansIhale[],
  periyotGun = 182,
): { donemselKuponPct: number; aofPct: number } | null {
  const pencereGun = Math.floor(periyotGun / 2);
  const pencereBasi = gunEkle(donemBasi, -pencereGun);
  const nitelikli = referansIhaleler.filter(
    (r) => gunFarki(pencereBasi, r.valor) <= 0 && gunFarki(r.valor, donemBasi) < 0,
  );
  if (nitelikli.length === 0) return null;
  const toplamTs = nitelikli.reduce((a, r) => a + r.ts, 0);
  if (toplamTs <= 0) return null;
  const aof = nitelikli.reduce((a, r) => a + r.ts * r.bf, 0) / toplamTs;
  return {
    donemselKuponPct: (Math.pow(1 + aof / 100, periyotGun / 364) - 1) * 100,
    aofPct: aof,
  };
}

export type FrnGetiriSonucu = {
  getiriPct: number;
  donemKuponPct: number;
  aofPct: number;
  birikmisFaiz: number;
  kirliFiyat: number;
  donemBasi: Date;
  donemSonu: Date;
};

export function gecmisIhalelereEndeksliGetiri(
  ilkIhrac: Date,
  vade: Date,
  bugun: Date,
  temizFiyat: number,
  referansIhaleler: ReferansIhale[],
  periyotGun = 182,
): FrnGetiriSonucu | null {
  if (gunFarki(bugun, vade) >= 0 || temizFiyat == null || temizFiyat <= 0) return null;

  const donemler = kuponDonemleriGeriye(ilkIhrac, vade, periyotGun);
  let donemIdx = -1;
  for (let i = 0; i < donemler.length - 1; i++) {
    if (gunFarki(donemler[i], bugun) <= 0 && gunFarki(bugun, donemler[i + 1]) < 0) {
      donemIdx = i;
      break;
    }
  }
  if (donemIdx < 0) return null;
  const donemBasi = donemler[donemIdx];
  const donemSonu = donemler[donemIdx + 1];

  const kuponlar: number[] = [];
  let sonBilinenDf = 0;
  let sonAofPct = 0;
  for (let i = 0; i <= donemIdx; i++) {
    const sonuc = degiskenFaizliDonemKuponu(donemler[i], referansIhaleler, periyotGun);
    if (sonuc === null) return null;
    kuponlar.push(sonuc.donemselKuponPct);
    sonBilinenDf = sonuc.donemselKuponPct;
    sonAofPct = sonuc.aofPct;
  }
  for (let i = donemIdx + 1; i < donemler.length - 1; i++) kuponlar.push(sonBilinenDf);

  const akislar = donemselKuponAkislari(donemler.slice(donemIdx), kuponlar.slice(donemIdx));
  const donemKuponPct = kuponlar[donemIdx];
  const donemUzunlugu = gunFarki(donemSonu, donemBasi);
  const birikmisFaiz = donemUzunlugu
    ? (donemKuponPct * gunFarki(bugun, donemBasi)) / donemUzunlugu
    : 0;
  const hedefKirli = temizFiyat + birikmisFaiz;

  return {
    getiriPct: getiriBulAkislardan(akislar, bugun, hedefKirli) * 100,
    donemKuponPct,
    aofPct: sonAofPct,
    birikmisFaiz,
    kirliFiyat: hedefKirli,
    donemBasi,
    donemSonu,
  };
}

// --------------------------------------------------------------------------
// 6) TÜFE'ye Endeksli Devlet Tahvili
// --------------------------------------------------------------------------
//
// REEL getiri sabit-kupon motoruyla (getiriBul, kupon oranı = reel kupon)
// hiçbir tahmin gerekmeden KESİN hesaplanır -- ayrı bir fonksiyon yok.
// Aşağıdakiler reel -> nominal (TL) dönüşümü için resmi Endeks Oranı formülü.

export type TufeSeri = { tarihler: Date[]; duzeyler: number[] };

function ayOnce(yil: number, ay: number, n: number): [number, number] {
  const toplamAy = yil * 12 + (ay - 1) - n;
  return [Math.floor(toplamAy / 12), (((toplamAy % 12) + 12) % 12) + 1];
}

/** HMB resmi formülü:
 *  Referans Endeks_g = TÜFE_(a-3) + (g-1)/AG * (TÜFE_(a-2) - TÜFE_(a-3)) */
export function referansTufeEndeksi(tarih: Date, seri: TufeSeri): number | null {
  const harita = new Map<string, number>();
  seri.tarihler.forEach((t, i) => {
    harita.set(`${t.getUTCFullYear()}-${t.getUTCMonth() + 1}`, seri.duzeyler[i]);
  });
  const yil = tarih.getUTCFullYear();
  const ay = tarih.getUTCMonth() + 1;
  const [y3, a3] = ayOnce(yil, ay, 3);
  const [y2, a2] = ayOnce(yil, ay, 2);
  const tufeA3 = harita.get(`${y3}-${a3}`);
  const tufeA2 = harita.get(`${y2}-${a2}`);
  if (tufeA3 == null || tufeA2 == null) return null;
  const g = tarih.getUTCDate();
  const ag = new Date(Date.UTC(yil, ay, 0)).getUTCDate();
  return tufeA3 + ((g - 1) / ag) * (tufeA2 - tufeA3);
}

/** Endeks Oranı = Referans Endeks(tarih) / Referans Endeks(ihraç). */
export function tufeEndeksOrani(tarih: Date, ihracTarihi: Date, seri: TufeSeri): number | null {
  const refTarih = referansTufeEndeksi(tarih, seri);
  const refIhrac = referansTufeEndeksi(ihracTarihi, seri);
  if (refTarih === null || refIhrac === null || refIhrac === 0) return null;
  return refTarih / refIhrac;
}
