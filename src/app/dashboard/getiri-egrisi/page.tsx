import { egriVerisiniGetir } from "@/lib/egri-verisi";
import { GetiriEgrisiClient } from "./getiri-egrisi-client";

export default async function GetiriEgrisiPage() {
  const { hata, isinOzet, bist, tlrefSonPct } = await egriVerisiniGetir();

  if (hata) {
    return (
      <div className="w-full">
        <h1 className="text-2xl font-semibold">Getiri eğrisi</h1>
        <p className="mt-4 text-sm text-destructive">{hata}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Getiri eğrisi</h1>
        <p className="text-sm text-muted-foreground">
          Sabit getirili kağıtların (Hazine Bonosu, Sabit Kuponlu, Kuponsuz) BIST Kesin Alım Satım Pazarı
          bileşik getirisi, kalan vadeye göre.
        </p>
      </div>

      <GetiriEgrisiClient isinOzet={isinOzet} bist={bist} tlrefSonPct={tlrefSonPct} />
    </div>
  );
}
