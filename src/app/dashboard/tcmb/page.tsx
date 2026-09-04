import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CokluCizgiGrafigi, YiginliAlanGrafigi } from "./coklu-cizgi-grafigi";

function pivotla(rows: { seri_adi: string; tarih: string; deger: number | null }[]): Record<string, string | number>[] {
  const gunler = new Map<string, Record<string, string | number>>();
  for (const r of rows) {
    if (r.deger == null) continue;
    const satir = gunler.get(r.tarih) ?? { tarih: r.tarih };
    satir[r.seri_adi] = r.deger;
    gunler.set(r.tarih, satir);
  }
  return Array.from(gunler.values()).sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
}

export default async function TcmbPage() {
  const supabase = await createClient();

  const dibsSeriler = [
    "dibs_piy_deg_bankalar",
    "dibs_piy_deg_tcmb",
    "dibs_piy_deg_emeklilik_fonlari",
    "dibs_piy_deg_yatirim_fonlari",
    "dibs_piy_deg_dunya_geri_kalani",
  ];
  const kurSeriler = ["usdtry", "eurtry"];
  const rezervSeriler = ["rezerv_toplam", "rezerv_doviz", "rezerv_altin"];
  const enflasyonSeriler = ["tufe_yillik_yuzde", "beklenti_tufe_yilsonu", "beklenti_politika_faizi_yilsonu"];

  // Supabase projesinin satır limiti (proje ayarı, .limit() ile aşılamıyor)
  // tek seferde tüm 17 seriyi (~1700 satır) çekmeyi keserdi -- her sekme
  // sadece kendi serilerini ayrı sorguyla çekiyor (~100-330 satır/sorgu).
  const [dibsRes, tlrefRes, kurRes, rezervRes, m2Res, repoRes, enflasyonRes] = await Promise.all([
    supabase.from("evds_seriler").select("*").in("seri_adi", dibsSeriler).order("tarih"),
    supabase.from("evds_seriler").select("*").eq("seri_adi", "tlref_kapanis").order("tarih"),
    supabase.from("evds_seriler").select("*").in("seri_adi", kurSeriler).order("tarih"),
    supabase.from("evds_seriler").select("*").in("seri_adi", rezervSeriler).order("tarih"),
    supabase.from("evds_seriler").select("*").eq("seri_adi", "m2_para_arzi").order("tarih"),
    supabase.from("evds_seriler").select("*").eq("seri_adi", "repo_gecelik_bist").order("tarih"),
    supabase.from("evds_seriler").select("*").in("seri_adi", enflasyonSeriler).order("tarih"),
  ]);

  const ilkHata = [dibsRes, tlrefRes, kurRes, rezervRes, m2Res, repoRes, enflasyonRes].find((r) => r.error)?.error;
  if (ilkHata) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold">TCMB</h1>
        <p className="mt-4 text-sm text-destructive">{ilkHata.message}</p>
      </div>
    );
  }

  const dibsVeri = pivotla(dibsRes.data ?? []);
  const tlrefVeri = pivotla(tlrefRes.data ?? []);
  const kurVeri = pivotla(kurRes.data ?? []);
  const rezervVeri = pivotla(rezervRes.data ?? []);
  const m2Veri = pivotla(m2Res.data ?? []);
  const repoVeri = pivotla(repoRes.data ?? []);
  const enflasyonVeri = pivotla(enflasyonRes.data ?? []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">TCMB</h1>
        <p className="text-sm text-muted-foreground">
          EVDS üzerinden DİBS piyasa değeri, TLREF, döviz kuru, rezerv ve enflasyon göstergeleri.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="dibs">
            <TabsList className="mb-4 h-auto w-full justify-start overflow-x-auto">
              <TabsTrigger value="dibs" className="shrink-0">DİBS Piyasa Değeri</TabsTrigger>
              <TabsTrigger value="tlref" className="shrink-0">TLREF</TabsTrigger>
              <TabsTrigger value="kur" className="shrink-0">Döviz Kuru</TabsTrigger>
              <TabsTrigger value="rezerv" className="shrink-0">Net Rezerv</TabsTrigger>
              <TabsTrigger value="m2repo" className="shrink-0">M2 &amp; Repo</TabsTrigger>
              <TabsTrigger value="enflasyon" className="shrink-0">Enflasyon &amp; Beklentiler</TabsTrigger>
            </TabsList>

            <TabsContent value="dibs">
              <p className="mb-3 text-sm text-muted-foreground">
                DİBS'lerin kağıt tipine göre outstanding stok dağılımı (Milyon TL, haftalık).
              </p>
              <YiginliAlanGrafigi
                veri={dibsVeri}
                seriler={[
                  { anahtar: "dibs_piy_deg_bankalar", etiket: "Bankalar" },
                  { anahtar: "dibs_piy_deg_tcmb", etiket: "TCMB" },
                  { anahtar: "dibs_piy_deg_emeklilik_fonlari", etiket: "Emeklilik Fonları" },
                  { anahtar: "dibs_piy_deg_yatirim_fonlari", etiket: "Yatırım Fonları" },
                  { anahtar: "dibs_piy_deg_dunya_geri_kalani", etiket: "Dünyanın Geri Kalanı" },
                ]}
              />
            </TabsContent>

            <TabsContent value="tlref">
              <p className="mb-3 text-sm text-muted-foreground">TLREF endeksi kapanış değeri (günlük).</p>
              <CokluCizgiGrafigi veri={tlrefVeri} seriler={[{ anahtar: "tlref_kapanis", etiket: "TLREF Kapanış" }]} ondalik={2} />
            </TabsContent>

            <TabsContent value="kur">
              <p className="mb-3 text-sm text-muted-foreground">USD/TRY ve EUR/TRY (TCMB gösterge kuru).</p>
              <CokluCizgiGrafigi
                veri={kurVeri}
                seriler={[
                  { anahtar: "usdtry", etiket: "USD/TRY" },
                  { anahtar: "eurtry", etiket: "EUR/TRY" },
                ]}
                ondalik={3}
              />
            </TabsContent>

            <TabsContent value="rezerv">
              <p className="mb-3 text-sm text-muted-foreground">TCMB brüt rezervleri (Milyon USD, haftalık).</p>
              <CokluCizgiGrafigi
                veri={rezervVeri}
                seriler={[
                  { anahtar: "rezerv_toplam", etiket: "Toplam" },
                  { anahtar: "rezerv_doviz", etiket: "Döviz" },
                  { anahtar: "rezerv_altin", etiket: "Altın" },
                ]}
                ondalik={0}
              />
            </TabsContent>

            <TabsContent value="m2repo">
              <div className="space-y-8">
                <div>
                  <p className="mb-3 text-sm text-muted-foreground">M2 para arzı (Milyon TL, haftalık).</p>
                  <CokluCizgiGrafigi veri={m2Veri} seriler={[{ anahtar: "m2_para_arzi", etiket: "M2" }]} ondalik={0} />
                </div>
                <div>
                  <p className="mb-3 text-sm text-muted-foreground">BIST gecelik repo faizi (%, günlük).</p>
                  <CokluCizgiGrafigi veri={repoVeri} seriler={[{ anahtar: "repo_gecelik_bist", etiket: "Gecelik Repo" }]} ondalik={2} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="enflasyon">
              <p className="mb-3 text-sm text-muted-foreground">
                Gerçekleşen yıllık TÜFE ve piyasa beklenti anketi (yıl sonu TÜFE / politika faizi beklentisi).
              </p>
              <CokluCizgiGrafigi
                veri={enflasyonVeri}
                seriler={[
                  { anahtar: "tufe_yillik_yuzde", etiket: "TÜFE (yıllık)" },
                  { anahtar: "beklenti_tufe_yilsonu", etiket: "Beklenti: TÜFE (yıl sonu)" },
                  { anahtar: "beklenti_politika_faizi_yilsonu", etiket: "Beklenti: Politika Faizi (yıl sonu)" },
                ]}
                ondalik={1}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
