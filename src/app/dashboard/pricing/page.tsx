import { createClient } from "@/lib/supabase/server";
import { trTarihSirala, trTarihAyristir } from "@/lib/tarih";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingHesaplayici, type FiyatlanabilirKagit } from "./pricing-hesaplayici";
import type { FloaterVeri } from "./floater-hesaplayici";
import {
  degiskenFaizliReferansIhaleleriYukle,
  tlrefEndeksSerisiYukle,
  tufeDuzeySerisiYukle,
} from "@/lib/floater-veri";
import { TakasMevduatHesaplayici } from "./takas-mevduat-hesaplayici";
import { PnlBolumu } from "@/app/dashboard/pnl/pnl-bolumu";
import { IzlemeListesiBolumu } from "@/app/dashboard/pnl/izleme-listesi-bolumu";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const gecerliTab = tab === "pnl" ? "pnl" : tab === "takas" ? "takas" : "hesaplayici";
  const supabase = await createClient();

  // Fiyatlanabilir tipler -- pages/pricing.py'deki gecerli_tipler ile aynı
  // (Kamu Kira Sertifikası'nın floater alt tipleri KASITLI olarak yok).
  const SABIT_TIPLER = ["Sabit Kuponlu Devlet Tahvili", "Kuponsuz Devlet Tahvili"];
  const TLREF_TIPI = "TLREF'e Endeksli Devlet Tahvili";
  const TUFE_TIPI = "TÜFE'ye Endeksli Devlet Tahvili";
  const FRN_TIPI = "Değişken Faizli Devlet Tahvili";

  const { data: ozetHam, error } = await supabase
    .from("isin_ozet")
    .select(
      "isin, senet_tanimi, vade_tarihi, ilk_valor_tarihi, ilk_ihrac_tarihi, tahmini_kupon_orani, kupon_periyot_gun",
    )
    .in("senet_tanimi", [...SABIT_TIPLER, TLREF_TIPI, TUFE_TIPI, FRN_TIPI]);

  if (error || !ozetHam) {
    return (
      <div className="w-full">
        <h1 className="text-2xl font-semibold">Pricing</h1>
        <p className="mt-4 text-sm text-destructive">{error?.message ?? "Veri bulunamadı."}</p>
      </div>
    );
  }

  const bugun = new Date();
  const itfaOlmamislar = ozetHam.filter((r) => {
    const vade = trTarihAyristir(r.vade_tarihi);
    if (!vade || vade.getTime() <= bugun.getTime()) return false;
    const tanim = r.senet_tanimi ?? "";
    // Her tipin kendi zorunlu alanı (pricing.py'deki maske mantığı):
    if (SABIT_TIPLER.includes(tanim) || tanim === TUFE_TIPI) return r.tahmini_kupon_orani != null;
    if (tanim === TLREF_TIPI) return (r.ilk_valor_tarihi ?? r.ilk_ihrac_tarihi) != null;
    if (tanim === FRN_TIPI) return (r.ilk_valor_tarihi ?? r.ilk_ihrac_tarihi) != null;
    return false;
  });

  const kagitlar: FiyatlanabilirKagit[] = trTarihSirala(itfaOlmamislar, (r) => r.vade_tarihi).map((r) => {
    const ihrac = r.ilk_valor_tarihi ?? r.ilk_ihrac_tarihi ?? "";
    const ihracYili = Number(String(ihrac).slice(0, 4));
    return {
      isin: r.isin,
      senetTanimi: r.senet_tanimi ?? "",
      vade: r.vade_tarihi ?? "",
      anchor: ihrac,
      kuponOraniPct: r.tahmini_kupon_orani != null ? Number(r.tahmini_kupon_orani) : 0,
      // Kupon periyodu kağıttan kağıda değişir; resmi değer yoksa HMB'nin
      // 2025'ten itibaren 182 güne geçtiği bilgisiyle ihraç yılına göre.
      kuponPeriyotGun:
        r.kupon_periyot_gun != null
          ? Number(r.kupon_periyot_gun)
          : ihracYili >= 2025
            ? 182
            : 91,
      periyotResmiMi: r.kupon_periyot_gun != null,
    };
  });

  const [tlref, tufe, referansIhaleler] = await Promise.all([
    tlrefEndeksSerisiYukle(),
    tufeDuzeySerisiYukle(),
    degiskenFaizliReferansIhaleleriYukle(),
  ]);
  const floaterVeri: FloaterVeri = { tlref, tufe, referansIhaleler };

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bono ve Getiri Hesaplayıcı</h1>
        <p className="text-sm text-muted-foreground">
          Sabit kuponlu / kuponsuz, TLREF&apos;e endeksli, TÜFE&apos;ye endeksli ve Değişken Faizli
          DİBS için fiyat ↔ getiri, kupon, birikmiş faiz, duration, DV01 ve konveksite hesaplayıcı.
        </p>
      </div>

      <Tabs defaultValue={gecerliTab}>
        <TabsList variant="line" className="mb-5 overflow-x-auto">
          <TabsTrigger value="hesaplayici" className="shrink-0">ISIN Hesaplayıcı</TabsTrigger>
          <TabsTrigger value="takas" className="shrink-0">Takas / Mevduat → O/N</TabsTrigger>
          <TabsTrigger value="pnl" className="shrink-0">P&L</TabsTrigger>
        </TabsList>

        <TabsContent value="hesaplayici">
          {kagitlar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Fiyatlanabilir kağıt bulunamadı.</p>
          ) : (
            <PricingHesaplayici kagitlar={kagitlar} floaterVeri={floaterVeri} />
          )}
        </TabsContent>

        <TabsContent value="takas">
          <TakasMevduatHesaplayici koridor={koridor} politikaFaizi={politikaFaizi} ppkGunleri={ppkGunleri} />
        </TabsContent>

        {/* Python'da pnl.py'nin kendi iki alt sekmesi var (Pozisyonlarım /
            İzleme listesi) — burada da aynı yapı korunuyor. */}
        <TabsContent value="pnl">
          <Tabs defaultValue="pozisyonlar">
            <TabsList variant="line" className="mb-5 overflow-x-auto">
              <TabsTrigger value="pozisyonlar" className="shrink-0">Pozisyonlarım</TabsTrigger>
              <TabsTrigger value="izleme" className="shrink-0">İzleme listesi</TabsTrigger>
            </TabsList>
            <TabsContent value="pozisyonlar">
              <PnlBolumu />
            </TabsContent>
            <TabsContent value="izleme">
              <IzlemeListesiBolumu />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
