import { BosDurum } from "@/components/bos-durum";
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

function ay1(v: number | null | undefined): string {
  return v == null ? "–" : `${v.toFixed(1)} ay`;
}

function pct2(v: number | null | undefined): string {
  return v == null ? "–" : `%${v.toFixed(2)}`;
}

function delta1(simdi: number | null | undefined, once: number | null | undefined, birim: string): string | null {
  if (simdi == null || once == null) return null;
  const d = simdi - once;
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)} ${birim}`;
}

export async function OrtalamaVadeMaliyetBolumu() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ortalama_vade_maliyet")
    .select("*")
    .order("yil")
    .order("ay");

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }
  if (!data || data.length === 0) {
    return <BosDurum baslik="Ortalama vade / maliyet verisi yok" aciklama="HMB'nin aylık ortalama vade ve maliyet yayını henüz aktarılmadı." />;
  }

  const son = data[data.length - 1];
  const onceki = data.length > 1 ? data[data.length - 2] : null;
  const son5Yil = [...data].slice(-60).reverse();

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <h2 className="text-lg font-semibold">{son.ay_etiketi} — İç Borçlanmanın Ortalama Vadesi / Maliyeti</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Sabit Getirili — Kümülatif Ort. Vade</p>
            <p className="font-figures text-xl font-semibold">{ay1(son.sabit_kumulatif_vade_ay)}</p>
            {onceki && (
              <p className="text-xs text-muted-foreground">
                {delta1(son.sabit_kumulatif_vade_ay, onceki.sabit_kumulatif_vade_ay, "ay")}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Sabit Getirili — Kümülatif Ort. Maliyet</p>
            <p className="font-figures text-xl font-semibold">{pct2(son.sabit_kumulatif_maliyet_pct)}</p>
            {onceki && (
              <p className="text-xs text-muted-foreground">
                {delta1(son.sabit_kumulatif_maliyet_pct, onceki.sabit_kumulatif_maliyet_pct, "puan")}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Nakit Borçlanma (Toplam) — Kümülatif Ort. Vade</p>
            <p className="font-figures text-xl font-semibold">{ay1(son.nakit_kumulatif_vade_ay)}</p>
            <p className="text-xs text-muted-foreground">Kuponsuz Senetler + Sabit Getirili&apos;nin toplamı</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Kaynak: HMB İç Borçlanmanın Ortalama Vadesi / Ortalama Maliyeti (aylık, Kuponsuz Senetler / Sabit Getirili /
          Nakit Borçlanma kırılımı, 2003&apos;ten günümüze).
        </p>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ay</TableHead>
                <TableHead className="text-right">Kuponsuz Vade</TableHead>
                <TableHead className="text-right">Sabit Getirili Vade</TableHead>
                <TableHead className="text-right">Nakit Borçlanma Vade</TableHead>
                <TableHead className="text-right">Kuponsuz Maliyet</TableHead>
                <TableHead className="text-right">Sabit Getirili Maliyet</TableHead>
                <TableHead className="text-right">Nakit Borçlanma Maliyet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {son5Yil.map((r) => (
                <TableRow key={`${r.yil}-${r.ay}`}>
                  <TableCell className="whitespace-nowrap">{r.ay_etiketi}</TableCell>
                  <TableCell className="font-figures text-right">{ay1(r.kuponsuz_kumulatif_vade_ay)}</TableCell>
                  <TableCell className="font-figures text-right">{ay1(r.sabit_kumulatif_vade_ay)}</TableCell>
                  <TableCell className="font-figures text-right">{ay1(r.nakit_kumulatif_vade_ay)}</TableCell>
                  <TableCell className="font-figures text-right">{pct2(r.kuponsuz_kumulatif_maliyet_pct)}</TableCell>
                  <TableCell className="font-figures text-right">{pct2(r.sabit_kumulatif_maliyet_pct)}</TableCell>
                  <TableCell className="font-figures text-right">{pct2(r.nakit_kumulatif_maliyet_pct)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Tüm değerler yıl içi KÜMÜLATİF ortalamadır (her Ocak&apos;ta sıfırlanır) — son 5 yıl (60 ay) gösteriliyor.
        </p>
      </CardContent>
    </Card>
  );
}
