import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trTarihAyristir } from "@/lib/tarih";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";
import { TahminTab } from "./tahmin-tab";
import { EmirlerimTab } from "./emirlerim-tab";
import { PerformansTab } from "./performans-tab";

// Global aramadan ?tab= ile doğrudan ilgili sekmeye gelinebilsin diye
// (önce her sonuç sayfanın ilk sekmesini açıyordu).
const SEKMELER = ["tahmin", "emirlerim", "performans"] as const;

type PerformansFiyat = {
  isin: string;
  ihale_tarihi: string;
  sira: number;
  temiz_fiyat: number | null;
};

export default async function IhaleGunuPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const gecerliTab = SEKMELER.includes(tab as (typeof SEKMELER)[number]) ? tab! : "tahmin";
  const supabase = await createClient();

  const [
    { data: ihaleHam },
    { data: takvimHam },
    { data: planlarHam },
    { data: tracksHam },
    { data: isinOzetHam },
    { data: fiyatHam },
  ] = await Promise.all([
    supabase
      .from("ihale_sonuclari")
      .select(
        "isin, senet_tanimi, ihale_tarihi, vade_tarihi, ihrac_tipi, toplam_gerceklesme_mn, kamu_kurumlari_gerceklesme_mn, ort_yillik_bilesik_gerceklesme, en_dusuk_bilesik_gerceklesme, en_yuksek_bilesik_gerceklesme, tail_bps, toplam_oran_pct, bid_to_cover, ort_fiyat_gerceklesme, en_dusuk_fiyat_gerceklesme",
      ),
    supabase.from("ihrac_takvimi").select("tarih, yontem, senet_turu, vade, itfa_tarihi").order("tarih"),
    supabase.from("finansman_planlari").select("yil, ay, piyasadan_ihale"),
    supabase
      .from("auction_tracks")
      .select("id, isin, ihale_tarihi, en_dusuk_gerceklesen_fiyat, auction_orders(id, fiyat, nominal)")
      .order("ihale_tarihi", { ascending: false }),
    supabase.from("isin_ozet").select("isin, senet_tanimi, vade_tarihi"),
    // bist_bap_fiyatlar'in TAMAMI cekiliyordu (76.221 satir): PostgREST
    // 1000 satirda kesiyor, kagitlarin cogu Performans sekmesinde "veri yok"
    // goruunuyordu. ihale_sonrasi_fiyatlar gorunumu her ihale icin yalnizca
    // gereken ilk 21 kapanisi veriyor (~9.650 satir) -- yine 1000'i astigi
    // icin sayfalanarak cekiliyor.
    tumSatirlariGetir<PerformansFiyat>((bas, son) =>
      supabase
        .from("ihale_sonrasi_fiyatlar")
        .select("isin, ihale_tarihi, sira, temiz_fiyat")
        .order("isin")
        .order("ihale_tarihi")
        .order("sira")
        .range(bas, son),
    ),
  ]);

  const bugun = new Date();
  const isinler = (isinOzetHam ?? [])
    .map((r) => ({ isin: r.isin, etiket: r.senet_tanimi ?? "", vadeD: trTarihAyristir(r.vade_tarihi) }))
    .filter((r): r is { isin: string; etiket: string; vadeD: Date } => r.vadeD != null && r.vadeD.getTime() > bugun.getTime())
    .sort((a, b) => a.vadeD.getTime() - b.vadeD.getTime());

  // Bu ISIN'ler için ihale_sonuclari'nda zaten resmi "En Düşük Fiyat Gerçekleşme"
  // varsa (pipeline sonucu çektiyse), kesme fiyatı alanına öneri olarak sunulur.
  const kesmeOnerileri: Record<string, number> = {};
  for (const r of ihaleHam ?? []) {
    if (r.en_dusuk_fiyat_gerceklesme != null) kesmeOnerileri[r.isin] = Number(r.en_dusuk_fiyat_gerceklesme);
  }

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">İhale günü</h1>
        <p className="text-sm text-muted-foreground">
          Yaklaşan bir ihalede muhtemel getiriyi tahmin etmeye yardımcı olur. Tahminler HMB&apos;nin geçmiş ihale
          sonucu özet istatistiklerine dayanır — teklif bazlı mikro veri olmadığından KESİN bir model değildir,
          sadece karar desteğidir.
        </p>
      </div>

      <Tabs defaultValue={gecerliTab}>
        <TabsList variant="line" className="mb-5 overflow-x-auto">
          <TabsTrigger value="tahmin" className="shrink-0">Tahmin</TabsTrigger>
          <TabsTrigger value="emirlerim" className="shrink-0">Emirlerim</TabsTrigger>
          <TabsTrigger value="performans" className="shrink-0">İhale sonrası performans</TabsTrigger>
        </TabsList>
        <TabsContent value="tahmin">
          <TahminTab ihaleHam={ihaleHam ?? []} takvim={takvimHam ?? []} planlar={planlarHam ?? []} />
        </TabsContent>
        <TabsContent value="emirlerim">
          <EmirlerimTab takipler={takipler} kesmeOnerileri={kesmeOnerileri} />
        </TabsContent>
        <TabsContent value="performans">
          <PerformansTab ihale={ihaleHam ?? []} fiyatlar={fiyatHam ?? []} isinler={isinler} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
