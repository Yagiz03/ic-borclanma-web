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
import { HeroBant } from "@/components/hero-bant";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";

function yuzde(v: number | string | null | undefined): string {
  if (v == null) return "–";
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? `%${n.toFixed(2)}` : "–";
}

export default async function OzelSektorPage() {
  const supabase = await createClient();

  // 1100 satır -- tek sorguda Supabase'in 1000 satır sınırını aşıyor.
  const { data: kagitlar, error } = await tumSatirlariGetir((from, to) =>
    supabase
      .from("menkul_kiymet_bilgileri")
      .select("*")
      .eq("ozel_sektor_mu", true)
      .order("ihracci_kurum", { ascending: true })
      .order("isin")
      .range(from, to),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Özel Sektör</h1>
        <p className="text-sm text-muted-foreground">
          Kurumsal (özel sektör) borçlanma araçları -- BIST&apos;in resmi &quot;İşlem Gören Borçlanma
          Araçlarına İlişkin Bilgiler&quot; listesindeki MK Türü&apos;ne göre sınıflandırılıyor.
        </p>
      </div>

      {kagitlar && kagitlar.length > 0 && (
        <HeroBant
          ustBaslik="ÖZEL SEKTÖR -- İŞLEM GÖREN BORÇLANMA ARAÇLARI"
          deger={String(kagitlar.length)}
          birim="kağıt"
          aciklama={`${new Set(kagitlar.map((k) => k.ihracci_kurum)).size} farklı ihraççı -- BIST Kesin Alım Satım Pazarı'nda o gün işlem görenler`}
          yanKartlar={[
            {
              etiket: "Toplam İhraç Tutarı",
              deger: `${(kagitlar.reduce((s, k) => s + (Number(k.toplam_ihrac_tutari_bin) || 0), 0) / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} Mlr TL`,
            },
            {
              etiket: "En Yaygın Tür",
              deger:
                [...kagitlar.reduce((m, k) => m.set(k.mk_turu ?? "–", (m.get(k.mk_turu ?? "–") ?? 0) + 1), new Map<string, number>())]
                  .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "–",
            },
          ]}
        />
      )}

      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {kagitlar && kagitlar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Veri yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>İhraççı</TableHead>
                    <TableHead>ISIN</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>İhraç Türü</TableHead>
                    <TableHead>Getiri Türü</TableHead>
                    <TableHead>İlk İhraç</TableHead>
                    <TableHead>İtfa</TableHead>
                    <TableHead className="text-right">Tutar (Bin TL)</TableHead>
                    <TableHead className="text-right">Son Getiri</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kagitlar?.map((k) => (
                    <TableRow key={k.isin}>
                      <TableCell className="max-w-48 truncate" title={k.ihracci_kurum ?? ""}>
                        {k.ihracci_kurum}
                      </TableCell>
                      <TableCell className="font-figures">{k.isin}</TableCell>
                      <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                        {k.mk_turu}
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                        {k.ihrac_turu}
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                        {k.getiri_turu}
                      </TableCell>
                      <TableCell className="font-figures">{k.ilk_ihrac_tarihi}</TableCell>
                      <TableCell className="font-figures">{k.itfa_tarihi}</TableCell>
                      <TableCell className="font-figures text-right">
                        {k.toplam_ihrac_tutari_bin != null
                          ? Number(k.toplam_ihrac_tutari_bin).toLocaleString("tr-TR", { maximumFractionDigits: 0 })
                          : "–"}
                      </TableCell>
                      <TableCell className="font-figures text-right">{yuzde(k.son_ihrac_getirisi_ham)}</TableCell>
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
