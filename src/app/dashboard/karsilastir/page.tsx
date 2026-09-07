import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { trTarihSirala } from "@/lib/tarih";
import { IsinCokSecici } from "./isin-cok-secici";
import { KarsilastirmaGrafigi } from "./karsilastirma-grafigi";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";

export default async function KarsilastirPage({
  searchParams,
}: {
  searchParams: Promise<{ isinler?: string }>;
}) {
  const { isinler: isinlerParam } = await searchParams;
  const supabase = await createClient();

  const { data: ozetHam, error } = await supabase
    .from("isin_ozet")
    .select("isin, senet_tanimi, vade_tarihi");

  if (error || !ozetHam) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold">Karşılaştır</h1>
        <p className="mt-4 text-sm text-destructive">{error?.message ?? "Veri bulunamadı."}</p>
      </div>
    );
  }

  const siraliOzet = trTarihSirala(ozetHam, (r) => r.vade_tarihi);

  // 3500+ satır -- tek sorguda Supabase'in 1000 satır sınırını aşıyor.
  const { data: butunBist } = await tumSatirlariGetir((from, to) =>
    supabase
      .from("bist_bap_fiyatlar")
      .select("isin, tarih, kapanis_bilesik_getiri_pct")
      .not("kapanis_bilesik_getiri_pct", "is", null)
      .order("isin")
      .order("tarih")
      .range(from, to),
  );

  const bistIsinSeti = new Set((butunBist ?? []).map((r) => r.isin));
  const varsayilanlar = siraliOzet.filter((r) => bistIsinSeti.has(r.isin)).slice(0, 2).map((r) => r.isin);

  const secililer = isinlerParam ? isinlerParam.split(",").filter(Boolean) : varsayilanlar;

  const tarihSetiSirali = Array.from(
    new Set((butunBist ?? []).filter((r) => secililer.includes(r.isin)).map((r) => r.tarih)),
  ).sort();

  const grafikVerisi = tarihSetiSirali.map((tarih) => {
    const satir: Record<string, string | number> = { tarih };
    for (const isin of secililer) {
      const eslesen = butunBist?.find((r) => r.isin === isin && r.tarih === tarih);
      if (eslesen) satir[isin] = Number(eslesen.kapanis_bilesik_getiri_pct);
    }
    return satir;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Karşılaştır</h1>
        <p className="text-sm text-muted-foreground">
          Birden fazla kağıdın BIST bileşik getirisini aynı grafikte karşılaştır (2-5 kağıt önerilir).
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <IsinCokSecici
            secililer={secililer}
            secenekler={siraliOzet.map((r) => ({ isin: r.isin, etiket: r.senet_tanimi ?? "" }))}
          />
          {secililer.length === 0 ? (
            <p className="text-sm text-muted-foreground">En az bir kağıt seç.</p>
          ) : (
            <KarsilastirmaGrafigi veri={grafikVerisi} isinler={secililer} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
