import type { SupabaseClient } from "@supabase/supabase-js";
import { trTarihAyristir } from "@/lib/tarih";

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const ALTIN_TANIMLARI = ["Altın Tahvili", "Altına Dayalı Kira Sertifikası"];

type IhaleSatir = {
  isin: string;
  ihale_tarihi: string;
  senet_tanimi?: string | null;
  vade_tarihi?: string | null;
  toplam_gerceklesme_mn: number | null;
  kamu_kurumlari_gerceklesme_mn: number | null;
  piyasa_yapicilar_gerceklesme_mn: number | null;
  kaynak_url?: string | null;
};

function ayYilEsit(tarihMetin: string | null | undefined, yil: number, ay: number): boolean {
  const d = trTarihAyristir(tarihMetin);
  return !!d && d.getFullYear() === yil && d.getMonth() + 1 === ay;
}

/** "4.10.2028" / "04.10.2028" -> "04.10.2028" (ihale_sonuclari.vade_tarihi ile aynı biçim) */
function tarihPadle(s: string | null | undefined): string | null {
  if (!s) return null;
  const parca = s.trim().split(".");
  if (parca.length !== 3) return null;
  const [g, a, y] = parca;
  return `${g.padStart(2, "0")}.${a.padStart(2, "0")}.${y}`;
}

function sayiToplam(satirlar: IhaleSatir[], kolon: keyof IhaleSatir): number {
  return satirlar.reduce((acc, r) => acc + (Number(r[kolon]) || 0), 0);
}

/** `seri` tarihe göre artan sıralı olmalı -- `tarih`te ya da ondan önceki son gözlemi döner. */
function kurBul(seri: { tarih: string; deger: number }[], tarih: Date): number | null {
  let sonuc: number | null = null;
  for (const r of seri) {
    const d = trTarihAyristir(r.tarih);
    if (d && d.getTime() <= tarih.getTime()) {
      sonuc = r.deger;
    } else if (d && d.getTime() > tarih.getTime()) {
      break;
    }
  }
  return sonuc;
}

async function dogrudanSatisGerceklesen(
  supabase: SupabaseClient,
  yil: number,
  ay: number,
): Promise<number | null> {
  const [{ data: kira }, { data: fx }, { data: altin }] = await Promise.all([
    supabase.from("kira_sertifikasi_ihrac").select("ihrac_tarihi, tutar_tl"),
    supabase.from("fx_dibs_sonuc").select("ihrac_tarihi, doviz_cinsi, gerceklesen_tutar"),
    supabase.from("altin_ihrac_sonuclari").select("ihrac_tarihi, valor_tarihi, miktar_kg"),
  ]);
  if (!kira?.length && !fx?.length && !altin?.length) return null;

  let toplamTl = 0;

  for (const r of kira ?? []) {
    if (ayYilEsit(r.ihrac_tarihi, yil, ay)) toplamTl += Number(r.tutar_tl) || 0;
  }

  const buAyFx = (fx ?? []).filter((r) => ayYilEsit(r.ihrac_tarihi, yil, ay));
  if (buAyFx.length > 0) {
    const { data: evds } = await supabase
      .from("evds_seriler")
      .select("seri_adi, tarih, deger")
      .in("seri_adi", ["usdtry", "eurtry"])
      .not("deger", "is", null)
      .order("tarih");
    const usdtry = (evds ?? []).filter((r) => r.seri_adi === "usdtry") as { tarih: string; deger: number }[];
    const eurtry = (evds ?? []).filter((r) => r.seri_adi === "eurtry") as { tarih: string; deger: number }[];
    for (const r of buAyFx) {
      const tarih = trTarihAyristir(r.ihrac_tarihi);
      if (!tarih) continue;
      const seri = r.doviz_cinsi === "USD" ? usdtry : eurtry;
      const kur = kurBul(seri, tarih);
      if (kur != null) toplamTl += (Number(r.gerceklesen_tutar) || 0) * kur;
    }
  }

  const buAyAltin = (altin ?? [])
    .map((r) => ({ ...r, tarih: r.ihrac_tarihi ?? r.valor_tarihi }))
    .filter((r) => r.tarih && ayYilEsit(r.tarih, yil, ay));
  if (buAyAltin.length > 0) {
    const { data: isinOzet } = await supabase
      .from("isin_ozet")
      .select("isin, senet_tanimi")
      .in("senet_tanimi", ALTIN_TANIMLARI);
    const altinIsinler = new Set((isinOzet ?? []).map((r) => r.isin));
    let gramFiyatSerisi: { tarih: string; deger: number }[] = [];
    if (altinIsinler.size > 0) {
      const { data: bist } = await supabase
        .from("bist_bap_fiyatlar")
        .select("isin, tarih, temiz_fiyat")
        .in("isin", Array.from(altinIsinler));
      const gunlukGruplar = new Map<string, number[]>();
      for (const r of bist ?? []) {
        if (r.temiz_fiyat == null) continue;
        const liste = gunlukGruplar.get(r.tarih) ?? [];
        liste.push(Number(r.temiz_fiyat));
        gunlukGruplar.set(r.tarih, liste);
      }
      gramFiyatSerisi = Array.from(gunlukGruplar.entries())
        .map(([tarih, degerler]) => {
          const sirali = [...degerler].sort((a, b) => a - b);
          const orta = sirali.length / 2;
          const medyan = sirali.length % 2 === 0
            ? (sirali[orta - 1] + sirali[orta]) / 2
            : sirali[Math.floor(orta)];
          return { tarih, deger: medyan };
        })
        .sort((a, b) => (trTarihAyristir(a.tarih)?.getTime() ?? 0) - (trTarihAyristir(b.tarih)?.getTime() ?? 0));
    }
    for (const r of buAyAltin) {
      const tarih = trTarihAyristir(r.tarih);
      if (!tarih) continue;
      const fiyat = gramFiyatSerisi.length > 0 ? kurBul(gramFiyatSerisi, tarih) : null;
      if (fiyat != null) toplamTl += (Number(r.miktar_kg) || 0) * 1000 * fiyat;
    }
  }

  return toplamTl / 1_000_000_000;
}

