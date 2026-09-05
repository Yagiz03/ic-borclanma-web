import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CokluCizgiGrafigi, YiginliAlanGrafigi, RenkliBarGrafik } from "./coklu-cizgi-grafigi";
import { TcmbApiPortfoyuBolumu } from "./tcmb-api-portfoyu";

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

function milyar(v: number | null | undefined, kaynakBirim: "milyon" | "milyar" = "milyon"): string {
  if (v == null) return "–";
  const deger = kaynakBirim === "milyon" ? v / 1000 : v;
  return deger.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

function pct1(v: number | null | undefined): string {
  return v == null ? "–" : `%${v.toFixed(1)}`;
}

function delta(simdi: number | null | undefined, once: number | null | undefined, birim: string, ondalik = 1): string | null {
  if (simdi == null || once == null) return null;
  const d = simdi - once;
  return `${d >= 0 ? "+" : ""}${d.toFixed(ondalik)} ${birim}`;
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
  const [
    dibsRes, tlrefRes, kurRes, rezervRes, m2Res, repoRes, enflasyonRes,
    koridorRes, politikaRes, borcStokuRes, nakitRes, cevirmeRes, enflasyonRaporuRes,
  ] = await Promise.all([
    supabase.from("evds_seriler").select("*").in("seri_adi", dibsSeriler).order("tarih"),
    supabase.from("evds_seriler").select("*").eq("seri_adi", "tlref_kapanis").order("tarih"),
    supabase.from("evds_seriler").select("*").in("seri_adi", kurSeriler).order("tarih"),
    supabase.from("evds_seriler").select("*").in("seri_adi", rezervSeriler).order("tarih"),
    supabase.from("evds_seriler").select("*").eq("seri_adi", "m2_para_arzi").order("tarih"),
    supabase.from("evds_seriler").select("*").eq("seri_adi", "repo_gecelik_bist").order("tarih"),
    supabase.from("evds_seriler").select("*").in("seri_adi", enflasyonSeriler).order("tarih"),
    supabase.from("tcmb_faiz_koridoru").select("tarih, borc_alma, borc_verme").order("tarih"),
    supabase.from("tcmb_politika_faizi").select("tarih, politika_faizi").order("tarih"),
    supabase.from("borc_stoku").select("*").order("yil").order("ay"),
    supabase.from("nakit_gerceklesmeleri").select("*").order("yil").order("ay"),
    supabase
      .from("ic_borc_cevirme_orani")
      .select("yil, ay, donem_tipi, ay_etiketi, ic_borclanma_mlr_tl, ic_borc_servisi_mlr_tl, anapara_mlr_tl, faiz_mlr_tl, cevirme_orani_pct, dipnot")
      .order("yil")
      .order("ay"),
    supabase.from("tcmb_enflasyon_raporu").select("*").limit(1).maybeSingle(),
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

  const borcStokuVeri = borcStokuRes.data ?? [];
  const sonBorcStoku = borcStokuVeri[borcStokuVeri.length - 1];
  const oncekiBorcStoku = borcStokuVeri.length > 1 ? borcStokuVeri[borcStokuVeri.length - 2] : null;
  const borcStokuGrafik = borcStokuVeri.slice(-24).map((r) => ({
    etiket: r.ay_etiketi, "TL Stok": Number(r.tl_stok_toplam) / 1000, "Döviz Stok": Number(r.doviz_stok_toplam) / 1000,
  }));

  const nakitVeri = nakitRes.data ?? [];
  const sonNakit = nakitVeri[nakitVeri.length - 1];
  const nakitGrafik = nakitVeri.slice(-24).map((r) => ({ etiket: r.ay_etiketi, nakit_dengesi: Number(r.nakit_dengesi) / 1000 }));

  const cevirmeAylik = (cevirmeRes.data ?? []).filter((r) => r.donem_tipi === "aylik");
  const sonCevirme = cevirmeAylik[cevirmeAylik.length - 1];
  const oncekiCevirme = cevirmeAylik.length > 1 ? cevirmeAylik[cevirmeAylik.length - 2] : null;
  const cevirmeSon5Yil = sonCevirme
    ? cevirmeAylik.filter((r) => r.yil >= sonCevirme.yil - 5)
    : [];
  const cevirmeGrafik = cevirmeSon5Yil.map((r) => ({ etiket: r.ay_etiketi, cevirme_orani_pct: Number(r.cevirme_orani_pct) }));
  const cevirmeSon12Ay = [...cevirmeAylik].slice(-12).reverse();

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
              <TabsTrigger value="koridor" className="shrink-0">Repo Faiz Koridoru</TabsTrigger>
              <TabsTrigger value="tlref" className="shrink-0">TLREF</TabsTrigger>
              <TabsTrigger value="kur" className="shrink-0">Döviz Kuru</TabsTrigger>
              <TabsTrigger value="rezerv" className="shrink-0">Net Rezerv</TabsTrigger>
              <TabsTrigger value="m2repo" className="shrink-0">M2 &amp; Repo</TabsTrigger>
              <TabsTrigger value="enflasyon" className="shrink-0">Enflasyon &amp; Beklentiler</TabsTrigger>
              <TabsTrigger value="borcnakit" className="shrink-0">Borç Stoku / Nakit</TabsTrigger>
              <TabsTrigger value="cevirme" className="shrink-0">İç Borç Çevirme Oranı</TabsTrigger>
              <TabsTrigger value="enflasyonraporu" className="shrink-0">Enflasyon Raporu</TabsTrigger>
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

            <TabsContent value="apiportfoyu">
              <TcmbApiPortfoyuBolumu />
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

            <TabsContent value="borcnakit">
              {!sonBorcStoku && !sonNakit ? (
                <p className="text-sm text-muted-foreground">Veri yok.</p>
              ) : (
                <div className="space-y-8">
                  {sonBorcStoku && (
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold">
                        {sonBorcStoku.ay_etiketi} -- Merkezi Yönetim Borç Stoku
                      </h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-xs text-muted-foreground">Toplam Borç Stoku</p>
                          <p className="font-figures font-semibold">{milyar(sonBorcStoku.toplam_stok_milyon_tl)} Mlr TL</p>
                          <p className="text-xs text-muted-foreground">
                            {delta(
                              sonBorcStoku.toplam_stok_milyon_tl / 1000,
                              oncekiBorcStoku ? oncekiBorcStoku.toplam_stok_milyon_tl / 1000 : null,
                              "Mlr TL",
                            )}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-xs text-muted-foreground">TL Stok</p>
                          <p className="font-figures font-semibold">{milyar(sonBorcStoku.tl_stok_toplam)} Mlr TL</p>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-xs text-muted-foreground">Döviz Stok</p>
                          <p className="font-figures font-semibold">{milyar(sonBorcStoku.doviz_stok_toplam)} Mlr TL</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        İç borç: {milyar(sonBorcStoku.ic_borc_toplam)} Mlr TL -- Dış borç: {milyar(sonBorcStoku.dis_borc_toplam)} Mlr
                        TL (Kaynak: HMB Merkezi Yönetim Borç Stoku Döviz-Faiz Yapısı)
                      </p>
                      <YiginliAlanGrafigi
                        veri={borcStokuGrafik}
                        seriler={[
                          { anahtar: "TL Stok", etiket: "TL Stok" },
                          { anahtar: "Döviz Stok", etiket: "Döviz Stok" },
                        ]}
                      />
                    </div>
                  )}

                  {sonNakit && (
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold">
                        {sonNakit.ay_etiketi} -- Hazine Nakit Gerçekleşmeleri
                      </h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-xs text-muted-foreground">Gelirler</p>
                          <p className="font-figures font-semibold">{milyar(sonNakit.gelirler)} Mlr TL</p>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-xs text-muted-foreground">Giderler</p>
                          <p className="font-figures font-semibold">{milyar(sonNakit.giderler)} Mlr TL</p>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-xs text-muted-foreground">Nakit Dengesi</p>
                          <p className="font-figures font-semibold">{milyar(sonNakit.nakit_dengesi)} Mlr TL</p>
                        </div>
                      </div>
                      {sonNakit.ic_borclanma_net != null && sonNakit.dis_borclanma_net != null && (
                        <p className="text-sm text-muted-foreground">
                          Net borçlanma: {milyar(sonNakit.borclanma_net)} Mlr TL (İç: {milyar(sonNakit.ic_borclanma_net)}, Dış:{" "}
                          {milyar(sonNakit.dis_borclanma_net)})
                        </p>
                      )}
                      <RenkliBarGrafik veri={nakitGrafik} dataKey="nakit_dengesi" etiket="Nakit Dengesi (Mlr TL)" esikDeger={0} birim=" Mlr TL" />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="cevirme">
              {!sonCevirme ? (
                <p className="text-sm text-muted-foreground">ic_borc_cevirme_orani tablosu boş.</p>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold">{sonCevirme.ay_etiketi} -- Toplam İç Borç Çevirme Oranı</h3>
                  <p className="text-sm text-muted-foreground">
                    İç Borçlanma / İç Borç Servisi (Anapara+Faiz TOPLAMI) -- HMB&apos;nin kendi resmi hesaplaması.
                    %100&apos;ün üstü, o ay yapılan yeni iç borçlanmanın toplam iç borç servisini karşılayıp fazlasını
                    da finanse ettiğini gösterir.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Çevirme Oranı</p>
                      <p className="font-figures font-semibold">{pct1(sonCevirme.cevirme_orani_pct)}</p>
                      <p className="text-xs text-muted-foreground">
                        {delta(sonCevirme.cevirme_orani_pct, oncekiCevirme?.cevirme_orani_pct ?? null, "puan")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">İç Borçlanma</p>
                      <p className="font-figures font-semibold">{milyar(sonCevirme.ic_borclanma_mlr_tl, "milyar")} Mlr TL</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">İç Borç Servisi (Anapara+Faiz)</p>
                      <p className="font-figures font-semibold">{milyar(sonCevirme.ic_borc_servisi_mlr_tl, "milyar")} Mlr TL</p>
                      <p className="text-xs text-muted-foreground">
                        Anapara: {milyar(sonCevirme.anapara_mlr_tl, "milyar")} -- Faiz: {milyar(sonCevirme.faiz_mlr_tl, "milyar")}
                      </p>
                    </div>
                  </div>
                  {sonCevirme.dipnot && (
                    <p className="text-xs text-muted-foreground">
                      Not {sonCevirme.dipnot}: bu ay HMB&apos;nin dipnotuna göre döviz cinsi ihraç ve/veya Altın
                      Tahvili/Altına Dayalı Kira Sertifikası tutarı da borçlanmaya dahil edilerek hesaplanmış.
                    </p>
                  )}
                  <RenkliBarGrafik veri={cevirmeGrafik} dataKey="cevirme_orani_pct" etiket="Çevirme Oranı (%)" esikDeger={100} birim="%" />
                  <p className="text-xs text-muted-foreground">
                    Kaynak: HMB Toplam İç Borç Çevirme Oranları (2003-günümüz, aylık veri 2011&apos;den itibaren --
                    öncesi sadece yıllık yayımlanıyor).
                  </p>

                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Ay</th>
                          <th className="px-3 py-2 text-right font-medium">İç Borçlanma</th>
                          <th className="px-3 py-2 text-right font-medium">İç Borç Servisi</th>
                          <th className="px-3 py-2 text-right font-medium">Anapara</th>
                          <th className="px-3 py-2 text-right font-medium">Faiz</th>
                          <th className="px-3 py-2 text-right font-medium">Çevirme Oranı</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cevirmeSon12Ay.map((r, i) => (
                          <tr key={i} className="border-b border-border/60 last:border-0">
                            <td className="whitespace-nowrap px-3 py-2">{r.ay_etiketi}</td>
                            <td className="font-figures px-3 py-2 text-right">{milyar(r.ic_borclanma_mlr_tl, "milyar")}</td>
                            <td className="font-figures px-3 py-2 text-right">{milyar(r.ic_borc_servisi_mlr_tl, "milyar")}</td>
                            <td className="font-figures px-3 py-2 text-right">{milyar(r.anapara_mlr_tl, "milyar")}</td>
                            <td className="font-figures px-3 py-2 text-right">{milyar(r.faiz_mlr_tl, "milyar")}</td>
                            <td className="font-figures px-3 py-2 text-right">{pct1(r.cevirme_orani_pct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
