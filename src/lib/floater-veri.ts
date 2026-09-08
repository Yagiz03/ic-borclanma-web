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

/** TÜFE ENDEKS DÜZEYİ (aylık, ayın ilk günü damgalı) -- evds_seriler.tufe_duzey. */
export const tufeDuzeySerisiYukle = () => evdsSeri("tufe_duzey");

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
