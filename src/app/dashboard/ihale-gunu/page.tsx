import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trTarihAyristir } from "@/lib/tarih";
import { TahminTab } from "./tahmin-tab";
import { EmirlerimTab } from "./emirlerim-tab";
import { PerformansTab } from "./performans-tab";

export default async function IhaleGunuPage() {
  const supabase = await createClient();

  const [
    { data: ihaleHam },
    { data: takvimHam },
    { data: planlarHam },
    { data: tracksHam },
    { data: isinOzetHam },
    { data: bistHam },
  ] = await Promise.all([
    supabase
      .from("ihale_sonuclari")
      .select(
        "isin, senet_tanimi, ihale_tarihi, vade_tarihi, ihrac_tipi, toplam_gerceklesme_mn, kamu_kurumlari_gerceklesme_mn, ort_yillik_bilesik_gerceklesme, en_dusuk_bilesik_gerceklesme, en_yuksek_bilesik_gerceklesme, tail_bps, toplam_oran_pct, bid_to_cover, ort_fiyat_gerceklesme",
      ),
    supabase.from("ihrac_takvimi").select("tarih, yontem, senet_turu, vade, itfa_tarihi").order("tarih"),
    supabase.from("finansman_planlari").select("yil, ay, piyasadan_ihale"),
    supabase
      .from("auction_tracks")
      .select("id, isin, ihale_tarihi, en_dusuk_gerceklesen_fiyat, auction_orders(id, fiyat, nominal)")
      .order("ihale_tarihi", { ascending: false }),
    supabase.from("isin_ozet").select("isin, senet_tanimi, vade_tarihi"),
    supabase.from("bist_bap_fiyatlar").select("isin, tarih, temiz_fiyat"),
  ]);

  const bugun = new Date();
  const isinler = (isinOzetHam ?? [])
    .map((r) => ({ isin: r.isin, etiket: r.senet_tanimi ?? "", vadeD: trTarihAyristir(r.vade_tarihi) }))
    .filter((r): r is { isin: string; etiket: string; vadeD: Date } => r.vadeD != null && r.vadeD.getTime() > bugun.getTime())
    .sort((a, b) => a.vadeD.getTime() - b.vadeD.getTime());

  const takipler = (tracksHam ?? []).map((t) => ({
    id: t.id,
    isin: t.isin,
    ihale_tarihi: t.ihale_tarihi,
    en_dusuk_gerceklesen_fiyat: t.en_dusuk_gerceklesen_fiyat != null ? Number(t.en_dusuk_gerceklesen_fiyat) : null,
    emirler: (t.auction_orders ?? []).map((e: { id: string; fiyat: number; nominal: number }) => ({
      id: e.id, fiyat: Number(e.fiyat), nominal: Number(e.nominal),
    })),
  }));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">İhale günü</h1>
        <p className="text-sm text-muted-foreground">
          Yaklaşan bir ihalede muhtemel getiriyi tahmin etmeye yardımcı olur. Tahminler HMB&apos;nin geçmiş ihale
          sonucu özet istatistiklerine dayanır -- teklif bazlı mikro veri olmadığından KESİN bir model değildir,
          sadece karar desteğidir.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="tahmin">
            <TabsList className="mb-4 h-auto w-full justify-start overflow-x-auto">
              <TabsTrigger value="tahmin" className="shrink-0">Tahmin</TabsTrigger>
              <TabsTrigger value="emirlerim" className="shrink-0">Emirlerim</TabsTrigger>
              <TabsTrigger value="performans" className="shrink-0">İhale sonrası performans</TabsTrigger>
            </TabsList>
            <TabsContent value="tahmin">
              <TahminTab ihaleHam={ihaleHam ?? []} takvim={takvimHam ?? []} planlar={planlarHam ?? []} />
            </TabsContent>
            <TabsContent value="emirlerim">
              <EmirlerimTab takipler={takipler} />
            </TabsContent>
            <TabsContent value="performans">
              <PerformansTab ihale={ihaleHam ?? []} bist={bistHam ?? []} isinler={isinler} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
