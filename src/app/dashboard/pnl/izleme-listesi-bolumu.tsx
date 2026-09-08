import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { IzlemeCikarButonu } from "./izleme-cikar-butonu";
import { IzlemeGrafigi, type IzlemeSerisi } from "./izleme-grafigi";

// pages/izleme_listesi.py'nin karşılığı: izlenen kağıtların kartları
// (temiz fiyat / bileşik getiri / vade) + BIST fiyat karşılaştırma grafiği.
export async function IzlemeListesiBolumu() {
  const supabase = await createClient();

  const { data: watchlist } = await supabase
    .from("watchlist")
    .select("isin")
    .order("created_at", { ascending: true });

  const isinler = (watchlist ?? []).map((w) => w.isin as string);

  if (isinler.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        İzleme listen boş. <b className="text-foreground">DİBS Detay</b> sayfasında bir kağıt seçip
        başlığın yanındaki <b className="text-foreground">İzlemeye al</b> butonuna basarak izleme
        listene ekleyebilirsin.
      </p>
    );
  }

  const [{ data: ozetHam }, { data: bistHam }] = await Promise.all([
    supabase
      .from("isin_ozet")
      .select("isin, senet_tanimi, vade_tarihi, bist_son_temiz_fiyat, bist_son_bilesik_getiri_pct")
      .in("isin", isinler),
    supabase
      .from("bist_bap_fiyatlar")
      .select("isin, tarih, temiz_fiyat, kapanis_bilesik_getiri_pct")
      .in("isin", isinler)
      .order("tarih", { ascending: true }),
  ]);

  const ozetHarita = new Map((ozetHam ?? []).map((r) => [r.isin as string, r]));

  const seriler: IzlemeSerisi[] = isinler.map((isin) => ({
    isin,
    noktalar: (bistHam ?? [])
      .filter((r) => r.isin === isin)
      .map((r) => ({
        tarih: r.tarih as string,
        temizFiyat: r.temiz_fiyat != null ? Number(r.temiz_fiyat) : null,
        getiri: r.kapanis_bilesik_getiri_pct != null ? Number(r.kapanis_bilesik_getiri_pct) : null,
      })),
  }));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        DİBS Detay sayfasından izlemeye aldığın kağıtlar — son BIST kapanışına göre temiz fiyat ve
        bileşik getirileri, altında fiyat karşılaştırması.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isinler.map((isin) => {
          const r = ozetHarita.get(isin);
          const fiyat = r?.bist_son_temiz_fiyat != null ? Number(r.bist_son_temiz_fiyat) : null;
          const getiri =
            r?.bist_son_bilesik_getiri_pct != null ? Number(r.bist_son_bilesik_getiri_pct) : null;

          return (
            <Card key={isin}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{isin}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r?.senet_tanimi ?? "isin_ozet'te bulunamadı"}
                    </p>
                  </div>
                  <IzlemeCikarButonu isin={isin} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Temiz fiyat</p>
                    <p className="font-figures text-lg font-semibold">
                      {fiyat != null ? fiyat.toFixed(3) : "–"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bileşik getiri</p>
                    <p className="font-figures text-lg font-semibold">
                      {getiri != null ? `%${getiri.toFixed(2)}` : "–"}
                    </p>
                  </div>
                </div>

                {r?.vade_tarihi && (
                  <p className="text-xs text-muted-foreground">Vade: {r.vade_tarihi}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <h3 className="text-base font-semibold">Fiyat karşılaştırması</h3>
          <IzlemeGrafigi seriler={seriler} />
        </CardContent>
      </Card>
    </div>
  );
}
