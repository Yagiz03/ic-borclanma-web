import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trTarihSirala, isoTarihGoster } from "@/lib/tarih";
import { SenetBadge } from "@/components/senet-badge";
import { IsinSecici } from "./isin-secici";
import { FiyatGrafigi } from "./fiyat-grafigi";
import { IzlemeButonu } from "./izleme-butonu";
import { OzetSerit } from "@/components/ozet-serit";
import { KarsilastirBolumu } from "@/app/dashboard/karsilastir/karsilastir-bolumu";
import { DuzenliIslemGorenBolumu } from "./duzenli-islem-goren";

function yuzde(v: number | string | null | undefined, ondalik = 2): string {
  if (v == null) return "–";
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? `%${n.toFixed(ondalik)}` : "–";
}

function milyon(v: number | string | null | undefined): string {
  if (v == null) return "–";
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? `${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} Mn TL` : "–";
}

export default async function DibsDetayPage({
  searchParams,
}: {
  searchParams: Promise<{ isin?: string; isinler?: string; tab?: string }>;
}) {
  const { isin: secilenParam, isinler: isinlerParam, tab } = await searchParams;
  const supabase = await createClient();

  const { data: ozetHam, error: ozetHata } = await supabase
    .from("isin_ozet")
    .select("*");

  if (ozetHata || !ozetHam || ozetHam.length === 0) {
    return (
      <div className="w-full">
        <h1 className="text-2xl font-semibold">DİBS Detay</h1>
        <p className="mt-4 text-sm text-destructive">
          {ozetHata?.message ?? "Kağıt listesi yüklenemedi."}
        </p>
      </div>
    );
  }

  const siraliOzet = trTarihSirala(ozetHam, (r) => r.vade_tarihi);
  const secilen = siraliOzet.find((r) => r.isin === secilenParam) ?? siraliOzet[0];

  const [{ data: ihaleler }, { data: bistFiyatlar }, { data: duyurular }, { data: tcmbAlimlar }] =
    await Promise.all([
    supabase.from("ihale_sonuclari").select("*").eq("isin", secilen.isin),
    supabase
      .from("bist_bap_fiyatlar")
      .select("tarih, temiz_fiyat, kapanis_bilesik_getiri_pct, islem_hacmi_tl")
      .eq("isin", secilen.isin)
      .order("tarih", { ascending: true }),
    // HMB'nin ihale ÖNCESİ duyurusu -- resmi kupon oranı/ek getiri burada
    // ilan edilir, ihale sonrası sonuç duyurusundan farklı bir belgedir.
    supabase
      .from("ihale_duyurulari")
      .select("ihale_tarihi, valor_tarihi, itfa_tarihi, vade_aciklama, ihrac_tipi, resmi_kupon_orani_pct, ek_getiri_bp, kaynak_url")
      .eq("isin", secilen.isin),
    supabase
      .from("tcmb_dogrudan_alim")
      .select("ihale_tarihi, kazanan_tutar_nominal_bin_tl")
      .eq("isin", secilen.isin),
  ]);

  const { data: izlemeSatiri } = await supabase
    .from("watchlist")
    .select("id")
    .eq("isin", secilen.isin)
    .maybeSingle();

  const siraliIhale = ihaleler ? trTarihSirala(ihaleler, (r) => r.ihale_tarihi) : [];
  const siraliDuyuru = duyurular ? trTarihSirala(duyurular, (r) => r.ihale_tarihi) : [];

  // TCMB doğrudan alımları: tarihe göre artan sırada kümülatif toplam
  // çıkarılıp tabloda tersten (en yeni üstte) gösteriliyor.
  const alimlarArtan = tcmbAlimlar ? trTarihSirala(tcmbAlimlar, (r) => r.ihale_tarihi) : [];
  const tcmbAlimSatirlari = alimlarArtan.reduce<{ tarih: string; tutar: number; kumulatif: number }[]>(
    (birikim, r) => {
      const tutar = r.kazanan_tutar_nominal_bin_tl != null ? Number(r.kazanan_tutar_nominal_bin_tl) : 0;
      const oncekiKumulatif = birikim.length ? birikim[birikim.length - 1].kumulatif : 0;
      return [...birikim, { tarih: r.ihale_tarihi as string, tutar, kumulatif: oncekiKumulatif + tutar }];
    },
    [],
  );
  const tcmbToplamAlim = tcmbAlimSatirlari.length
    ? tcmbAlimSatirlari[tcmbAlimSatirlari.length - 1].kumulatif
    : 0;
  const sonBist = bistFiyatlar && bistFiyatlar.length > 0 ? bistFiyatlar[bistFiyatlar.length - 1] : null;

  const alanlar: { etiket: string; deger: string; yardim?: string }[] = [
    { etiket: "İlk ihraç", deger: isoTarihGoster(secilen.ilk_ihrac_tarihi) },
    { etiket: "Vade", deger: secilen.vade_tarihi ?? "–" },
  ];
  if (secilen.ihrac_sayisi) alanlar.push({ etiket: "İhraç sayısı", deger: String(secilen.ihrac_sayisi) });
  if (secilen.son_ihrac_faizi != null) {
    alanlar.push({
      etiket: "Son gerçekleşen faiz (Bileşik)",
      deger: yuzde(secilen.son_ihrac_faizi),
      yardim: "HMB'nin ihale sonucu duyurusundaki 'Ortalama Yıllık Bileşik' alanı.",
    });
  }
  const floaterMi =
    secilen.senet_tanimi === "TLREF'e Endeksli Devlet Tahvili" ||
    secilen.senet_tanimi === "Değişken Faizli Devlet Tahvili";
  if (secilen.tahmini_kupon_orani != null) {
    alanlar.push({
      etiket: floaterMi ? "İlk ihraç faizi (kupon DEĞİL)" : "Kupon oranı",
      deger: yuzde(secilen.tahmini_kupon_orani),
      yardim: floaterMi
        ? "Bu kağıdın sabit bir kupon oranı yok — gösterilen, ilk ihracın gerçekleşen getirisi."
        : undefined,
    });
  }
  // Bazı Kamu Kira Sertifikalarında BIST referans verisinde ihraç tutarı
  // eksik/sıfır geliyor; o durumda stok/TCMB/serbest dolaşım rakamlarının hepsi
  // anlamsız "0" çıkar. Gerçek veri yoksa satırı hiç göstermemek yanıltıcı "0"
  // yazmaktan daha doğru (pages/isin_detay.py ile aynı kural).
  if (secilen.son_ihrac_sonrasi_stok_mn && Number(secilen.son_ihrac_sonrasi_stok_mn) > 0) {
    const binToMilyon = (v: unknown) =>
      v == null ? null : Number(v) / 1000;
    const tcmbMn = binToMilyon(secilen.tcmb_toplam_alim_bin_tl);
    const serbestMn = binToMilyon(secilen.serbest_dolasim_bin_tl);

    alanlar.push({ etiket: "Toplam ihraç stoku", deger: milyon(secilen.son_ihrac_sonrasi_stok_mn) });
    alanlar.push({
      etiket: "TCMB'nin geri aldığı",
      deger: tcmbMn != null ? `${tcmbMn.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Milyon` : "0",
    });
    alanlar.push({
      etiket: "Serbest dolaşım (tahmini)",
      deger: serbestMn != null ? `${serbestMn.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Milyon` : "–",
    });
    alanlar.push({
      etiket: "TCMB payı",
      deger: secilen.tcmb_pay_pct != null ? yuzde(secilen.tcmb_pay_pct, 1) : "%0",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">DİBS Detay</h1>
      </div>

      <Tabs
        defaultValue={
          tab === "karsilastir" ? "karsilastir" : tab === "duzenli" ? "duzenli" : "detay"
        }
      >
        <TabsList variant="line" className="mb-5 overflow-x-auto">
          <TabsTrigger value="detay" className="shrink-0">DİBS Detay</TabsTrigger>
          <TabsTrigger value="duzenli" className="shrink-0">Düzenli İşlem Gören</TabsTrigger>
          <TabsTrigger value="karsilastir" className="shrink-0">Karşılaştır</TabsTrigger>
        </TabsList>

        <TabsContent value="detay" className="space-y-6">
      <IsinSecici
        secili={secilen.isin}
        secenekler={siraliOzet.map((r) => ({ isin: r.isin, etiket: `${r.isin} — ${r.senet_tanimi ?? ""}` }))}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{secilen.isin}</h2>
          <SenetBadge tanim={secilen.senet_tanimi} />
        </div>
        <IzlemeButonu isin={secilen.isin} baslangicIzlemede={!!izlemeSatiri} />
      </div>

      <OzetSerit alanlar={alanlar} />

      {sonBist && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>BIST ikincil piyasa fiyatı (Kesin Alım Satım Pazarı)</CardTitle>
            </CardHeader>
            <CardContent>
              <OzetSerit
                alanlar={[
                  { etiket: "Son temiz fiyat", deger: Number(sonBist.temiz_fiyat).toFixed(3) },
                  { etiket: "Son bileşik getiri", deger: yuzde(sonBist.kapanis_bilesik_getiri_pct) },
                  { etiket: "Tarih", deger: isoTarihGoster(sonBist.tarih) },
                  {
                    etiket: "O günkü işlem hacmi",
                    deger:
                      sonBist.islem_hacmi_tl != null
                        ? `${Number(sonBist.islem_hacmi_tl).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`
                        : "–",
                  },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Temiz fiyatın zaman içindeki seyri (kapanış)</CardTitle>
            </CardHeader>
            <CardContent>
              <FiyatGrafigi
                birim=""
                veri={(bistFiyatlar ?? [])
                  .filter((r) => r.temiz_fiyat != null)
                  .map((r) => ({ tarih: r.tarih, deger: Number(r.temiz_fiyat) }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>İkincil piyasa bileşik getirisinin zaman içindeki seyri</CardTitle>
            </CardHeader>
            <CardContent>
              <FiyatGrafigi
                birim="%"
                renk="var(--chart-2)"
                ondalik={2}
                veri={(bistFiyatlar ?? [])
                  .filter((r) => r.kapanis_bilesik_getiri_pct != null)
                  .map((r) => ({ tarih: r.tarih, deger: Number(r.kapanis_bilesik_getiri_pct) }))}
              />
            </CardContent>
          </Card>
        </>
      )}

      {siraliDuyuru.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gerçekleştirilecek İhalelere İlişkin Basın Duyurusu</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              HMB&apos;nin ihale ÖNCESİ (genelde bir gün önce) yayımladığı duyuru — resmi kupon oranı
              ve ek getiri burada ilan edilir. İhale sonrası sonuç duyurusundan (aşağıdaki
              &quot;İhale geçmişi&quot; tablosu) farklı bir belgedir.
            </p>
            <div className="max-h-[300px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>İhale Tarihi</TableHead>
                    <TableHead>Valör</TableHead>
                    <TableHead>İtfa Tarihi</TableHead>
                    <TableHead>Vade</TableHead>
                    <TableHead>İhraç Tipi</TableHead>
                    <TableHead className="text-right">Resmi Kupon Oranı</TableHead>
                    <TableHead className="text-right">Ek Getiri (bp)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siraliDuyuru.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-figures whitespace-nowrap">{d.ihale_tarihi}</TableCell>
                      <TableCell className="font-figures whitespace-nowrap">{isoTarihGoster(d.valor_tarihi)}</TableCell>
                      <TableCell className="font-figures whitespace-nowrap">{isoTarihGoster(d.itfa_tarihi)}</TableCell>
                      <TableCell>{d.vade_aciklama ?? "–"}</TableCell>
                      <TableCell>{d.ihrac_tipi ?? "–"}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(d.resmi_kupon_orani_pct)}</TableCell>
                      <TableCell className="font-figures text-right">
                        {d.ek_getiri_bp == null ? "–" : Number(d.ek_getiri_bp).toFixed(0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>İhale geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          {siraliIhale.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu ISIN için ihale kaydı bulunamadı.</p>
          ) : (
            <div className="max-h-[340px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>İhraç Tipi</TableHead>
                    <TableHead className="text-right">Ort. Faiz (Bileşik)</TableHead>
                    <TableHead className="text-right">En Düşük</TableHead>
                    <TableHead className="text-right">En Yüksek</TableHead>
                    <TableHead className="text-right">Talep Karşılama</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siraliIhale.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-figures">{h.ihale_tarihi}</TableCell>
                      <TableCell>{h.ihrac_tipi ?? "–"}</TableCell>
                      <TableCell className="font-figures text-right">
                        {yuzde(h.ort_yillik_bilesik_gerceklesme)}
                      </TableCell>
                      <TableCell className="font-figures text-right">
                        {yuzde(h.en_dusuk_bilesik_gerceklesme)}
                      </TableCell>
                      <TableCell className="font-figures text-right">
                        {yuzde(h.en_yuksek_bilesik_gerceklesme)}
                      </TableCell>
                      <TableCell className="font-figures text-right">{yuzde(h.toplam_oran_pct, 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TCMB doğrudan alım geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          {tcmbAlimSatirlari.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              TCMB bu ISIN&apos;i doğrudan alım yoluyla satın almamış (kayıtlarımızda yok).
            </p>
          ) : (
            <div className="space-y-4">
              <OzetSerit
                alanlar={[
                  {
                    etiket: "Toplam alım",
                    deger: `${tcmbToplamAlim.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} Bin TL`,
                  },
                  { etiket: "Doğrudan alım ihalesi", deger: String(tcmbAlimSatirlari.length) },
                ]}
              />
              <div className="max-h-[300px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead className="text-right">Alınan tutar (Bin TL)</TableHead>
                      <TableHead className="text-right">Kümülatif (Bin TL)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...tcmbAlimSatirlari].reverse().map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-figures whitespace-nowrap">{isoTarihGoster(r.tarih)}</TableCell>
                        <TableCell className="font-figures text-right">
                          {r.tutar.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell className="font-figures text-right">
                          {r.kumulatif.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="duzenli">
          <DuzenliIslemGorenBolumu />
        </TabsContent>

        <TabsContent value="karsilastir">
          <KarsilastirBolumu isinlerParam={isinlerParam} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
