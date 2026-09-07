import Link from "next/link";
import { Star } from "lucide-react";
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
import { SenetBadge } from "@/components/senet-badge";
import { trTarihSirala } from "@/lib/tarih";
import { KaldirButonu } from "./kaldir-butonu";

export default async function IzlemeListesiPage() {
  const supabase = await createClient();

  const { data: watchlist, error } = await supabase.from("watchlist").select("isin");
  const isinler = watchlist?.map((w) => w.isin) ?? [];

  const { data: ozetHam } =
    isinler.length > 0
      ? await supabase
          .from("isin_ozet")
          .select("isin, senet_tanimi, vade_tarihi, bist_son_bilesik_getiri_pct, bist_son_temiz_fiyat")
          .in("isin", isinler)
      : { data: [] };

  const kagitlar = ozetHam ? trTarihSirala(ozetHam, (r) => r.vade_tarihi) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">İzleme Listesi</h1>
        <p className="text-sm text-muted-foreground">
          DİBS Detay sayfasında yıldıza tıklayarak eklediğin kağıtlar.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error.message}</p>}
          {kagitlar.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Star className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Henüz izlemeye aldığın bir kağıt yok.{" "}
                <Link href="/dashboard/dibs-detay" className="text-primary underline-offset-4 hover:underline">
                  DİBS Detay
                </Link>{" "}
                sayfasından ekleyebilirsin.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ISIN</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Vade</TableHead>
                  <TableHead className="text-right">Son Fiyat</TableHead>
                  <TableHead className="text-right">Son Getiri</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {kagitlar.map((k) => (
                  <TableRow key={k.isin}>
                    <TableCell className="font-figures">
                      <Link href={`/dashboard/dibs-detay?isin=${k.isin}`} className="hover:underline">
                        {k.isin}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <SenetBadge tanim={k.senet_tanimi} />
                    </TableCell>
                    <TableCell className="font-figures">{k.vade_tarihi}</TableCell>
                    <TableCell className="font-figures text-right">
                      {k.bist_son_temiz_fiyat != null ? Number(k.bist_son_temiz_fiyat).toFixed(3) : "–"}
                    </TableCell>
                    <TableCell className="font-figures text-right">
                      {k.bist_son_bilesik_getiri_pct != null
                        ? `%${Number(k.bist_son_bilesik_getiri_pct).toFixed(2)}`
                        : "–"}
                    </TableCell>
                    <TableCell>
                      <KaldirButonu isin={k.isin} />
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
