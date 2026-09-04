import { redirect } from "next/navigation";
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

function sureFormatla(saniye: number | null): string {
  if (saniye == null) return "devam ediyor";
  if (saniye < 60) return `${Math.round(saniye)} sn`;
  return `${Math.round(saniye / 60)} dk`;
}

export default async function AnalitikPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: ziyaretler, error } = await supabase
    .from("page_views")
    .select("id, ad_soyad, email, yol, giris_zamani, cikis_zamani, sure_saniye")
    .order("giris_zamani", { ascending: false })
    .limit(200);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Ziyaret takibi</h1>
        <p className="text-muted-foreground text-sm">
          Kimin ne zaman hangi sayfada ne kadar kaldığı -- son 200 kayıt.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sayfa ziyaretleri</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-destructive text-sm">{error.message}</p>}
          {ziyaretler && ziyaretler.length === 0 && (
            <p className="text-muted-foreground text-sm">Henüz kayıt yok.</p>
          )}
          {ziyaretler && ziyaretler.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Sayfa</TableHead>
                  <TableHead>Giriş</TableHead>
                  <TableHead className="text-right">Süre</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ziyaretler.map((z) => (
                  <TableRow key={z.id}>
                    <TableCell>{z.ad_soyad}</TableCell>
                    <TableCell className="font-figures">{z.email}</TableCell>
                    <TableCell className="font-figures">{z.yol}</TableCell>
                    <TableCell className="font-figures">
                      {new Date(z.giris_zamani).toLocaleString("tr-TR")}
                    </TableCell>
                    <TableCell className="font-figures text-right">
                      {sureFormatla(z.sure_saniye)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
