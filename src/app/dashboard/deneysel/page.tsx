import { egriVerisiniGetir } from "@/lib/egri-verisi";
import { DeneyselClient } from "./deneysel-client";

export default async function DeneyselPage() {
  const { hata, isinOzet, bist, tlrefSonPct } = await egriVerisiniGetir();

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
        <DeneyselClient isinOzet={isinOzet} bist={bistYalin} tlrefSonPct={tlrefSonPct} />
      )}
    </div>
  );
}
