import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OstGunlukIslemler } from "./ost-gunluk-islemler";
import { OstIhracciProfili } from "./ost-ihracci-profili";

function turkceKisimAyikla(v: string | null): string | null {
  return v ? v.split("/")[0].trim() : v;
}

export default async function OzelSektorPage() {
  const supabase = await createClient();

  const [{ data: mkbHam, error }, { data: araciKurumlar }] = await Promise.all([
    supabase
      .from("menkul_kiymet_bilgileri")
      .select("*")
      .eq("ozel_sektor_mu", true)
      .order("ihracci_kurum", { ascending: true })
      .order("isin"),
    supabase.from("araci_kurumlar").select("kod, unvan"),
  ]);

  const araciHarita = new Map((araciKurumlar ?? []).map((a) => [a.kod, a.unvan]));
  const mkb = (mkbHam ?? []).map((k) => ({
    ...k,
    mk_turu: turkceKisimAyikla(k.mk_turu),
    getiri_turu: turkceKisimAyikla(k.getiri_turu),
    araci_kurum_unvan: k.araci_kurum_kodu ? (araciHarita.get(k.araci_kurum_kodu) ?? null) : null,
  }));

  const isinListesi = mkb.map((k) => k.isin);
  const [{ data: bap }, { data: ost14 }] = await Promise.all([
    isinListesi.length
      ? supabase
          .from("bist_bap_fiyatlar")
          .select("tarih, isin, temiz_fiyat, ag_ort_takas_fiyati, kapanis_bilesik_getiri_pct, birikmis_faiz, islem_hacmi_tl, miktar")
          .in("isin", isinListesi)
          .order("tarih", { ascending: false })
      : Promise.resolve({ data: [] }),
    isinListesi.length
      ? supabase
          .from("bist_ost_fiyatlar")
          .select("tarih, isin, temiz_fiyat, ag_ort_takas_fiyati, kapanis_bilesik_getiri_pct, birikmis_faiz, islem_hacmi_tl, miktar")
          .in("isin", isinListesi)
          .order("tarih", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  // Aynı (tarih, isin) için hem 14:00 ara bülten hem tam günlük bülten varsa
  // tam günlük bülten (nihai/kesin) tercih edilir -- 14:00 ara bülten sadece
  // henüz tam bülten yokken (örn. bugün) devreye girer.
  const bapAnahtarlari = new Set((bap ?? []).map((r) => `${r.tarih}|${r.isin}`));
  const sadeceOst = (ost14 ?? []).filter((r) => !bapAnahtarlari.has(`${r.tarih}|${r.isin}`));
  const bist = [...(bap ?? []), ...sadeceOst];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Özel sektör tahvilleri</h1>
        <p className="text-sm text-muted-foreground">
          Kurumsal (özel sektör) borçlanma araçları — BIST&apos;in resmi &quot;İşlem Gören Borçlanma
          Araçlarına İlişkin Bilgiler&quot; listesindeki MK Türü&apos;ne göre sınıflandırılıyor. BIST Kesin Alım
          Satım Pazarı&apos;nda o gün işlem görenler.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}
      <Tabs defaultValue="gunluk">
        <TabsList variant="line" className="mb-5 overflow-x-auto">
          <TabsTrigger value="gunluk" className="shrink-0">Günlük işlemler</TabsTrigger>
          <TabsTrigger value="ihracci" className="shrink-0">İhraççı profili</TabsTrigger>
        </TabsList>
        <TabsContent value="gunluk">
          <OstGunlukIslemler bist={bist} mkb={mkb} />
        </TabsContent>
        <TabsContent value="ihracci">
          <OstIhracciProfili kagitlar={mkb} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
