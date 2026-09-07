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
