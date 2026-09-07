import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CokluCizgiGrafigi, YiginliAlanGrafigi, RenkliBarGrafik } from "./coklu-cizgi-grafigi";
import { TcmbApiPortfoyuBolumu } from "./tcmb-api-portfoyu";
import { KagitTipiDagilimiBolumu } from "./kagit-tipi-dagilimi";
import { TufeM2KfeBonoBolumu } from "./tufe-m2-kfe-bono";
import { DisDengeBolumu } from "./dis-denge";
import { NetRezervBolumu } from "./net-rezerv";
import { PiyasaBeklentileriBolumu } from "./piyasa-beklentileri";

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

function pct1(v: number | null | undefined): string {
  return v == null ? "–" : `%${v.toFixed(1)}`;
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
  const enflasyonSeriler = ["tufe_yillik_yuzde", "beklenti_tufe_yilsonu", "beklenti_politika_faizi_yilsonu"];

  // Supabase projesinin satır limiti (proje ayarı, .limit() ile aşılamıyor)
  // tek seferde tüm serileri (bazıları 5-17 seri x 300-1700 satır) birlikte
  // çekmek keserdi -- her seri kendi sorgusuyla, ayrı ayrı çekiliyor.
  const [
    dibsSonuclari, tlrefRes, kurSonuclari, repoRes, enflasyonRes,
    koridorRes, politikaRes, enflasyonRaporuRes,
  ] = await Promise.all([
    Promise.all(dibsSeriler.map((s) => supabase.from("evds_seriler").select("*").eq("seri_adi", s).order("tarih"))),
    supabase.from("evds_seriler").select("*").eq("seri_adi", "tlref_kapanis").order("tarih"),
    Promise.all(kurSeriler.map((s) => supabase.from("evds_seriler").select("*").eq("seri_adi", s).order("tarih"))),
    supabase.from("evds_seriler").select("*").eq("seri_adi", "repo_gecelik_bist").order("tarih"),
    supabase.from("evds_seriler").select("*").in("seri_adi", enflasyonSeriler).order("tarih"),
    supabase.from("tcmb_faiz_koridoru").select("tarih, borc_alma, borc_verme").order("tarih"),
    supabase.from("tcmb_politika_faizi").select("tarih, politika_faizi").order("tarih"),
    supabase.from("tcmb_enflasyon_raporu").select("*").limit(1).maybeSingle(),
  ]);

  const ilkHata = [...dibsSonuclari, tlrefRes, ...kurSonuclari, repoRes, enflasyonRes].find((r) => r.error)?.error;
  if (ilkHata) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold">TCMB</h1>
        <p className="mt-4 text-sm text-destructive">{ilkHata.message}</p>
      </div>
    );
  }

  const dibsVeri = pivotla(dibsSonuclari.flatMap((r) => r.data ?? []));
  const tlrefVeri = pivotla(tlrefRes.data ?? []);
  const kurVeri = pivotla(kurSonuclari.flatMap((r) => r.data ?? []));
  const repoVeri = pivotla(repoRes.data ?? []);
  const enflasyonVeri = pivotla(enflasyonRes.data ?? []);

  const koridorVeri = (koridorRes.data ?? []).map((r) => ({ tarih: r.tarih, "Alt bant": Number(r.borc_alma), "Üst bant": Number(r.borc_verme) }));
  const politikaVeri = (politikaRes.data ?? []).map((r) => ({ tarih: r.tarih, "Politika faizi": Number(r.politika_faizi) }));
  // koridor + politika + BIST gecelik repo'yu tek zaman ekseninde birleştir
  const koridorBirlesik = pivotla([
    ...(koridorRes.data ?? []).flatMap((r) => [
      { seri_adi: "Alt bant", tarih: r.tarih, deger: r.borc_alma != null ? Number(r.borc_alma) : null },
      { seri_adi: "Üst bant", tarih: r.tarih, deger: r.borc_verme != null ? Number(r.borc_verme) : null },
    ]),
    ...(politikaRes.data ?? []).map((r) => ({ seri_adi: "Politika faizi", tarih: r.tarih, deger: r.politika_faizi != null ? Number(r.politika_faizi) : null })),
    ...(repoRes.data ?? []).map((r) => ({ seri_adi: "BIST gecelik repo", tarih: r.tarih, deger: r.deger })),
  ]);

  const sonKoridor = koridorVeri[koridorVeri.length - 1];
  const sonPolitika = politikaVeri[politikaVeri.length - 1];

  const enflasyonRaporu = enflasyonRaporuRes.data;

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
              <TabsTrigger value="apiportfoyu" className="shrink-0">TCMB APİ Portföyü</TabsTrigger>
              <TabsTrigger value="tufem2kfebono" className="shrink-0">TÜFE, M2, KFE ve Bono</TabsTrigger>
              <TabsTrigger value="koridor" className="shrink-0">Repo Faiz Koridoru</TabsTrigger>
              <TabsTrigger value="tlref" className="shrink-0">TLREF</TabsTrigger>
              <TabsTrigger value="disdenge" className="shrink-0">Dış Denge</TabsTrigger>
              <TabsTrigger value="kur" className="shrink-0">Döviz Kuru</TabsTrigger>
              <TabsTrigger value="rezerv" className="shrink-0">Net Rezerv</TabsTrigger>
              <TabsTrigger value="beklenti" className="shrink-0">Piyasa Beklentileri</TabsTrigger>
              <TabsTrigger value="enflasyon" className="shrink-0">Enflasyon &amp; Beklentiler</TabsTrigger>
              <TabsTrigger value="enflasyonraporu" className="shrink-0">Enflasyon Raporu</TabsTrigger>
            </TabsList>

            <TabsContent value="dibs" className="space-y-8">
              <KagitTipiDagilimiBolumu />

              <div>
              <p className="mb-3 text-sm text-muted-foreground">
                DİBS'lerin sahiplik kesimine (sektöre) göre piyasa değeri dağılımı (Milyon TL, haftalık).
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
              </div>
            </TabsContent>

            <TabsContent value="apiportfoyu">
              <TcmbApiPortfoyuBolumu />
            </TabsContent>

            <TabsContent value="tufem2kfebono">
              <TufeM2KfeBonoBolumu />
            </TabsContent>

            <TabsContent value="koridor">
              <p className="mb-3 text-sm text-muted-foreground">
                TCMB&apos;nin ilan ettiği &quot;faiz koridoru&quot; -- gecelik borç alma (alt bant) ve borç verme (üst
                bant) faizleri ile 1 hafta vadeli repo (politika faizi); BIST gecelik repo piyasada fiilen oluşan
                oranı gösteriyor.
              </p>
              {koridorVeri.length === 0 ? (
                <p className="text-sm text-muted-foreground">Veri yok.</p>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Üst bant (gecelik borç verme)</p>
                      <p className="font-figures font-semibold">{pct1(sonKoridor?.["Üst bant"] as number)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Politika faizi (1 hafta repo)</p>
                      <p className="font-figures font-semibold">{pct1(sonPolitika?.["Politika faizi"] as number)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Alt bant (gecelik borç alma)</p>
                      <p className="font-figures font-semibold">{pct1(sonKoridor?.["Alt bant"] as number)}</p>
                    </div>
                  </div>
                  <CokluCizgiGrafigi
                    veri={koridorBirlesik}
                    seriler={[
                      { anahtar: "Üst bant", etiket: "Üst bant (borç verme)" },
                      { anahtar: "Politika faizi", etiket: "Politika faizi" },
                      { anahtar: "Alt bant", etiket: "Alt bant (borç alma)" },
                      { anahtar: "BIST gecelik repo", etiket: "BIST gecelik repo (piyasa)" },
                    ]}
                    ondalik={2}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="tlref">
              <p className="mb-3 text-sm text-muted-foreground">TLREF endeksi kapanış değeri (günlük).</p>
              <CokluCizgiGrafigi veri={tlrefVeri} seriler={[{ anahtar: "tlref_kapanis", etiket: "TLREF Kapanış" }]} ondalik={2} />
            </TabsContent>

            <TabsContent value="disdenge">
              <DisDengeBolumu />
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
              <NetRezervBolumu />
            </TabsContent>

            <TabsContent value="beklenti">
              <PiyasaBeklentileriBolumu />
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


            <TabsContent value="enflasyonraporu">
              {!enflasyonRaporu ? (
                <p className="text-sm text-muted-foreground">tcmb_enflasyon_raporu tablosu boş.</p>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold">{enflasyonRaporu.rapor_baslik}</h3>
                  <a
                    href={enflasyonRaporu.tam_metin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
                  >
                    📄 Tam metni indir (PDF)
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Bu bilgiler {enflasyonRaporu.indirilme_tarihi} tarihinde TCMB&apos;nin sitesinden çekildi.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
