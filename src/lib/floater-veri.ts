/**
 * Floater (TLREF / Değişken Faizli / TÜFE'ye endeksli) fiyatlama girdilerinin
 * Supabase'ten yüklenmesi -- core/data.py'deki tlref_serisi_yukle,
 * tufe_duzey_serisi_yukle ve degisken_faizli_referans_ihaleleri_yukle'nin
 * karşılıkları. Sunucu tarafında (RSC) çalışır.
 */
import { createClient } from "@/lib/supabase/server";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";
import { trTarihAyristir } from "@/lib/tarih";

export type SeriNoktalari = { tarihler: string[]; degerler: number[] };

type EvdsSatir = { seri_adi: string; tarih: string; deger: number | null };

async function evdsSeri(seriAdi: string): Promise<SeriNoktalari> {
  const supabase = await createClient();
  const { data } = await tumSatirlariGetir<EvdsSatir>((from, to) =>
    supabase
      .from("evds_seriler")
      .select("seri_adi, tarih, deger")
      .eq("seri_adi", seriAdi)
      .order("tarih")
      .range(from, to),
  );
  const satirlar = (data ?? []).filter((r) => r.tarih && r.deger != null);
  return {
    tarihler: satirlar.map((r) => r.tarih.slice(0, 10)),
    degerler: satirlar.map((r) => Number(r.deger)),
  };
}

/** BIST TLREF ENDEKSİ (oran değil) -- evds_seriler.tlref_kapanis. */
export const tlrefEndeksSerisiYukle = () => evdsSeri("tlref_kapanis");

/**
 * TÜFE ENDEKS DÜZEYİ (aylık, ayın ilk günü damgalı).
 *
 * TÜİK 2026 başında TÜFE'yi 2025=100 tabanına çevirdi: eski 2003=100 serisi
 * (evds_seriler.tufe_duzey) Ocak 2026'da DURDU, güncel veri yeni tabandan
 * (tufe_fe25_duzey) geliyor. Referans Endeks formülü iki tarihin endeks
 * ORANINI aldığı için taban değişimi ham haliyle hesabı bozar; bu yüzden yeni
 * seri, iki serinin ORTAK son ayındaki orana göre ölçeklenip eskisinin devamı
 * olarak ZİNCİRLENİYOR (core/data.py::tufe_duzey_serisi_yukle ile aynı mantık).
 */
export async function tufeDuzeySerisiYukle(): Promise<SeriNoktalari> {
  const [eski, yeni] = await Promise.all([evdsSeri("tufe_duzey"), evdsSeri("tufe_fe25_duzey")]);
  if (yeni.tarihler.length === 0) return eski;
  if (eski.tarihler.length === 0) return yeni;

  const eskiH = new Map(eski.tarihler.map((t, i) => [t, eski.degerler[i]]));
  const yeniH = new Map(yeni.tarihler.map((t, i) => [t, yeni.degerler[i]]));
  const ortak = [...eskiH.keys()].filter((t) => yeniH.has(t)).sort();
  // Ortak ay yoksa zincirleme yapılamaz -- eski seriyle devam et (yanlış
  // ölçekli bir seri, eksik seriden daha tehlikeli olurdu).
  if (ortak.length === 0) return eski;

  const capa = ortak[ortak.length - 1];
  const capaYeni = yeniH.get(capa)!;
  if (!capaYeni) return eski;
  const katsayi = eskiH.get(capa)! / capaYeni;

  const birlesik = new Map(eskiH);
  for (const [t, v] of yeniH) if (t > capa) birlesik.set(t, v * katsayi);

  const tarihler = [...birlesik.keys()].sort();
  return { tarihler, degerler: tarihler.map((t) => birlesik.get(t)!) };
}

export type ReferansIhaleSatiri = { valor: string; vade: string; bf: number; ts: number };

/**
 * "Değişken Faizli Devlet Tahvili" kupon oranının HMB resmi formülünde
 * referans alınan ihaleler: TL cinsi kuponsuz (Hazine Bonosu / Kuponsuz
 * Devlet Tahvili) VEYA 728 gün ve daha kısa vadeli Sabit Kuponlu DT ihaleleri.
 * TS = (ROT gerçekleşme − kamu kurumları ROT) + ihale (rekabetçi) gerçekleşme.
 */
export async function degiskenFaizliReferansIhaleleriYukle(): Promise<ReferansIhaleSatiri[]> {
  const supabase = await createClient();
  const { data } = await tumSatirlariGetir<{
    senet_tanimi: string | null;
    valor_tarihi: string | null;
    vade_tarihi: string | null;
    ort_yillik_bilesik_gerceklesme: number | null;
    rot_gerceklesme_mn: number | null;
    kamu_kurumlari_gerceklesme_mn: number | null;
    ihale_miktar_gerceklesme_mn: number | null;
  }>((from, to) =>
    supabase
      .from("ihale_sonuclari")
      .select(
        "senet_tanimi, valor_tarihi, vade_tarihi, ort_yillik_bilesik_gerceklesme, rot_gerceklesme_mn, kamu_kurumlari_gerceklesme_mn, ihale_miktar_gerceklesme_mn",
      )
      .range(from, to),
  );

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const sonuc: ReferansIhaleSatiri[] = [];
  for (const r of data ?? []) {
    const valor = trTarihAyristir(r.valor_tarihi);
    const vade = trTarihAyristir(r.vade_tarihi);
    const bf = r.ort_yillik_bilesik_gerceklesme;
    if (!valor || !vade || bf == null) continue;

    const kuponsuz =
      r.senet_tanimi === "Hazine Bonosu" || r.senet_tanimi === "Kuponsuz Devlet Tahvili";
    const gunFarki = Math.round((vade.getTime() - valor.getTime()) / 86_400_000);
    const sabitKisa = r.senet_tanimi === "Sabit Kuponlu Devlet Tahvili" && gunFarki <= 728;
    if (!kuponsuz && !sabitKisa) continue;

    const ts =
      (Number(r.rot_gerceklesme_mn ?? 0) - Number(r.kamu_kurumlari_gerceklesme_mn ?? 0)) +
      Number(r.ihale_miktar_gerceklesme_mn ?? 0);
    if (!(ts > 0)) continue;

    sonuc.push({ valor: iso(valor), vade: iso(vade), bf: Number(bf), ts });
  }
  return sonuc;
}
