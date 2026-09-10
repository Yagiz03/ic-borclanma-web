import { BosDurum } from "@/components/bos-durum";
import { sayi, yuzde } from "@/lib/bicim";
import { trTarihAyristir } from "@/lib/tarih";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { OzetSerit } from "@/components/ozet-serit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YiginliAlanGrafigi, RenkliBarGrafik } from "@/app/dashboard/tcmb/coklu-cizgi-grafigi";
import { OrtalamaVadeMaliyetBolumu } from "./ortalama-vade-maliyet";

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

async function BorcStokuNakitBolumu() {
  const supabase = await createClient();
  const [{ data: borcStokuVeri }, { data: nakitVeri }] = await Promise.all([
    supabase.from("borc_stoku").select("*").order("yil").order("ay"),
    supabase.from("nakit_gerceklesmeleri").select("*").order("yil").order("ay"),
  ]);

  const sonBorcStoku = borcStokuVeri && borcStokuVeri.length > 0 ? borcStokuVeri[borcStokuVeri.length - 1] : null;
  const oncekiBorcStoku = borcStokuVeri && borcStokuVeri.length > 1 ? borcStokuVeri[borcStokuVeri.length - 2] : null;
  const borcStokuGrafik = (borcStokuVeri ?? []).slice(-24).map((r) => ({
    etiket: r.ay_etiketi, "TL Stok": Number(r.tl_stok_toplam) / 1000, "Döviz Stok": Number(r.doviz_stok_toplam) / 1000,
  }));

  const sonNakit = nakitVeri && nakitVeri.length > 0 ? nakitVeri[nakitVeri.length - 1] : null;
  const nakitGrafik = (nakitVeri ?? []).slice(-24).map((r) => ({ etiket: r.ay_etiketi, nakit_dengesi: Number(r.nakit_dengesi) / 1000 }));

  if (!sonBorcStoku && !sonNakit) {
    return <p className="text-sm text-muted-foreground">Veri yok.</p>;
  }

  return (
    <div className="space-y-8">
      {sonBorcStoku && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">
            {sonBorcStoku.ay_etiketi} — Merkezi Yönetim Borç Stoku
          </h3>
          <OzetSerit
            alanlar={[
              {
                etiket: "Toplam Borç Stoku",
                deger: `${milyar(sonBorcStoku.toplam_stok_milyon_tl)} Mlr TL`,
                altBilgi:
                  delta(
                    sonBorcStoku.toplam_stok_milyon_tl / 1000,
                    oncekiBorcStoku ? oncekiBorcStoku.toplam_stok_milyon_tl / 1000 : null,
                    "Mlr TL",
                  ) ?? undefined,
              },
              { etiket: "TL Stok", deger: `${milyar(sonBorcStoku.tl_stok_toplam)} Mlr TL` },
              { etiket: "Döviz Stok", deger: `${milyar(sonBorcStoku.doviz_stok_toplam)} Mlr TL` },
            ]}
          />
          <p className="text-sm text-muted-foreground">
            İç borç: {milyar(sonBorcStoku.ic_borc_toplam)} Mlr TL — Dış borç: {milyar(sonBorcStoku.dis_borc_toplam)} Mlr
            TL (Kaynak: HMB Merkezi Yönetim Borç Stoku Döviz-Faiz Yapısı)
          </p>
          <YiginliAlanGrafigi
            veri={borcStokuGrafik}
            seriler={[
              { anahtar: "TL Stok", etiket: "TL Stok" },
              { anahtar: "Döviz Stok", etiket: "Döviz Stok" },
            ]}
            xKey="etiket"
            kategorik
            birim="Mlr TL"
          />
        </div>
      )}

      {sonNakit && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">
            {sonNakit.ay_etiketi} — Hazine Nakit Gerçekleşmeleri
          </h3>
          <OzetSerit
            alanlar={[
              { etiket: "Gelirler", deger: `${milyar(sonNakit.gelirler)} Mlr TL` },
              { etiket: "Giderler", deger: `${milyar(sonNakit.giderler)} Mlr TL` },
              { etiket: "Nakit Dengesi", deger: `${milyar(sonNakit.nakit_dengesi)} Mlr TL` },
            ]}
          />
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
  );
}

