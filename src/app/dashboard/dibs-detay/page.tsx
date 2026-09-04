import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trTarihSirala, isoTarihGoster } from "@/lib/tarih";
import { IsinSecici } from "./isin-secici";
import { FiyatGrafigi } from "./fiyat-grafigi";

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
  searchParams: Promise<{ isin?: string }>;
}) {
  const { isin: secilenParam } = await searchParams;
  const supabase = await createClient();

  const { data: ozetHam, error: ozetHata } = await supabase
    .from("isin_ozet")
    .select("*");

  if (ozetHata || !ozetHam || ozetHam.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
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
        ? "Bu kağıdın sabit bir kupon oranı yok -- gösterilen, ilk ihracın gerçekleşen getirisi."
        : undefined,
    });
  }
  if (secilen.son_ihrac_sonrasi_stok_mn) {
    alanlar.push({ etiket: "Toplam ihraç stoku", deger: milyon(secilen.son_ihrac_sonrasi_stok_mn) });
    if (secilen.tcmb_pay_pct != null) {
      alanlar.push({ etiket: "TCMB payı", deger: yuzde(secilen.tcmb_pay_pct, 1) });
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">DİBS Detay</h1>
        <IsinSecici
          secili={secilen.isin}
          secenekler={siraliOzet.map((r) => ({ isin: r.isin, etiket: `${r.isin} — ${r.senet_tanimi ?? ""}` }))}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold">
          {secilen.isin} <span className="font-normal text-muted-foreground">— {secilen.senet_tanimi}</span>
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {alanlar.map((a) => (
          <Card key={a.etiket}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{a.etiket}</p>
              <p className="font-figures text-xl font-semibold">{a.deger}</p>
              {a.yardim && <p className="mt-1 text-xs text-muted-foreground">{a.yardim}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {sonBist && (
        <Card>
          <CardHeader>
            <CardTitle>BIST ikincil piyasa fiyatı (Kesin Alım Satım Pazarı)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Son temiz fiyat</p>
                <p className="font-figures text-lg font-semibold">{Number(sonBist.temiz_fiyat).toFixed(3)}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Son bileşik getiri</p>
                <p className="font-figures text-lg font-semibold">{yuzde(sonBist.kapanis_bilesik_getiri_pct)}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Tarih</p>
                <p className="font-figures text-lg font-semibold">{isoTarihGoster(sonBist.tarih)}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">O günkü işlem hacmi</p>
                <p className="font-figures text-lg font-semibold">
                  {sonBist.islem_hacmi_tl != null
                    ? `${Number(sonBist.islem_hacmi_tl).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`
                    : "–"}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Temiz fiyatın zaman içindeki seyri</p>
              <FiyatGrafigi
                birim=""
                veri={(bistFiyatlar ?? [])
                  .filter((r) => r.temiz_fiyat != null)
                  .map((r) => ({ tarih: r.tarih, deger: Number(r.temiz_fiyat) }))}
              />
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
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
    </div>
  );
}
