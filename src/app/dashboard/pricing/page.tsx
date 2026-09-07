import { createClient } from "@/lib/supabase/server";
import { trTarihSirala, trTarihAyristir } from "@/lib/tarih";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingHesaplayici, type FiyatlanabilirKagit } from "./pricing-hesaplayici";
import { TakasMevduatHesaplayici } from "./takas-mevduat-hesaplayici";
import { PnlBolumu } from "@/app/dashboard/pnl/pnl-bolumu";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const gecerliTab = tab === "pnl" ? "pnl" : tab === "takas" ? "takas" : "hesaplayici";
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

  const [{ data: koridorHam }, { data: politikaHam }, { data: ppkHam }] = await Promise.all([
    supabase.from("tcmb_faiz_koridoru").select("tarih, borc_alma, borc_verme").order("tarih", { ascending: false }).limit(1),
    supabase.from("tcmb_politika_faizi").select("tarih, politika_faizi").order("tarih", { ascending: false }).limit(1),
    supabase.from("tcmb_takvim").select("tarih").eq("tur", "PPK Toplantı Kararı").gte("tarih", bugun.toISOString().slice(0, 10)),
  ]);

  const koridor = koridorHam?.[0]
    ? { altBant: Number(koridorHam[0].borc_alma), ustBant: Number(koridorHam[0].borc_verme) }
    : null;
  const politikaFaizi = politikaHam?.[0]?.politika_faizi != null ? Number(politikaHam[0].politika_faizi) : null;
  const ppkGunleri = (ppkHam ?? []).map((r) => r.tarih).sort();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bono ve Getiri Hesaplayıcı</h1>
        <p className="text-sm text-muted-foreground">
          Sabit kuponlu / kuponsuz DİBS için fiyat ↔ getiri, duration, DV01 ve konveksite hesaplayıcı.
        </p>
      </div>

      <Tabs defaultValue={gecerliTab}>
        <TabsList className="mb-4 h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="hesaplayici" className="shrink-0">ISIN Hesaplayıcı</TabsTrigger>
          <TabsTrigger value="takas" className="shrink-0">Takas / Mevduat → O/N</TabsTrigger>
          <TabsTrigger value="pnl" className="shrink-0">P&L</TabsTrigger>
        </TabsList>

        <TabsContent value="hesaplayici">
          {kagitlar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Fiyatlanabilir (sabit kuponlu/kuponsuz) kağıt bulunamadı.</p>
          ) : (
            <PricingHesaplayici kagitlar={kagitlar} />
          )}
        </TabsContent>

        <TabsContent value="takas">
          <TakasMevduatHesaplayici koridor={koridor} politikaFaizi={politikaFaizi} ppkGunleri={ppkGunleri} />
        </TabsContent>

        <TabsContent value="pnl">
          <PnlBolumu />
        </TabsContent>
      </Tabs>
    </div>
  );
}
