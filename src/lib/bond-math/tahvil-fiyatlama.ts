/**
 * Türk DİBS (sabit kuponlu) fiyatlama -- tahvil_fiyatlama.py'nin (kök dizin,
 * Streamlit uygulaması) sabit-kuponlu çekirdeğinin TS portu. Sadece bu
 * dosyadaki fonksiyonların birebir karşılığı taşındı -- TLREF/TÜFE/Değişken
 * Faizli floater formülleri (Faz 3 kapsamı, ayrı ve çok daha karmaşık)
 * BURADA YOK. Python orijinaliyle golden-value testle doğrulanmadan bu
 * dosyadaki hesap mantığı değiştirilmemeli (bkz. proje CLAUDE.md: "tahvil_
 * fiyatlama.py -- DOKUNMA").
 *
 * Tüm tarihler UTC gece yarısı olarak tutulur (gunFarki/tarihUtc) -- yerel
 * saat dilimi kaymasının gün sayımını bozmaması için.
 */

export function tarihUtc(yil: number, ay: number, gun: number): Date {
  return new Date(Date.UTC(yil, ay - 1, gun));
}

function gunFarki(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function gunEkle(t: Date, gun: number): Date {
  return new Date(t.getTime() + gun * 86_400_000);
}

export type NakitAkisi = { tarih: Date; tutar: number };

/** Vadeden geriye sabit 182 (periyotAy=6) / 91 (periyotAy=3) gün adımlayarak
 * kupon takvimini kurar. Dönüş: [anchor, kupon_1, ..., vade] artan sırada. */
export function kuponTakvimi(vade: Date, anchor: Date, periyotAy: 3 | 6 = 6): Date[] {
  const adimGun = periyotAy === 6 ? 182 : 91;
  const tarihler: Date[] = [vade];
  let cur = vade;
  while (gunFarki(gunEkle(cur, -adimGun), anchor) > 0) {
    cur = gunEkle(cur, -adimGun);
    tarihler.push(cur);
  }
  tarihler.push(anchor);
  tarihler.reverse();
  return tarihler;
}

export function nakitAkislariniOlustur(
  vade: Date,
  anchor: Date,
  yillikKuponOrani: number,
  periyotAy: 3 | 6 = 6,
  nominal = 100,
): NakitAkisi[] {
  const takvim = kuponTakvimi(vade, anchor, periyotAy);
  const donemKuponu = (yillikKuponOrani / 2) * nominal;
  const akislar: NakitAkisi[] = [];
  for (let i = 1; i < takvim.length; i++) {
    const d = takvim[i];
    let tutar = donemKuponu;
    if (gunFarki(d, vade) === 0) tutar += nominal;
    akislar.push({ tarih: d, tutar });
  }
  return akislar;
}

export function kirliFiyatHesapla(akislar: NakitAkisi[], valor: Date, yillikGetiri: number): number {
  let toplam = 0;
  for (const a of akislar) {
    if (gunFarki(a.tarih, valor) <= 0) continue;
    const t = gunFarki(a.tarih, valor);
    toplam += a.tutar / Math.pow(1 + yillikGetiri, t / 365);
  }
  return toplam;
}

export function birikmisFaizHesapla(
  vade: Date,
  anchor: Date,
  valor: Date,
  yillikKuponOrani: number,
  periyotAy: 3 | 6 = 6,
  nominal = 100,
): number {
  const takvim = kuponTakvimi(vade, anchor, periyotAy);
  let onceki = takvim[0];
  let sonraki = takvim[takvim.length - 1];
  for (let i = 0; i < takvim.length - 1; i++) {
    if (gunFarki(takvim[i], valor) <= 0 && gunFarki(valor, takvim[i + 1]) < 0) {
      onceki = takvim[i];
      sonraki = takvim[i + 1];
      break;
    }
  }
  const donemKuponu = (yillikKuponOrani / 2) * nominal;
  const donemUzunlugu = gunFarki(sonraki, onceki);
  const gecenGun = gunFarki(valor, onceki);
  if (donemUzunlugu <= 0) return 0;
  return (donemKuponu * gecenGun) / donemUzunlugu;
}

export function temizFiyatHesapla(
  vade: Date,
  anchor: Date,
  valor: Date,
  yillikKuponOrani: number,
  yillikGetiri: number,
  periyotAy: 3 | 6 = 6,
  nominal = 100,
): { kirli: number; birikmis: number; temiz: number } {
  const akislar = nakitAkislariniOlustur(vade, anchor, yillikKuponOrani, periyotAy, nominal);
  const kirli = kirliFiyatHesapla(akislar, valor, yillikGetiri);
  const birikmis = birikmisFaizHesapla(vade, anchor, valor, yillikKuponOrani, periyotAy, nominal);
  return { kirli, birikmis, temiz: kirli - birikmis };
}

export function getiriBul(
  vade: Date,
  anchor: Date,
  valor: Date,
  yillikKuponOrani: number,
  hedefKirliFiyat: number,
  periyotAy: 3 | 6 = 6,
  nominal = 100,
  baslangicTahmini = 0.3,
  tolerans = 1e-8,
  maksIter = 100,
): number {
  const akislar = nakitAkislariniOlustur(vade, anchor, yillikKuponOrani, periyotAy, nominal);
  let y = baslangicTahmini;
  for (let i = 0; i < maksIter; i++) {
    const fiyat = kirliFiyatHesapla(akislar, valor, y);
    const fark = fiyat - hedefKirliFiyat;
    if (Math.abs(fark) < tolerans) return y;
    const eps = 1e-6;
    const fiyatEps = kirliFiyatHesapla(akislar, valor, y + eps);
    const turev = (fiyatEps - fiyat) / eps;
    if (turev === 0) break;
    y = y - fark / turev;
  }
  return y;
}

export function modifiedDurationHesapla(
  akislar: NakitAkisi[],
  valor: Date,
  yillikGetiri: number,
): { macaulay: number; modified: number } {
  let kirli = 0;
  let agirlikliZaman = 0;
  for (const a of akislar) {
    if (gunFarki(a.tarih, valor) <= 0) continue;
    const tYil = gunFarki(a.tarih, valor) / 365;
    const iskontoEdilmis = a.tutar / Math.pow(1 + yillikGetiri, tYil);
    kirli += iskontoEdilmis;
    agirlikliZaman += tYil * iskontoEdilmis;
  }
  if (kirli === 0) return { macaulay: 0, modified: 0 };
  const macaulay = agirlikliZaman / kirli;
  return { macaulay, modified: macaulay / (1 + yillikGetiri) };
}

export function dv01Hesapla(akislar: NakitAkisi[], valor: Date, yillikGetiri: number): number {
  const bp = 0.0001;
  const fAsagi = kirliFiyatHesapla(akislar, valor, yillikGetiri - bp / 2);
  const fYukari = kirliFiyatHesapla(akislar, valor, yillikGetiri + bp / 2);
  return fAsagi - fYukari;
}

export function konveksiteHesapla(akislar: NakitAkisi[], valor: Date, yillikGetiri: number): number {
  const h = 0.0001;
  const p0 = kirliFiyatHesapla(akislar, valor, yillikGetiri);
  if (p0 === 0) return 0;
  const pAsagi = kirliFiyatHesapla(akislar, valor, yillikGetiri - h);
  const pYukari = kirliFiyatHesapla(akislar, valor, yillikGetiri + h);
  return (pYukari - 2 * p0 + pAsagi) / (p0 * h * h);
}
