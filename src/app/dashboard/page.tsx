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
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/giris");
  }

  // Faz 0 kanıtı: auth + gerçek Supabase verisi aynı sayfada uçtan uca.
  const { data: kagitlar, error } = await supabase
    .from("isin_ozet")
    .select("isin, senet_tanimi, vade_tarihi, bist_son_bilesik_getiri_pct")
    .order("vade_tarihi", { ascending: true })
    .limit(10);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">İç Borçlanma Dashboard</h1>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </div>
        <SignOutButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Örnek veri -- isin_ozet</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-destructive text-sm">{error.message}</p>}
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
    </main>
  );
}
