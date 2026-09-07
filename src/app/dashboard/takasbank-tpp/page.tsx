import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { TppClient } from "./tpp-client";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";

export default async function TakasbankTppPage() {
  const supabase = await createClient();
  // 1858 satır -- tek sorguda Supabase'in 1000 satır sınırını aşıyor.
  const { data, error } = await tumSatirlariGetir((from, to) =>
    supabase
      .from("takasbank_tpp")
      .select("tarih, vade_gun, min_oran, maks_oran, ort_oran, islem_hacmi_tl, islem_hacmi_usd, islem_sayisi")
      .order("tarih")
      .order("vade_gun")
      .range(from, to),
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Takasbank Para Piyasası (TPP)</h1>
        <p className="text-sm text-muted-foreground">
          Takasbank TPP İşlem Ortalamaları Raporu -- her gün O/N (gecelik) ile 183 güne kadar vadeli TPP
          işlemlerinin gün içi min/maks/ortalama oranı ve hacmi. TL fonlama piyasasının kısa vade faiz eğrisi
          olarak okunabilir.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <TppClient veri={data ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