async function IcBorcCevirmeOraniBolumu() {
  const supabase = await createClient();
  const { data: cevirmeRes } = await supabase
    .from("ic_borc_cevirme_orani")
    .select("yil, ay, donem_tipi, ay_etiketi, ic_borclanma_mlr_tl, ic_borc_servisi_mlr_tl, anapara_mlr_tl, faiz_mlr_tl, cevirme_orani_pct, dipnot")
    .order("yil")
    .order("ay");

  const cevirmeAylik = (cevirmeRes ?? []).filter((r) => r.donem_tipi === "aylik");
  const sonCevirme = cevirmeAylik.length > 0 ? cevirmeAylik[cevirmeAylik.length - 1] : null;
  const oncekiCevirme = cevirmeAylik.length > 1 ? cevirmeAylik[cevirmeAylik.length - 2] : null;
  const cevirmeSon5Yil = sonCevirme
    ? cevirmeAylik.filter((r) => r.yil >= sonCevirme.yil - 5)
    : [];
  const cevirmeGrafik = cevirmeSon5Yil.map((r) => ({ etiket: r.ay_etiketi, cevirme_orani_pct: Number(r.cevirme_orani_pct) }));
  const cevirmeSon12Ay = [...cevirmeAylik].slice(-12).reverse();

  if (!sonCevirme) {
    return <BosDurum baslik="İç borç çevirme oranı verisi yok" aciklama="HMB'nin aylık çevirme oranı yayını henüz aktarılmadı." />;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{sonCevirme.ay_etiketi} — Toplam İç Borç Çevirme Oranı</h3>
      <p className="text-sm text-muted-foreground">
        İç Borçlanma / İç Borç Servisi (Anapara+Faiz TOPLAMI) — HMB&apos;nin kendi resmi hesaplaması.
        %100&apos;ün üstü, o ay yapılan yeni iç borçlanmanın toplam iç borç servisini karşılayıp fazlasını
        da finanse ettiğini gösterir.
      </p>
      <OzetSerit
        alanlar={[
          {
            etiket: "Çevirme Oranı",
            deger: pct1(sonCevirme.cevirme_orani_pct),
            altBilgi:
              delta(sonCevirme.cevirme_orani_pct, oncekiCevirme?.cevirme_orani_pct ?? null, "puan") ??
              undefined,
          },
          {
            etiket: "İç Borçlanma",
            deger: `${milyar(sonCevirme.ic_borclanma_mlr_tl, "milyar")} Mlr TL`,
          },
          {
            etiket: "İç Borç Servisi (Anapara+Faiz)",
            deger: `${milyar(sonCevirme.ic_borc_servisi_mlr_tl, "milyar")} Mlr TL`,
            altBilgi: `Anapara: ${milyar(sonCevirme.anapara_mlr_tl, "milyar")} — Faiz: ${milyar(sonCevirme.faiz_mlr_tl, "milyar")}`,
          },
        ]}
      />
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium">Ay</TableHead>
              <TableHead className="text-right font-medium">İç Borçlanma</TableHead>
              <TableHead className="text-right font-medium">İç Borç Servisi</TableHead>
              <TableHead className="text-right font-medium">Anapara</TableHead>
              <TableHead className="text-right font-medium">Faiz</TableHead>
              <TableHead className="text-right font-medium">Çevirme Oranı</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cevirmeSon12Ay.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="whitespace-nowrap">{r.ay_etiketi}</TableCell>
                <TableCell className="font-figures text-right">{milyar(r.ic_borclanma_mlr_tl, "milyar")}</TableCell>
                <TableCell className="font-figures text-right">{milyar(r.ic_borc_servisi_mlr_tl, "milyar")}</TableCell>
                <TableCell className="font-figures text-right">{milyar(r.anapara_mlr_tl, "milyar")}</TableCell>
                <TableCell className="font-figures text-right">{milyar(r.faiz_mlr_tl, "milyar")}</TableCell>
                <TableCell className="font-figures text-right">{pct1(r.cevirme_orani_pct)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Global aramadan ?tab= ile doğrudan ilgili sekmeye gelinebilsin diye
// (önce her sonuç sayfanın ilk sekmesini açıyordu).
/**
 * Eurobond (uluslararasi tahvil) ihrac sonuclari.
 *
 * tahvil_ihrac_sonuclari tablosu yerel veritabaninda vardi ama Supabase'e
 * hic tasinmamisti ve eski sitede de hicbir sayfa okumuyordu -- kupon,
 * ihrac fiyati, yatirimci getirisi ve UST'ye gore spread hicbir yerde
 * gorunmuyordu.
 */
async function EurobondBolumu() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tahvil_ihrac_sonuclari")
    .select("ihrac_tarihi, vade_tarihi, doviz_cinsi, miktar, kupon_orani_pct, fiyat_pct, yatirimciya_getirisi_pct, spread");

  const satirlar = [...(data ?? [])].sort(
    (a, b) =>
      (trTarihAyristir(b.ihrac_tarihi)?.getTime() ?? 0) -
      (trTarihAyristir(a.ihrac_tarihi)?.getTime() ?? 0),
  );

  if (satirlar.length === 0) {
    return (
      <BosDurum
        baslik="Eurobond ihraç kaydı yok"
        aciklama="HMB'nin uluslararası tahvil ihraç sonucu duyuruları henüz aktarılmadı."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        HMB&apos;nin uluslararası piyasalarda gerçekleştirdiği tahvil ihraçları — ihraç anındaki kupon,
        fiyat, yatırımcıya getiri ve ABD Hazine tahviline (UST) göre spread. Kaynak: ihraç sonucu basın
        duyuruları.
      </p>
      <div className="max-h-[560px] overflow-y-auto rounded-lg border border-border">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead>İhraç Tarihi</TableHead>
              <TableHead>İtfa Tarihi</TableHead>
              <TableHead>Döviz</TableHead>
              <TableHead>Miktar</TableHead>
              <TableHead className="px-4 text-right">Kupon</TableHead>
              <TableHead className="px-4 text-right">Fiyat</TableHead>
              <TableHead className="px-4 text-right">Yatırımcı Getirisi</TableHead>
              <TableHead>Spread</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {satirlar.map((r) => (
              <TableRow key={`${r.ihrac_tarihi}|${r.vade_tarihi}`}>
                <TableCell className="font-figures whitespace-nowrap">{r.ihrac_tarihi}</TableCell>
                <TableCell className="font-figures whitespace-nowrap">{r.vade_tarihi}</TableCell>
                <TableCell>{r.doviz_cinsi ?? "–"}</TableCell>
                <TableCell className="font-figures">{r.miktar ?? "–"}</TableCell>
                <TableCell className="font-figures px-4 text-right">{yuzde(r.kupon_orani_pct)}</TableCell>
                <TableCell className="font-figures px-4 text-right">
                  {r.fiyat_pct != null ? sayi(Number(r.fiyat_pct), 3) : "–"}
                </TableCell>
                <TableCell className="font-figures px-4 text-right">{yuzde(r.yatirimciya_getirisi_pct)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.spread ?? "–"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const SEKMELER = ["borcnakit", "cevirme", "vade", "eurobond"] as const;

export default async function HazinePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const gecerliTab = SEKMELER.includes(tab as (typeof SEKMELER)[number]) ? tab! : "borcnakit";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hazine</h1>
        <p className="text-sm text-muted-foreground">
          HMB&apos;nin (Hazine ve Maliye Bakanlığı) kendi yayımladığı makro göstergeler — borç stoku, nakit
          gerçekleşmeleri, iç borç çevirme oranı, ortalama vade/maliyet. TCMB (Merkez Bankası) verisi için
          &quot;TCMB&quot; sayfasına bakın.
        </p>
      </div>

      <Tabs defaultValue={gecerliTab}>
        <TabsList variant="line" className="mb-5 overflow-x-auto">
          <TabsTrigger value="borcnakit" className="shrink-0">Borç Stoku / Nakit</TabsTrigger>
          <TabsTrigger value="cevirme" className="shrink-0">İç Borç Çevirme Oranı</TabsTrigger>
          <TabsTrigger value="vade" className="shrink-0">Ortalama Vade / Maliyet</TabsTrigger>
          <TabsTrigger value="eurobond" className="shrink-0">Eurobond İhraçları</TabsTrigger>
        </TabsList>
        <TabsContent value="borcnakit">
          <BorcStokuNakitBolumu />
        </TabsContent>
        <TabsContent value="cevirme">
          <IcBorcCevirmeOraniBolumu />
        </TabsContent>
        <TabsContent value="eurobond">
          <EurobondBolumu />
        </TabsContent>
        <TabsContent value="vade">
          <OrtalamaVadeMaliyetBolumu />
        </TabsContent>
      </Tabs>
    </div>
  );
}
