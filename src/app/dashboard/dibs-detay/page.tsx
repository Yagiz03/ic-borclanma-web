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
import { OzetSerit } from "./ozet-serit";
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
          {ozetHata?.message ?? "isin_ozet tablosu boş."}
        </p>
      </div>
    );
  }

  const siraliOzet = trTarihSirala(ozetHam, (r) => r.vade_tarihi);
  const secilen = siraliOzet.find((r) => r.isin === secilenParam) ?? siraliOzet[0];

  const [{ data: ihaleler }, { data: bistFiyatlar }] = await Promise.all([
    supabase.from("ihale_sonuclari").select("*").eq("isin", secilen.isin),
    supabase
      .from("bist_bap_fiyatlar")
      .select("tarih, temiz_fiyat, kapanis_bilesik_getiri_pct, islem_hacmi_tl")
      .eq("isin", secilen.isin)
      .order("tarih", { ascending: true }),
  ]);

  const { data: izlemeSatiri } = await supabase
    .from("watchlist")
    .select("id")
    .eq("isin", secilen.isin)
    .maybeSingle();

  const siraliIhale = ihaleler ? trTarihSirala(ihaleler, (r) => r.ihale_tarihi) : [];
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
