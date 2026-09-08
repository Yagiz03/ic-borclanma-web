// core/global_takvim.py'nin statik takvim verisinin portu -- Fed/ECB/BOJ/BOE
// faiz kararı günleri ve ABD CPI/PPI açıklama günleri. Kaynaklar Python
// tarafındaki dosyanın başlığında listeli (23.07.2026'da doğrulandı).

const FED_KARAR: Record<number, string[]> = {
  2026: ["01-28", "03-18", "04-29", "06-17", "07-29", "09-16", "10-28", "12-09"],
  2027: ["01-27", "03-17", "04-28", "06-09", "07-28", "09-15", "10-27", "12-08"],
};
const ECB_KARAR: Record<number, string[]> = {
  2026: ["02-05", "03-19", "04-30", "06-11", "07-23", "09-10", "10-29", "12-17"],
  2027: ["03-18", "04-29", "06-10", "07-22", "09-09", "10-28", "12-16"],
};
const BOJ_KARAR: Record<number, string[]> = {
  2026: ["01-23", "03-19", "04-28", "06-16", "07-31", "09-18", "10-30", "12-18"],
};
const BOE_KARAR: Record<number, string[]> = {
  2026: ["02-05", "03-19", "04-30", "06-18", "07-30", "09-17", "11-05", "12-17"],
  2027: ["02-04", "03-18", "04-29", "06-17", "07-29", "09-16", "11-04", "12-16"],
};
const ABD_CPI: Record<number, [string, string][]> = {
  2026: [
    ["01-13", "Aralık 2025"], ["02-13", "Ocak"], ["03-11", "Şubat"], ["04-10", "Mart"],
    ["05-12", "Nisan"], ["06-10", "Mayıs"], ["07-14", "Haziran"], ["08-12", "Temmuz"],
    ["09-11", "Ağustos"], ["10-14", "Eylül"], ["11-10", "Ekim"], ["12-10", "Kasım"],
  ],
};
const ABD_PPI: Record<number, [string, string][]> = {
  2026: [
    ["01-14", "Kasım 2025"], ["01-30", "Aralık 2025"], ["02-27", "Ocak"], ["03-18", "Şubat"],
    ["04-14", "Mart"], ["05-13", "Nisan"], ["06-11", "Mayıs"], ["07-15", "Haziran"],
    ["08-13", "Temmuz"], ["09-10", "Ağustos"], ["10-15", "Eylül"], ["11-13", "Ekim"], ["12-15", "Kasım"],
  ],
};

export type GlobalOlay = { gun: number; etiket: string; detay: string };

function ayGunEsit(ayGun: string, ay: number): number | null {
  const [a, g] = ayGun.split("-").map(Number);
  return a === ay ? g : null;
}

/** TÜİK'in TÜFE/Yİ-ÜFE açıklama günü: ayın 3'ü, hafta sonuysa ilk iş günü. */
export function trEnflasyonGunu(yil: number, ay: number): Date {
  const t = new Date(Date.UTC(yil, ay - 1, 3));
  while (t.getUTCDay() === 0 || t.getUTCDay() === 6) t.setUTCDate(t.getUTCDate() + 1);
  return t;
}

export function globalOlaylariAyIcinBul(yil: number, ay: number): GlobalOlay[] {
  const olaylar: GlobalOlay[] = [];
  for (const [kaynak, etiket, detay] of [
    [FED_KARAR, "Fed Faiz Kararı (FOMC)", "Karar 14:00 ET, basın toplantısı 14:30 ET"],
    [ECB_KARAR, "ECB Faiz Kararı", "Karar 14:15 CET, basın toplantısı 14:45 CET"],
    [BOJ_KARAR, "BOJ Faiz Kararı", "Toplantının 2. günü, öğle saatlerinde (JST)"],
    [BOE_KARAR, "BOE Faiz Kararı", "Karar 12:00 UK saati (Perşembe)"],
  ] as [Record<number, string[]>, string, string][]) {
    for (const ayGun of kaynak[yil] ?? []) {
      const gun = ayGunEsit(ayGun, ay);
      if (gun != null) olaylar.push({ gun, etiket, detay });
    }
  }
  for (const [kaynak, etiket] of [
    [ABD_CPI, "ABD TÜFE (CPI)"],
    [ABD_PPI, "ABD ÜFE (PPI)"],
  ] as [Record<number, [string, string][]>, string][]) {
    for (const [ayGun, refAy] of kaynak[yil] ?? []) {
      const gun = ayGunEsit(ayGun, ay);
      if (gun != null) olaylar.push({ gun, etiket, detay: `${refAy} verisi — 08:30 ET (BLS)` });
    }
  }
  return olaylar.sort((a, b) => a.gun - b.gun || a.etiket.localeCompare(b.etiket));
}
