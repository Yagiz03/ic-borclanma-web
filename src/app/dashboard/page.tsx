import { Landmark, Gavel, Database } from "lucide-react";
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
import { trTarihSirala } from "@/lib/tarih";
import { SenetBadge } from "@/components/senet-badge";
import { DagilimGrafigi } from "./dagilim-grafigi";

function StatKart({
  icon: Icon,
  etiket,
  deger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  etiket: string;
  deger: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{etiket}</p>
          <p className="font-figures text-2xl font-semibold">{deger}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: hepsi, error }, { count: ihaleSayisi }] = await Promise.all([
    supabase.from("isin_ozet").select("isin, senet_tanimi, vade_tarihi, bist_son_bilesik_getiri_pct"),
    supabase.from("ihale_sonuclari").select("isin", { count: "exact", head: true }),
  ]);

  const kagitlar = hepsi ? trTarihSirala(hepsi, (k) => k.vade_tarihi).slice(0, 8) : null;

  const dagilim = hepsi
    ? Object.entries(
        hepsi.reduce<Record<string, number>>((acc, k) => {
          const tip = k.senet_tanimi ?? "Bilinmiyor";
          acc[tip] = (acc[tip] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .map(([tip, adet]) => ({ tip, adet }))
        .sort((a, b) => b.adet - a.adet)
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Özet</h1>
        <p className="text-sm text-muted-foreground">
          Türkiye Hazine iç borçlanma senetleri (DİBS) takip paneli.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatKart icon={Landmark} etiket="Takipteki kağıt" deger={hepsi?.length ?? "–"} />
        <StatKart icon={Gavel} etiket="Kayıtlı ihale sonucu" deger={ihaleSayisi ?? "–"} />
        <StatKart icon={Database} etiket="Veri kaynağı" deger={<span className="text-sm">HMB · BIST BAP · TCMB</span>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <p className="mb-2 text-sm font-medium">Kağıt türü dağılımı</p>
            {dagilim.length > 0 ? (
              <DagilimGrafigi veri={dagilim} />
            ) : (
              <p className="text-sm text-muted-foreground">Veri yok.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="pt-6">
            <p className="mb-2 text-sm font-medium">Vadesi en yakın kağıtlar</p>
            {error && <p className="text-sm text-destructive">{error.message}</p>}
            {kagitlar && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ISIN</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Vade</TableHead>
                    <TableHead className="text-right">Getiri</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kagitlar.map((k) => (
                    <TableRow key={k.isin}>
                      <TableCell className="font-figures">{k.isin}</TableCell>
                      <TableCell>
                        <SenetBadge tanim={k.senet_tanimi} />
                      </TableCell>
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
    </div>
  );
}
