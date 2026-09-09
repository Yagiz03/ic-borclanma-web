import { createPublicClient } from "@/lib/supabase/public";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";
import { onbellekle } from "@/lib/veri-onbellek";
import { DeneyselClient } from "./deneysel-client";

// core/styling.GETIRI_EGRISI_UYGUN_TIPLER ile aynı liste.
const EGRI_TIPLERI = ["Sabit Kuponlu Devlet Tahvili", "Hazine Bonosu", "Kuponsuz Devlet Tahvili"];

/** Sayfanın verisi Getiri eğrisi sayfasınınkiyle aynı kaynak: BIST kapanışları
 *  + isin_ozet + son TLREF. Hepsi kamuya açık ve oturumdan bağımsız, önbellekli. */
const deneyselVerisiniGetir = onbellekle(["deneysel"], async () => {
  const supabase = createPublicClient();

  const { data: ozetHam, error } = await supabase
    .from("isin_ozet")
    .select("isin, senet_tanimi, vade_tarihi, para_birimi, tahmini_kupon_orani, ilk_valor_tarihi, ilk_ihrac_tarihi")
    .in("senet_tanimi", EGRI_TIPLERI);

  if (error || !ozetHam) {
    return { hata: error?.message ?? "Veri bulunamadı.", isinOzet: [], bist: [], tlrefSonPct: null };
  }

  const isinOzet = ozetHam.filter((r) => !r.para_birimi || r.para_birimi === "TRY");
  const isinListesi = isinOzet.map((r) => r.isin);

  // Sayfadaki iki ekran da TEK bir işlem gününün kesitiyle çalışıyor (tarih
  // seçici geriye gidebilsin diye pencere tutuluyor). Getiri eğrisi sayfasıyla
  // aynı 2 yıllık pencere: yük makul, etkileşim sunucuya gitmeden anında.
  const pencereBaslangic = new Date();
  pencereBaslangic.setFullYear(pencereBaslangic.getFullYear() - 2);
  const pencereIso = pencereBaslangic.toISOString().slice(0, 10);

  const [{ data: bist }, { data: tlrefHam }] = await Promise.all([
    isinListesi.length
      ? tumSatirlariGetir<{
          tarih: string; isin: string;
          kapanis_bilesik_getiri_pct: number | null; islem_hacmi_tl: number | null;
        }>((from, to) =>
          supabase
            .from("bist_bap_fiyatlar")
            .select("tarih, isin, kapanis_bilesik_getiri_pct, islem_hacmi_tl")
            .in("isin", isinListesi)
            .gte("tarih", pencereIso)
            .order("tarih")
            .range(from, to),
        )
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("bist_tlref_orani").select("oran_pct").order("tarih", { ascending: false }).limit(1),
  ]);

  const tlrefSonPct = tlrefHam?.[0]?.oran_pct != null ? Number(tlrefHam[0].oran_pct) : null;

  return { hata: null, isinOzet, bist: bist ?? [], tlrefSonPct };
});

export default async function DeneyselPage() {
  const { hata, isinOzet, bist, tlrefSonPct } = await deneyselVerisiniGetir();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Deneysel</h1>
        <p className="text-sm text-muted-foreground">
          Bu sayfadaki analizler DENEME aşamasında — metodoloji/sonuçlar değişebilir, yatırım
          kararına tek başına dayanak yapılmamalı. Olgunlaşan bölümler asıl sayfalara taşınır.
        </p>
      </div>

      {hata ? (
        <p className="text-sm text-destructive">{hata}</p>
      ) : (
        <DeneyselClient isinOzet={isinOzet} bist={bist} tlrefSonPct={tlrefSonPct} />
      )}
    </div>
  );
}
