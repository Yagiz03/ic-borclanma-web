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
import { trTarihSirala } from "@/lib/tarih";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: hepsi, error }, { count: kagitSayisi }, { count: ihaleSayisi }] = await Promise.all([
    supabase
      .from("isin_ozet")
      .select("isin, senet_tanimi, vade_tarihi, bist_son_bilesik_getiri_pct"),
    supabase.from("isin_ozet").select("isin", { count: "exact", head: true }),
    supabase.from("ihale_sonuclari").select("isin", { count: "exact", head: true }),
  ]);

  const kagitlar = hepsi ? trTarihSirala(hepsi, (k) => k.vade_tarihi).slice(0, 8) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Özet</h1>
        <p className="text-sm text-muted-foreground">
          Türkiye Hazine iç borçlanma senetleri (DİBS) takip paneli.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Takipteki kağıt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-figures text-3xl font-semibold">{kagitSayisi ?? "–"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kayıtlı ihale sonucu</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-figures text-3xl font-semibold">{ihaleSayisi ?? "–"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Veri kaynağı</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">HMB · BIST BAP · TCMB</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vadesi en yakın kağıtlar</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error.message}</p>}
          {kagitlar && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ISIN</TableHead>
                  <TableHead>Senet</TableHead>
                  <TableHead>Vade</TableHead>
                  <TableHead className="text-right">Getiri</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kagitlar.map((k) => (
                  <TableRow key={k.isin}>
                    <TableCell className="font-figures">{k.isin}</TableCell>
                    <TableCell>{k.senet_tanimi}</TableCell>
                    <TableCell className="font-figures">{k.vade_tarihi}</TableCell>
                    <TableCell className="font-figures text-right">
                      {k.bist_son_bilesik_getiri_pct != null
                        ? `%${k.bist_son_bilesik_getiri_pct.toFixed(2)}`
                        : "–"}
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
