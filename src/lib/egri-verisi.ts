import { createPublicClient } from "@/lib/supabase/public";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";
import { onbellekle } from "@/lib/veri-onbellek";

/**
 * Getiri eğrisi ve Deneysel sayfalarının ORTAK veri kaynağı.
 *
 * İkisi de aynı üç şeyi istiyor: eğriye uygun kağıtların isin_ozet kaydı,
 * son 2 yılın BIST kapanışları ve son TLREF O/N kotasyonu. Ayrı ayrı
 * çekildiğinde hem kod ikizleniyordu hem de aynı sorgu iki ayrı önbellek
 * anahtarında iki kez tutuluyordu. Tek anahtar = tek Supabase turu, iki
 * sayfa için tek tazelik penceresi.
 *
 * Not: sorgu SÜPER KÜME döndürüyor (temiz_fiyat dahil). Sayfalar istemciye
 * yalnızca kendi ihtiyacını gönderiyor -- ortak önbellek uğruna kimsenin
 * HTML yükü büyümesin diye (bkz. her sayfanın kendi projeksiyonu).
 */

// core/styling.GETIRI_EGRISI_UYGUN_TIPLER ile aynı liste.
export const EGRI_TIPLERI = [
  "Sabit Kuponlu Devlet Tahvili",
  "Hazine Bonosu",
  "Kuponsuz Devlet Tahvili",
];

/** Gömülen BIST penceresi. Karşılaştırma hazır seçenekleri en fazla 3 ay
 *  geriye gittiğinden 2 yıl fazlasıyla yeterli; tüm geçmiş gömülünce sayfa
 *  22.300 satır / ~3 MB oluyor ve 8 saniyede açılıyordu. */
const PENCERE_YIL = 2;

export type EgriOzetSatiri = {
  isin: string;
  senet_tanimi: string | null;
  vade_tarihi: string | null;
  para_birimi: string | null;
  tahmini_kupon_orani: number | null;
  ilk_valor_tarihi: string | null;
  ilk_ihrac_tarihi: string | null;
};

export type EgriBistSatiri = {
  tarih: string;
  isin: string;
  temiz_fiyat: number | null;
  kapanis_bilesik_getiri_pct: number | null;
  islem_hacmi_tl: number | null;
};

export type EgriVerisi = {
  hata: string | null;
  isinOzet: EgriOzetSatiri[];
  bist: EgriBistSatiri[];
  tlrefSonPct: number | null;
};

/** Tek önbellek anahtarı: iki sayfa da bunu çağırıyor. */
export const egriVerisiniGetir = onbellekle(["egri-verisi"], async (): Promise<EgriVerisi> => {
  const supabase = createPublicClient();

  const { data: ozetHam, error } = await supabase
    .from("isin_ozet")
    .select(
      "isin, senet_tanimi, vade_tarihi, para_birimi, tahmini_kupon_orani, ilk_valor_tarihi, ilk_ihrac_tarihi",
    )
    .in("senet_tanimi", EGRI_TIPLERI);

  if (error || !ozetHam) {
    return { hata: error?.message ?? "Veri bulunamadı.", isinOzet: [], bist: [], tlrefSonPct: null };
  }

  // TCMB/kamu USD/Avro cinsi kağıtlar getiri düzeyi farklı olduğundan eğriye dahil edilmiyor.
  const isinOzet = (ozetHam as EgriOzetSatiri[]).filter(
    (r) => !r.para_birimi || r.para_birimi === "TRY",
  );
  const isinListesi = isinOzet.map((r) => r.isin);

  const pencereBaslangic = new Date();
  pencereBaslangic.setFullYear(pencereBaslangic.getFullYear() - PENCERE_YIL);
  const pencereIso = pencereBaslangic.toISOString().slice(0, 10);

  const [{ data: bist }, { data: tlrefHam }] = await Promise.all([
    isinListesi.length
      ? tumSatirlariGetir<EgriBistSatiri>((from, to) =>
          supabase
            .from("bist_bap_fiyatlar")
            .select("tarih, isin, temiz_fiyat, kapanis_bilesik_getiri_pct, islem_hacmi_tl")
            .in("isin", isinListesi)
            .gte("tarih", pencereIso)
            .order("tarih")
            .range(from, to),
        )
      : Promise.resolve({ data: [] as EgriBistSatiri[] }),
    // core.bist_tlref.tlref_orani_serisi_yukle() -- BIST'in kendi günlük TLREF
    // O/N kotasyonu, carry hesabının fonlama kaynağı. En güncel gün yeterli.
    supabase
      .from("bist_tlref_orani")
      .select("oran_pct")
      .order("tarih", { ascending: false })
      .limit(1),
  ]);

  const tlrefSonPct = tlrefHam?.[0]?.oran_pct != null ? Number(tlrefHam[0].oran_pct) : null;

  return { hata: null, isinOzet, bist: bist ?? [], tlrefSonPct };
});
