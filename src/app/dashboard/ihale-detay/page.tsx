import Link from "next/link";
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

function yuzde(v: number | string | null | undefined): string {
  if (v == null) return "–";
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? `%${n.toFixed(2)}` : "–";
}

export default async function IhaleDetayPage() {
  const supabase = await createClient();

  const [{ data: ihaleler, error }, { data: ozet }] = await Promise.all([
    supabase
      .from("ihale_sonuclari")
      .select(
        "isin, ihale_tarihi, ihrac_tipi, ort_yillik_bilesik_gerceklesme, toplam_gerceklesme_mn, toplam_oran_pct, bid_to_cover",
      ),
    supabase.from("isin_ozet").select("isin, senet_tanimi"),
  ]);

  const tipHaritasi = new Map((ozet ?? []).map((o) => [o.isin, o.senet_tanimi]));
  const siraliIhaleler = ihaleler
    ? trTarihSirala(ihaleler, (r) => r.ihale_tarihi).reverse()
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">İhale Detay</h1>
        <p className="text-sm text-muted-foreground">
          Gerçekleşen tüm Hazine ihalelerinin sonuçları -- en yeniden eskiye.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error.message}</p>}
          {siraliIhaleler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz ihale kaydı yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>ISIN</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>İhraç Tipi</TableHead>
                    <TableHead className="text-right">Ort. Faiz (Bileşik)</TableHead>
                    <TableHead className="text-right">Gerçekleşme (Mn TL)</TableHead>
                    <TableHead className="text-right">Talep Karşılama</TableHead>
                    <TableHead className="text-right">Bid-to-Cover</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siraliIhaleler.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-figures">{h.ihale_tarihi}</TableCell>
                      <TableCell className="font-figures">
                        <Link href={`/dashboard/dibs-detay?isin=${h.isin}`} className="hover:underline">
                          {h.isin}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <SenetBadge tanim={tipHaritasi.get(h.isin)} />
                      </TableCell>
                      <TableCell>{h.ihrac_tipi ?? "–"}</TableCell>
                      <TableCell className="font-figures text-right">
                        {yuzde(h.ort_yillik_bilesik_gerceklesme)}
                      </TableCell>
                      <TableCell className="font-figures text-right">
                        {h.toplam_gerceklesme_mn != null
                          ? Number(h.toplam_gerceklesme_mn).toLocaleString("tr-TR", { maximumFractionDigits: 0 })
                          : "–"}
                      </TableCell>
                      <TableCell className="font-figures text-right">{yuzde(h.toplam_oran_pct)}</TableCell>
                      <TableCell className="font-figures text-right">
                        {h.bid_to_cover != null ? Number(h.bid_to_cover).toFixed(2) : "–"}
                      </TableCell>
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
