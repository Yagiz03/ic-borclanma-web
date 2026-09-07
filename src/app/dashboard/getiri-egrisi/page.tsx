import { createClient } from "@/lib/supabase/server";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";
import { GetiriEgrisiClient } from "./getiri-egrisi-client";

const EGRI_TIPLERI = ["Sabit Kuponlu Devlet Tahvili", "Hazine Bonosu", "Kuponsuz Devlet Tahvili"];

export default async function GetiriEgrisiPage() {
  const supabase = await createClient();

  const { data: ozetHam, error } = await supabase
    .from("isin_ozet")
    .select("isin, senet_tanimi, vade_tarihi, para_birimi, tahmini_kupon_orani, ilk_valor_tarihi, ilk_ihrac_tarihi")
    .in("senet_tanimi", EGRI_TIPLERI);

  if (error || !ozetHam) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <h1 className="text-2xl font-semibold">Getiri eğrisi</h1>
        <p className="mt-4 text-sm text-destructive">{error?.message ?? "Veri bulunamadı."}</p>
      </div>
    );
  }

  // TCMB/kamu USD/Avro cinsi kağıtlar getiri düzeyi farklı olduğundan eğriye dahil edilmiyor.
  const isinOzet = ozetHam.filter((r) => !r.para_birimi || r.para_birimi === "TRY");
  const isinListesi = isinOzet.map((r) => r.isin);

  const [{ data: bist }, { data: tlrefHam }] = await Promise.all([
    isinListesi.length
      ? tumSatirlariGetir<{
          tarih: string; isin: string; temiz_fiyat: number | null;
          kapanis_bilesik_getiri_pct: number | null; islem_hacmi_tl: number | null;
        }>((from, to) =>
          supabase
            .from("bist_bap_fiyatlar")
            .select("tarih, isin, temiz_fiyat, kapanis_bilesik_getiri_pct, islem_hacmi_tl")
            .in("isin", isinListesi)
            .order("tarih")
            .range(from, to),
        )
      : Promise.resolve({ data: [] as never[] }),
    // core.bist_tlref.tlref_orani_serisi_yukle() -- BIST'in kendi günlük TLREF O/N
    // kotasyonu, carry hesabının fonlama kaynağı. En güncel gün yeterli.
    supabase.from("bist_tlref_orani").select("oran_pct").order("tarih", { ascending: false }).limit(1),
  ]);

  const tlrefSonPct = tlrefHam?.[0]?.oran_pct != null ? Number(tlrefHam[0].oran_pct) : null;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Getiri eğrisi</h1>
        <p className="text-sm text-muted-foreground">
          Sabit getirili kağıtların (Hazine Bonosu, Sabit Kuponlu, Kuponsuz) BIST Kesin Alım Satım Pazarı
          bileşik getirisi, kalan vadeye göre.
        </p>
      </div>

      <GetiriEgrisiClient isinOzet={isinOzet} bist={bist ?? []} tlrefSonPct={tlrefSonPct} />
    </div>
  );
}
