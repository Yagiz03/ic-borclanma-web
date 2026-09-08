import { TR_TATILLERI } from "./tr-tatilleri";

const TATIL_SETI = new Set(TR_TATILLERI);
const REPO_KOMISYON_GUNLUK = 6.825e-6;
const TAKAS_KOMISYON_SABIT = 3.4776 / 100_000;
const TAKAS_KOMISYON_GUNLUK = 0.40572 / 100_000;

function isoStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function gunEkle(d: Date, gun: number): Date {
  const yeni = new Date(d.getTime());
  yeni.setUTCDate(yeni.getUTCDate() + gun);
  return yeni;
}

function isGunuMu(d: Date): boolean {
  const gun = d.getUTCDay();
  return gun !== 0 && gun !== 6 && !TATIL_SETI.has(isoStr(d));
}

export function isGunuSayisi(baslangic: Date, gun: number): number {
  const bitis = gunEkle(baslangic, gun);
  let sayi = 0;
  for (let t = new Date(baslangic.getTime()); t.getTime() <= bitis.getTime(); t = gunEkle(t, 1)) {
    if (isGunuMu(t)) sayi++;
  }
  return sayi - 1;
}

export function takasKomisyonu(gun: number): number {
  return gun <= 8 ? TAKAS_KOMISYON_SABIT : gun * TAKAS_KOMISYON_GUNLUK;
}

function gunlukBileşikOran(gun: number, getiri: number, isGunu: number): number {
  const s = gun + 3 * (gun - isGunu);
  const m = getiri / 100;
  return (gun - Math.sqrt(gun * gun - 2 * s * Math.log(m))) / s;
}

function onEslenik(gun: number, getiri: number, isGunu: number, repoKomisyon = REPO_KOMISYON_GUNLUK): number {
  return (gunlukBileşikOran(gun, getiri, isGunu) + repoKomisyon) * 365;
}

function netOnEslenik(gun: number, getiri: number, isGunu: number): number {
  return gunlukBileşikOran(gun, getiri, isGunu) * 365;
}

export type TakasMevduatSonuc = {
  getiri: number;
  isGunu: number;
  onEslenik: number;
  netOnEslenik: number;
  mevduatEslenigi?: number;
  takasEslenigi?: number;
};

export function takasHesapla(gun: number, takasOran: number, baslangic: Date, repoKomisyon = REPO_KOMISYON_GUNLUK): TakasMevduatSonuc {
  const isGunu = isGunuSayisi(baslangic, gun);
  const getiri = 100 * (1 + (takasOran / 365) * gun - takasKomisyonu(gun));
  return {
    getiri,
    isGunu,
    onEslenik: onEslenik(gun, getiri, isGunu, repoKomisyon),
    netOnEslenik: netOnEslenik(gun, getiri, isGunu),
    mevduatEslenigi: (getiri / 100 - 1) * 365 / gun,
  };
}

export function mevduatHesapla(gun: number, mevduatOran: number, baslangic: Date, repoKomisyon = REPO_KOMISYON_GUNLUK): TakasMevduatSonuc {
  const isGunu = isGunuSayisi(baslangic, gun);
  const getiri = 100 * (1 + (mevduatOran / 365) * gun);
  return {
    getiri,
    isGunu,
    onEslenik: onEslenik(gun, getiri, isGunu, repoKomisyon),
    netOnEslenik: netOnEslenik(gun, getiri, isGunu),
    takasEslenigi: (getiri / 100 - 1 + takasKomisyonu(gun)) * 365 / gun,
  };
}

export type OranDonemi = { baslangic: Date; oran: number };

/** O/N repoyu her iş günü çevirerek (rollover) günlük değer patikası --
 * core.takas_repo.on_repo_patikasi'nin portu. `oranDonemleri` tarihe göre
 * artan sırada olmalı; işlem günü hangi dönemin içindeyse o oran kullanılır. */
export function onRepoPatikasi(
  gun: number, oranDonemleri: OranDonemi[], baslangic: Date,
  repoKomisyon = REPO_KOMISYON_GUNLUK, baslangicDeger = 100,
): Map<string, number> {
  const bitis = gunEkle(baslangic, gun);
  const donemler = [...oranDonemleri].sort((a, b) => a.baslangic.getTime() - b.baslangic.getTime());

  function oranBul(t: Date): number {
    let aktif = donemler[0].oran;
    for (const d of donemler) {
      if (t.getTime() >= d.baslangic.getTime()) aktif = d.oran;
    }
    return aktif;
  }

  const patika = new Map<string, number>();
  patika.set(isoStr(baslangic), baslangicDeger);
  let deger = baslangicDeger;
  let t = new Date(baslangic.getTime());
  while (t.getTime() < bitis.getTime() && !isGunuMu(t)) {
    t = gunEkle(t, 1);
    patika.set(isoStr(t), deger);
  }
  while (t.getTime() < bitis.getTime()) {
    let sonraki = gunEkle(t, 1);
    while (sonraki.getTime() < bitis.getTime() && !isGunuMu(sonraki)) sonraki = gunEkle(sonraki, 1);
    const w = Math.round((sonraki.getTime() - t.getTime()) / 86_400_000);
    const oran = oranBul(t);
    for (let k = 1; k <= w; k++) {
      patika.set(isoStr(gunEkle(t, k)), deger * (1 + (oran / 365) * k - repoKomisyon * w));
    }
    deger = patika.get(isoStr(sonraki))!;
    t = sonraki;
  }
  return patika;
}