export type FinansmanKalem = {
  kalem: string;
  aciklama?: string;
  plan: number | null;
  gerceklesen: number | null;
  kalan: number | null;
  oran: number | null;
};

export type KagitSatiri = {
  ihale_tarihi: string;
  isin: string;
  senet_tanimi: string | null;
  kamu_kurumlari_mn: number | null;
  piyasa_yapicilar_mn: number | null;
  kaynak_url: string | null;
};

export type KalanIhaleSatiri = {
  ihale_tarihi: string;
  isin: string;
  senet_turu: string;
};

export type YtdSatiri = {
  ay: string;
  plan: number | null;
  gerceklesen: number | null;
  oran: number | null;
  planKamu: number | null;
  kamuRot: number | null;
  arsivdeYok: boolean;
};

export type FinansmanIlerlemeVerisi = {
  ayLabel: string;
  kalemler: FinansmanKalem[];
  kagitlar: KagitSatiri[];
  kalanIhaleler: KalanIhaleSatiri[];
  kalanBaslik: string;
  ytd: YtdSatiri[];
  bazıAylarArsivdeYok: boolean;
} | null;

export async function finansmanIlerlemeVerisiGetir(
  supabase: SupabaseClient,
): Promise<FinansmanIlerlemeVerisi> {
  const bugun = new Date();
  const yil = bugun.getFullYear();
  const ayNo = bugun.getMonth() + 1;
  const ayLabel = `${yil} ${AY_ADLARI[ayNo - 1]}`;

  const [{ data: planlar }, { data: ihaleler }, { data: takvim }] = await Promise.all([
    supabase.from("finansman_planlari").select("*").eq("yil", yil).lte("ay", ayNo),
    supabase
      .from("ihale_sonuclari")
      .select(
        "isin, ihale_tarihi, senet_tanimi, vade_tarihi, toplam_gerceklesme_mn, kamu_kurumlari_gerceklesme_mn, piyasa_yapicilar_gerceklesme_mn, kaynak_url",
      ),
    supabase.from("ihrac_takvimi").select("tarih, yontem, senet_turu, itfa_tarihi").order("tarih"),
  ]);

  const planBu = (planlar ?? []).find((p) => p.ay === ayNo);
  if (!planBu || planBu.piyasadan_ihale == null) return null;

  const tumIhaleler = (ihaleler ?? []) as IhaleSatir[];

  const buAy = tumIhaleler.filter((r) => ayYilEsit(r.ihale_tarihi, yil, ayNo));
  const toplamGerceklesen = sayiToplam(buAy, "toplam_gerceklesme_mn") / 1000;
  const kamuToplam = sayiToplam(buAy, "kamu_kurumlari_gerceklesme_mn") / 1000;
  const gerceklesen = toplamGerceklesen - kamuToplam;
  const planIhale = Number(planBu.piyasadan_ihale);
  const kalan = Math.max(planIhale - gerceklesen, 0);
  const oranTam = planIhale ? gerceklesen / planIhale : 0;

  const planKamu = planBu.kamuya_satislar != null ? Number(planBu.kamuya_satislar) : null;
  const kalanKamu = planKamu != null ? Math.max(planKamu - kamuToplam, 0) : null;
  const oranKamu = planKamu ? kamuToplam / planKamu : null;

  const planToplamIc = planBu.ic_borclanma != null ? Number(planBu.ic_borclanma) : null;
  const planDogrudan = planBu.dogrudan_satislar != null ? Number(planBu.dogrudan_satislar) : null;

  const dogrudanGerceklesen = await dogrudanSatisGerceklesen(supabase, yil, ayNo);
  const kalanDogrudan =
    planDogrudan != null && dogrudanGerceklesen != null ? Math.max(planDogrudan - dogrudanGerceklesen, 0) : null;
  const oranDogrudan = planDogrudan && dogrudanGerceklesen != null ? dogrudanGerceklesen / planDogrudan : null;

  const toplamIcGerceklesen = gerceklesen + (dogrudanGerceklesen ?? 0) + kamuToplam;
  const kalanToplamIc = planToplamIc != null ? Math.max(planToplamIc - toplamIcGerceklesen, 0) : null;
  const oranToplamIc = planToplamIc ? toplamIcGerceklesen / planToplamIc : null;

  const kalemler: FinansmanKalem[] = [
    { kalem: "İç Borçlanma (Toplam)", plan: planToplamIc, gerceklesen: toplamIcGerceklesen, kalan: kalanToplamIc, oran: oranToplamIc },
    { kalem: "Piyasadan İhale (Piyasa Yapıcılar + Diğer)", plan: planIhale, gerceklesen, kalan, oran: oranTam },
    {
      kalem: "Doğrudan Satışlar",
      aciklama: "Gerçekleşen: Kira Sertifikası + FX DİBS/Kira Sertifikası + Altın Tahvili/Kira Sertifikası (yaklaşıklık)",
      plan: planDogrudan, gerceklesen: dogrudanGerceklesen, kalan: kalanDogrudan, oran: oranDogrudan,
    },
    {
      kalem: "Kamuya Satışlar",
      aciklama: "Gösterilen Gerçekleşen aslında ihale içi kamu ROT katılımıdır -- AYNI KANAL DEĞİL, bilgi amaçlıdır.",
      plan: planKamu, gerceklesen: kamuToplam, kalan: kalanKamu, oran: oranKamu,
    },
  ];

  // ---- Bu ay hangi kağıttan ne kadar geldi ----
  const kagitlar: KagitSatiri[] = [...buAy]
    .sort((a, b) => (trTarihAyristir(a.ihale_tarihi)?.getTime() ?? 0) - (trTarihAyristir(b.ihale_tarihi)?.getTime() ?? 0))
    .map((r) => ({
      ihale_tarihi: r.ihale_tarihi,
      isin: r.isin,
      senet_tanimi: r.senet_tanimi ?? null,
      kamu_kurumlari_mn: r.kamu_kurumlari_gerceklesme_mn != null ? Number(r.kamu_kurumlari_gerceklesme_mn) / 1000 : null,
      piyasa_yapicilar_mn: r.piyasa_yapicilar_gerceklesme_mn != null ? Number(r.piyasa_yapicilar_gerceklesme_mn) / 1000 : null,
      kaynak_url: r.kaynak_url ?? null,
    }));

  // ---- Bu ay kalan ihaleler (ya da gelecek ayın planı) ----
  const isinLookup = new Map<string, string>();
  for (const r of tumIhaleler) {
    if (!r.senet_tanimi || !r.vade_tarihi) continue;
    const anahtar = `${r.senet_tanimi}|${tarihPadle(r.vade_tarihi)}`;
    if (!isinLookup.has(anahtar)) isinLookup.set(anahtar, r.isin);
  }
  const gerceklesmisSet = new Set(
    buAy.map((r) => `${trTarihAyristir(r.ihale_tarihi)?.toDateString()}|${r.senet_tanimi}`),
  );

  function ayIcinKalanlariBul(hedefYil: number, hedefAy: number): KalanIhaleSatiri[] {
    const bugunSaatsiz = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
    return (takvim ?? [])
      .filter((r) => {
        if (!r.yontem?.startsWith("İhale")) return false;
        const d = new Date(r.tarih);
        if (d.getFullYear() !== hedefYil || d.getMonth() + 1 !== hedefAy) return false;
        if (hedefAy === ayNo && hedefYil === yil) {
          if (d < bugunSaatsiz) return false;
          if (gerceklesmisSet.has(`${d.toDateString()}|${r.senet_turu}`)) return false;
        }
        return true;
      })
      .map((r) => {
        const anahtar = `${r.senet_turu}|${tarihPadle(r.itfa_tarihi)}`;
        return {
          ihale_tarihi: new Date(r.tarih).toLocaleDateString("tr-TR"),
          isin: isinLookup.get(anahtar) ?? "–",
          senet_turu: r.senet_turu,
        };
      });
  }

  let kalanIhaleler = ayIcinKalanlariBul(yil, ayNo);
  let kalanBaslik = "Bu ay kalan ihaleler";
  if (kalanIhaleler.length === 0) {
    const gelecekAyNo = ayNo < 12 ? ayNo + 1 : 1;
    const gelecekYil = ayNo < 12 ? yil : yil + 1;
    const { data: planGelecek } = await supabase
      .from("finansman_planlari")
      .select("piyasadan_ihale")
      .eq("yil", gelecekYil)
      .eq("ay", gelecekAyNo)
      .maybeSingle();
    if (planGelecek?.piyasadan_ihale != null) {
      kalanIhaleler = ayIcinKalanlariBul(gelecekYil, gelecekAyNo);
      kalanBaslik = `Gelecek ay (${gelecekYil} ${AY_ADLARI[gelecekAyNo - 1]}) planlanan ihaleler`;
    }
  }

  // ---- Yılbaşından bu yana aylık ilerleme ----
  const ytd: YtdSatiri[] = [];
  for (let m = 1; m <= ayNo; m++) {
    const etiket = `${yil} ${AY_ADLARI[m - 1]}`;
    const planM = (planlar ?? []).find((p) => p.ay === m);
    if (!planM || planM.piyasadan_ihale == null) {
      ytd.push({ ay: etiket, plan: null, gerceklesen: null, oran: null, planKamu: null, kamuRot: null, arsivdeYok: true });
      continue;
    }
    const oAy = tumIhaleler.filter((r) => ayYilEsit(r.ihale_tarihi, yil, m));
    const toplamG = sayiToplam(oAy, "toplam_gerceklesme_mn") / 1000;
    const kamuG = sayiToplam(oAy, "kamu_kurumlari_gerceklesme_mn") / 1000;
    const ihaleG = toplamG - kamuG;
    const planIhaleM = Number(planM.piyasadan_ihale);
    ytd.push({
      ay: etiket,
      plan: Math.round(planIhaleM * 10) / 10,
      gerceklesen: Math.round(ihaleG * 10) / 10,
      oran: planIhaleM ? ihaleG / planIhaleM : null,
      planKamu: planM.kamuya_satislar != null ? Math.round(Number(planM.kamuya_satislar) * 10) / 10 : null,
      kamuRot: Math.round(kamuG * 10) / 10,
      arsivdeYok: false,
    });
  }

  return {
    ayLabel,
    kalemler,
    kagitlar,
    kalanIhaleler,
    kalanBaslik,
    ytd,
    bazıAylarArsivdeYok: ytd.some((r) => r.arsivdeYok),
  };
}
