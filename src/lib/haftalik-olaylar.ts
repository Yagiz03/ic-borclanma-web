/**
 * "Bu hafta ne var?" özeti -- panele girişte sağ üstte gösterilen bildirimin
 * içeriği. Takvim sayfasıyla AYNI kaynaklardan besleniyor: tcmb_takvim (PPK,
 * Enflasyon Raporu...), ihrac_takvimi (ihale / doğrudan satış), global takvim
 * (Fed/ECB/BOJ/BOE, ABD TÜFE/ÜFE) ve TÜİK'in enflasyon açıklama günü.
 */
import { createClient } from "@/lib/supabase/server";
import { globalOlaylariAyIcinBul, trEnflasyonGunu } from "@/lib/global-takvim";

export type HaftaOzeti = { olaylar: HaftaOlayi[]; ileriBakis: boolean };

export type HaftaOlayi = {
  /** ISO gün (YYYY-MM-DD) -- istemci tarafında gün adına çevriliyor. */
  tarih: string;
  etiket: string;
  /** Bildirimde renkli nokta için kaba tür. */
  tur: "ppk" | "ihale" | "global" | "enflasyon" | "diger";
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Bugünden itibaren bu haftanın (Pazartesi-Pazar) kalan günleri. */
export function haftaAraligi(bugun: Date): { baslangic: string; bitis: string } {
  const b = new Date(Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth(), bugun.getUTCDate()));
  // Haftanın son günü (Pazar): Pzt=1 ... Paz=0
  const haftaGunu = (b.getUTCDay() + 6) % 7; // 0=Pzt
  const pazar = new Date(b);
  pazar.setUTCDate(pazar.getUTCDate() + (6 - haftaGunu));
  return { baslangic: iso(b), bitis: iso(pazar) };
}

/**
 * Bu haftanın kalan günlerindeki olaylar. Hafta sonuna doğru bu aralık
 * boşalacağı için (ör. Cuma akşamı) hiç olay yoksa önümüzdeki 7 güne bakılıyor
 * -- bildirimin sessizce kaybolması yerine "önümüzdeki 7 gün" olarak çıkması
 * daha faydalı.
 */
export async function haftalikOlaylariGetir(bugun = new Date()): Promise<HaftaOzeti> {
  const buHafta = await olaylariAraliktaGetir(haftaAraligi(bugun));
  if (buHafta.length > 0) return { olaylar: buHafta, ileriBakis: false };

  const b = new Date(Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth(), bugun.getUTCDate()));
  const yediGunSonra = new Date(b);
  yediGunSonra.setUTCDate(yediGunSonra.getUTCDate() + 7);
  const ileri = await olaylariAraliktaGetir({ baslangic: iso(b), bitis: iso(yediGunSonra) });
  return { olaylar: ileri, ileriBakis: ileri.length > 0 };
}

async function olaylariAraliktaGetir({
  baslangic,
  bitis,
}: {
  baslangic: string;
  bitis: string;
}): Promise<HaftaOlayi[]> {
  const supabase = await createClient();

  const [{ data: tcmb }, { data: ihrac }] = await Promise.all([
    supabase.from("tcmb_takvim").select("tarih, tur").gte("tarih", baslangic).lte("tarih", bitis),
    supabase
      .from("ihrac_takvimi")
      .select("tarih, yontem, senet_turu, vade")
      .gte("tarih", baslangic)
      .lte("tarih", bitis),
  ]);

  return olaylariKur(tcmb ?? [], ihrac ?? [], { baslangic, bitis });
}

export type TcmbTakvimSatiri = { tarih: string; tur: string };
export type IhracTakvimSatiri = {
  tarih: string;
  yontem: string;
  senet_turu: string;
  vade: string | null;
};

/**
 * Ham satırlardan bildirim olaylarını kurar. Saf fonksiyon (veri erişimi yok)
 * -- gerçek verilere karşı test ediliyor.
 *
 * TEKİLLEŞTİRME: ihrac_takvimi'nde aynı ihale birden çok satır olarak
 * bulunabiliyor (aynı gün/senet/vade, ör. arka arkaya yayımlanan iki strateji
 * belgesinden gelen kayıtlar). Bildirimde aynı satırı iki kez göstermek
 * anlamsız olduğu için (tarih + etiket) çiftine göre tekilleştiriliyor.
 */
export function olaylariKur(
  tcmb: TcmbTakvimSatiri[],
  ihrac: IhracTakvimSatiri[],
  { baslangic, bitis }: { baslangic: string; bitis: string },
): HaftaOlayi[] {
  const olaylar: HaftaOlayi[] = [];

  for (const t of tcmb) {
    olaylar.push({
      tarih: String(t.tarih).slice(0, 10),
      etiket: t.tur,
      tur: String(t.tur).includes("PPK") ? "ppk" : "diger",
    });
  }

  for (const i of ihrac) {
    const kisa = String(i.yontem).startsWith("İhale") ? "İhale" : "Doğrudan satış";
    olaylar.push({
      tarih: String(i.tarih).slice(0, 10),
      etiket: `${kisa}: ${i.senet_turu}${i.vade ? ` (${i.vade})` : ""}`,
      tur: "ihale",
    });
  }

  // Global olaylar ay bazlı geliyor; hafta iki aya taşabildiği için iki ay
  // birden taranıp aralığa göre süzülüyor.
  for (const ayAnahtari of new Set([baslangic.slice(0, 7), bitis.slice(0, 7)])) {
    const [yil, ay] = ayAnahtari.split("-").map(Number);
    for (const o of globalOlaylariAyIcinBul(yil, ay)) {
      const t = `${ayAnahtari}-${String(o.gun).padStart(2, "0")}`;
      if (t >= baslangic && t <= bitis) olaylar.push({ tarih: t, etiket: o.etiket, tur: "global" });
    }
    // TÜİK enflasyon günü (Takvim sayfasında da yerli olay sayılıyor).
    const enf = iso(trEnflasyonGunu(yil, ay));
    if (enf >= baslangic && enf <= bitis) {
      olaylar.push({ tarih: enf, etiket: "Türkiye Enflasyonu (TÜFE + Yİ-ÜFE)", tur: "enflasyon" });
    }
  }

  const gorulen = new Set<string>();
  return olaylar
    .filter((o) => {
      const anahtar = `${o.tarih}|${o.etiket}`;
      if (gorulen.has(anahtar)) return false;
      gorulen.add(anahtar);
      return true;
    })
    .sort((a, b) => a.tarih.localeCompare(b.tarih) || a.etiket.localeCompare(b.etiket));
}
