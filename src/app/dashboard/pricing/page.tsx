import { createClient } from "@/lib/supabase/server";
import { trTarihSirala, trTarihAyristir } from "@/lib/tarih";
import { PricingHesaplayici, type FiyatlanabilirKagit } from "./pricing-hesaplayici";

export default async function PricingPage() {
  const supabase = await createClient();

  const { data: ozetHam, error } = await supabase
    .from("isin_ozet")
    .select("isin, senet_tanimi, vade_tarihi, ilk_valor_tarihi, ilk_ihrac_tarihi, tahmini_kupon_orani")
    .in("senet_tanimi", ["Sabit Kuponlu Devlet Tahvili", "Kuponsuz Devlet Tahvili"])
    .not("tahmini_kupon_orani", "is", null);

  if (error || !ozetHam) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold">Pricing</h1>
        <p className="mt-4 text-sm text-destructive">{error?.message ?? "Veri bulunamadı."}</p>
      </div>
    );
  }

  const bugun = new Date();
  const itfaOlmamislar = ozetHam.filter((r) => {
    const vade = trTarihAyristir(r.vade_tarihi);
    return vade && vade.getTime() > bugun.getTime();
  });

  const kagitlar: FiyatlanabilirKagit[] = trTarihSirala(itfaOlmamislar, (r) => r.vade_tarihi).map((r) => ({
    isin: r.isin,
    senetTanimi: r.senet_tanimi ?? "",
    vade: r.vade_tarihi ?? "",
    anchor: r.ilk_valor_tarihi ?? r.ilk_ihrac_tarihi ?? "",
    kuponOraniPct: Number(r.tahmini_kupon_orani),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pricing</h1>
        <p className="text-sm text-muted-foreground">
          Sabit kuponlu / kuponsuz DİBS için fiyat ↔ getiri, duration, DV01 ve konveksite hesaplayıcı.
        </p>
      </div>

      {kagitlar.length === 0 ? (
        <p className="text-sm text-muted-foreground">Fiyatlanabilir (sabit kuponlu/kuponsuz) kağıt bulunamadı.</p>
      ) : (
        <PricingHesaplayici kagitlar={kagitlar} />
      )}
    </div>
  );
}
