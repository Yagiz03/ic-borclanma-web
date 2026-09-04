import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trTarihSirala, trTarihAyristir } from "@/lib/tarih";
import { SenetBadge } from "@/components/senet-badge";
import { EgriGrafigi } from "./egri-grafigi";

const EGRI_TIPLERI = new Set(["Sabit Kuponlu Devlet Tahvili", "Hazine Bonosu", "Kuponsuz Devlet Tahvili"]);

export default async function GetiriEgrisiPage() {
  const supabase = await createClient();

  const { data: ozetHam, error } = await supabase
    .from("isin_ozet")
    .select("isin, senet_tanimi, vade_tarihi, bist_son_bilesik_getiri_pct, bist_son_tarih")
    .not("bist_son_bilesik_getiri_pct", "is", null);

  if (error || !ozetHam) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold">Getiri Eğrisi</h1>
        <p className="mt-4 text-sm text-destructive">{error?.message ?? "Veri bulunamadı."}</p>
      </div>
    );
  }

  const bugun = new Date();
  const kagitlar = trTarihSirala(
    ozetHam.filter((r) => r.senet_tanimi && EGRI_TIPLERI.has(r.senet_tanimi)),
    (r) => r.vade_tarihi,
  )
    .map((r) => {
      const vade = trTarihAyristir(r.vade_tarihi);
      const kalanVadeYil = vade ? (vade.getTime() - bugun.getTime()) / (365 * 86_400_000) : null;
      return { ...r, kalanVadeYil };
    })
    .filter((r) => r.kalanVadeYil != null && r.kalanVadeYil > 0);

  const grafikVerisi = kagitlar.map((r) => ({
    isin: r.isin,
    kalanVadeYil: r.kalanVadeYil!,
    getiri: Number(r.bist_son_bilesik_getiri_pct),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Getiri Eğrisi</h1>
        <p className="text-sm text-muted-foreground">
          Sabit getirili kağıtların (Hazine Bonosu, Sabit Kuponlu, Kuponsuz) son kapanış bileşik getirisi,
          kalan vadeye göre.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <EgriGrafigi veri={grafikVerisi} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {kagitlar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Veri yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ISIN</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Vade</TableHead>
                  <TableHead className="text-right">Kalan vade</TableHead>
                  <TableHead className="text-right">Getiri</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kagitlar.map((r) => (
                  <TableRow key={r.isin}>
                    <TableCell className="font-figures">{r.isin}</TableCell>
                    <TableCell>
                      <SenetBadge tanim={r.senet_tanimi} />
                    </TableCell>
                    <TableCell className="font-figures">{r.vade_tarihi}</TableCell>
                    <TableCell className="font-figures text-right">{r.kalanVadeYil!.toFixed(2)} yıl</TableCell>
                    <TableCell className="font-figures text-right">
                      %{Number(r.bist_son_bilesik_getiri_pct).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
