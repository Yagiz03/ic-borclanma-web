import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { IzlemeCikarButonu } from "./izleme-cikar-butonu";
import { IzlemeGrafigi, type IzlemeSerisi } from "./izleme-grafigi";
import { sayi, yuzde } from "@/lib/bicim";
import { trTarihAyristir } from "@/lib/tarih";

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

  // İtfa olmuş kağıtlar ana listeden ve karşılaştırma grafiğinden çıkıyor --
  // artık işlem görmüyorlar. Yine de SESSİZCE yok sayılmıyorlar: kullanıcının
  // kendi eklediği kayıtlar, listeden çıkarabilsin diye altta ayrı bir
  // satırda toplanıyor.
  const bugunMs = new Date().getTime();
  const itfaOlduMu = (isin: string) => {
    const v = trTarihAyristir(ozetHarita.get(isin)?.vade_tarihi as string | null | undefined);
    return v != null && v.getTime() <= bugunMs;
  };
  const aktifIsinler = isinler.filter((i) => !itfaOlduMu(i));
  const itfaOlanlar = isinler.filter(itfaOlduMu);

  const seriler: IzlemeSerisi[] = aktifIsinler.map((isin) => ({
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
        {aktifIsinler.map((isin) => {
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
                      {sayi(fiyat, 3)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bileşik getiri</p>
                    <p className="font-figures text-lg font-semibold">
                      {yuzde(getiri)}
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

      {itfaOlanlar.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
          <span>İtfa olduğu için listeden düştü:</span>
          {itfaOlanlar.map((isin) => (
            <span key={isin} className="flex items-center gap-1">
              <b className="font-figures text-foreground">{isin}</b>
              <IzlemeCikarButonu isin={isin} />
            </span>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="space-y-3 pt-5">
          <h3 className="text-base font-semibold">Fiyat karşılaştırması</h3>
          <IzlemeGrafigi seriler={seriler} />
        </CardContent>
      </Card>
    </div>
  );
}
