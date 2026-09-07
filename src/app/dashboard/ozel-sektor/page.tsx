import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeroBant } from "@/components/hero-bant";
import { OstGunlukIslemler } from "./ost-gunluk-islemler";
import { OstIhracciProfili } from "./ost-ihracci-profili";

function turkceKisimAyikla(v: string | null): string | null {
  return v ? v.split("/")[0].trim() : v;
}

export default async function OzelSektorPage() {
  const supabase = await createClient();

  const { data: mkbHam, error } = await supabase
    .from("menkul_kiymet_bilgileri")
    .select("*")
    .eq("ozel_sektor_mu", true)
    .order("ihracci_kurum", { ascending: true })
    .order("isin");

  const mkb = (mkbHam ?? []).map((k) => ({
    ...k,
    mk_turu: turkceKisimAyikla(k.mk_turu),
    getiri_turu: turkceKisimAyikla(k.getiri_turu),
  }));

  const isinListesi = mkb.map((k) => k.isin);
  const { data: bist } = isinListesi.length
    ? await supabase
        .from("bist_bap_fiyatlar")
        .select("tarih, isin, temiz_fiyat, ag_ort_takas_fiyati, kapanis_bilesik_getiri_pct, birikmis_faiz, islem_hacmi_tl, miktar")
        .in("isin", isinListesi)
        .order("tarih", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Özel sektör tahvilleri</h1>
        <p className="text-sm text-muted-foreground">
          Kurumsal (özel sektör) borçlanma araçları -- BIST&apos;in resmi &quot;İşlem Gören Borçlanma
          Araçlarına İlişkin Bilgiler&quot; listesindeki MK Türü&apos;ne göre sınıflandırılıyor. BIST Kesin Alım
          Satım Pazarı&apos;nda o gün işlem görenler.
        </p>
      </div>

      {mkb.length > 0 && (
        <HeroBant
          ustBaslik="ÖZEL SEKTÖR -- İŞLEM GÖREN BORÇLANMA ARAÇLARI"
          deger={String(mkb.length)}
          birim="kağıt"
          aciklama={`${new Set(mkb.map((k) => k.ihracci_kurum)).size} farklı ihraççı`}
          yanKartlar={[
            {
              etiket: "Toplam İhraç Tutarı",
              deger: `${(mkb.reduce((s, k) => s + (Number(k.toplam_ihrac_tutari_bin) || 0), 0) / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} Mlr TL`,
            },
            {
              etiket: "En Yaygın Tür",
              deger:
                [...mkb.reduce((m, k) => m.set(k.mk_turu ?? "–", (m.get(k.mk_turu ?? "–") ?? 0) + 1), new Map<string, number>())]
                  .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "–",
            },
          ]}
        />
      )}

      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error.message}</p>}
          <Tabs defaultValue="gunluk">
            <TabsList className="mb-4 h-auto w-full justify-start overflow-x-auto">
              <TabsTrigger value="gunluk" className="shrink-0">Günlük işlemler</TabsTrigger>
              <TabsTrigger value="ihracci" className="shrink-0">İhraççı profili</TabsTrigger>
            </TabsList>
            <TabsContent value="gunluk">
              <OstGunlukIslemler bist={bist ?? []} mkb={mkb} />
            </TabsContent>
            <TabsContent value="ihracci">
              <OstIhracciProfili kagitlar={mkb} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
