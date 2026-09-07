import { createClient } from "@/lib/supabase/server";
import { trTarihSirala, trTarihAyristir } from "@/lib/tarih";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingHesaplayici, type FiyatlanabilirKagit } from "./pricing-hesaplayici";
import { PnlBolumu } from "@/app/dashboard/pnl/pnl-bolumu";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();

  const { data: ozetHam, error } = await supabase
    .from("isin_ozet")
    .select("isin, senet_tanimi, vade_tarihi, ilk_valor_tarihi, ilk_ihrac_tarihi, tahmini_kupon_orani")
    .in("senet_tanimi", ["Sabit Kuponlu Devlet Tahvili", "Kuponsuz Devlet Tahvili"])
    .not("tahmini_kupon_orani", "is", null);

  if (error || !ozetHam) {
    return (
      <div className="mx-auto max-w-7xl">
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
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bono ve Getiri Hesaplayıcı</h1>
        <p className="text-sm text-muted-foreground">
          Sabit kuponlu / kuponsuz DİBS için fiyat ↔ getiri, duration, DV01 ve konveksite hesaplayıcı.
        </p>
      </div>

      <Tabs defaultValue={tab === "pnl" ? "pnl" : "hesaplayici"}>
        <TabsList className="mb-4 h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="hesaplayici" className="shrink-0">ISIN Hesaplayıcı</TabsTrigger>
          <TabsTrigger value="pnl" className="shrink-0">P&L</TabsTrigger>
        </TabsList>

        <TabsContent value="hesaplayici">
          {kagitlar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Fiyatlanabilir (sabit kuponlu/kuponsuz) kağıt bulunamadı.</p>
          ) : (
            <PricingHesaplayici kagitlar={kagitlar} />
          )}
        </TabsContent>

        <TabsContent value="pnl">
          <PnlBolumu />
        </TabsContent>
      </Tabs>
    </div>
  );
}