/** Takas işleminin günlük değer patikası -- komisyon 1. günden düşük,
 * faiz oran/365 ile doğrusal. */
export function takasPatikasi(gun: number, takasOran: number, baslangic: Date, baslangicDeger = 100): Map<string, number> {
  const kom = takasKomisyonu(gun);
  const patika = new Map<string, number>();
  patika.set(isoStr(baslangic), baslangicDeger);
  for (let k = 1; k <= gun; k++) {
    patika.set(isoStr(gunEkle(baslangic, k)), baslangicDeger * (1 + (takasOran / 365) * k - kom));
  }
  return patika;
}

/** Mevduatın günlük değer patikası -- komisyonsuz doğrusal faiz işleyişi. */
export function mevduatPatikasi(gun: number, mevduatOran: number, baslangic: Date, baslangicDeger = 100): Map<string, number> {
  const patika = new Map<string, number>();
  for (let k = 0; k <= gun; k++) {
    patika.set(isoStr(gunEkle(baslangic, k)), baslangicDeger * (1 + (mevduatOran / 365) * k));
  }
  return patika;
}

/**
 * TLREF'e endeksli kağıdın senaryo altındaki kirli fiyat patikası --
 * core/tlref_senaryo.py::tlref_kirli_patika'nın portu.
 *
 * (100 + birikmiş) anapara+kupon tabanı, her İŞ GÜNÜ bloğunda senaryo TLREF
 * oranıyla işler (hafta sonu/tatil, önceki iş gününün oranıyla birlikte
 * sayılır). Kupon gününde birikmiş (+ dönemsel ek getiri) ödenip sıfırlanır.
 *
 * Dönüş: { patika: gün -> kirli fiyat, odemeler: kupon günü -> ödenen kupon }
 */
export function tlrefKirliPatika(
  temizFiyat: number,
  birikmisBaslangic: number,
  gun: number,
  oranDonemleri: OranDonemi[],
  kuponTarihleri: Date[],
  ekGetiriDonemsel = 0,
  baslangic: Date,
): { patika: Map<string, number>; odemeler: Map<string, number> } {
  const bitis = gunEkle(baslangic, gun);
  const donemler = [...oranDonemleri].sort((a, b) => a.baslangic.getTime() - b.baslangic.getTime());
  const kuponlar = kuponTarihleri
    .filter((t) => t.getTime() > baslangic.getTime() && t.getTime() <= bitis.getTime())
    .sort((a, b) => a.getTime() - b.getTime());

  function oranBul(t: Date): number {
    let aktif = donemler[0].oran;
    for (const d of donemler) {
      if (t.getTime() >= d.baslangic.getTime()) aktif = d.oran;
    }
    return aktif;
  }

  const patika = new Map<string, number>();
  const odemeler = new Map<string, number>();
  let birikmis = birikmisBaslangic;
  patika.set(isoStr(baslangic), temizFiyat + birikmis);

  let t = new Date(baslangic.getTime());
  while (t.getTime() < bitis.getTime()) {
    if (isGunuMu(t)) {
      let sonraki = gunEkle(t, 1);
      while (sonraki.getTime() < bitis.getTime() && !isGunuMu(sonraki)) sonraki = gunEkle(sonraki, 1);
      const w = Math.round((sonraki.getTime() - t.getTime()) / 86_400_000);
      const gunlukFaiz = (100 + birikmis) * (oranBul(t) / 365);
      for (let k = 1; k <= w; k++) {
        patika.set(isoStr(gunEkle(t, k)), temizFiyat + birikmis + gunlukFaiz * k);
      }
      birikmis += gunlukFaiz * w;
      t = sonraki;
    } else {
      t = gunEkle(t, 1);
      if (!patika.has(isoStr(t))) patika.set(isoStr(t), temizFiyat + birikmis);
    }

    // Kupon günü geldiyse: birikmiş (+ ek getiri) ödenir, sıfırlanır.
    while (kuponlar.length > 0 && kuponlar[0].getTime() <= t.getTime()) {
      const kuponGunu = kuponlar.shift()!;
      odemeler.set(isoStr(kuponGunu), birikmis + ekGetiriDonemsel);
      birikmis = 0;
      patika.set(isoStr(kuponGunu), temizFiyat);
    }
  }
  return { patika, odemeler };
}
