import { egriVerisiniGetir } from "@/lib/egri-verisi";
import { createClient } from "@/lib/supabase/server";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";
import type { KonsesyonIhale, KonsesyonOlay } from "@/lib/konsesyon";
import { DeneyselClient } from "./deneysel-client";

export default async function DeneyselPage() {
  const { hata, isinOzet, bist, tlrefSonPct } = await egriVerisiniGetir();

  // Konsesyon analizi gece pipeline'inda hesaplaniyor (Nelson-Siegel fit'i
  // ~1600 gun -- tarayicida yapilamaz); burada yalnizca okunuyor.
  // konsesyon_olay 1000 satiri astigi icin sayfalanarak cekiliyor.
  const supabase = await createClient();
  const [{ data: konsesyonOlaylar }, { data: konsesyonIhaleler }] = await Promise.all([
    tumSatirlariGetir<KonsesyonOlay>((bas, son) =>
      supabase
        .from("konsesyon_olay")
        .select("isin, ihale_dt, offset, spread_bps")
        .order("isin")
        .order("ihale_dt")
        .order("offset")
        .range(bas, son),
    ),
    tumSatirlariGetir<KonsesyonIhale>((bas, son) =>
      supabase
        .from("konsesyon_ihale")
        .select("isin, ihale_tarihi, senet_tanimi, spread_once, spread_sonra, degisim_bps, tail_bps, bid_to_cover")
        .order("ihale_tarihi")
        .range(bas, son),
    ),
  ]);

  // Ortak sorgu süper küme döndürüyor; bu sayfanın iki ekranı da temiz fiyata
  // BAKMIYOR (yalnız getiri + hacim). Sütunu istemciye göndermemek HTML yükünü
  // ~200 KB azaltıyor -- ortak önbellek uğruna sayfa şişmesin.
  const bistYalin = bist.map((r) => ({
    tarih: r.tarih,
    isin: r.isin,
    kapanis_bilesik_getiri_pct: r.kapanis_bilesik_getiri_pct,
    islem_hacmi_tl: r.islem_hacmi_tl,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Deneysel</h1>
        <p className="text-sm text-muted-foreground">
          Bu sayfadaki analizler DENEME aşamasında — metodoloji/sonuçlar değişebilir, yatırım
          kararına tek başına dayanak yapılmamalı. Olgunlaşan bölümler asıl sayfalara taşınır.
        </p>
      </div>

      {hata ? (
        <p className="text-sm text-destructive">{hata}</p>
      ) : (
        <DeneyselClient
          isinOzet={isinOzet}
          bist={bistYalin}
          tlrefSonPct={tlrefSonPct}
          konsesyonOlaylar={konsesyonOlaylar ?? []}
          konsesyonIhaleler={konsesyonIhaleler ?? []}
        />
      )}
    </div>
  );
}
