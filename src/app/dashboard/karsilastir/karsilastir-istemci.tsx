"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OzetSerit } from "@/components/ozet-serit";
import {
  ZamanAraligiSecici,
  zamanaGoreSuz,
  type ZamanAraligi,
} from "@/components/zaman-araligi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KarsilastirmaGrafigi, SpreadGrafigi } from "./karsilastirma-grafigi";
import { IsinCokSecici } from "./isin-cok-secici";

export type KagitBilgi = {
  isin: string;
  senetTanimi: string;
  vade: string;
  paraBirimi: string;
  bistVeriVarMi: boolean;
  bistSonTarih: string | null;
};

export type GetiriNoktasi = {
  isin: string;
  tarih: string;
  getiri: number | null;
  temizFiyat: number | null;
};

const ARALIKLAR: ZamanAraligi[] = ["3a", "6a", "ytd", "1y", "tum"];

const bps = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)} bps`;

export function KarsilastirIstemci({
  kagitlar,
  secililer,
  seriler,
  azamiSecim,
}: {
  kagitlar: KagitBilgi[];
  secililer: string[];
  seriler: GetiriNoktasi[];
  azamiSecim: number;
}) {
  const router = useRouter();
  const [aralik, setAralik] = useState<ZamanAraligi>("1y");
  const [normalize, setNormalize] = useState(false);
  const [referans, setReferans] = useState<string>(secililer[0] ?? "");

  const bilgiHarita = useMemo(
    () => new Map(kagitlar.map((k) => [k.isin, k])),
    [kagitlar],
  );

  // ISIN -> zamanla süzülmüş, getirisi olan noktalar (tarihe göre artan).
  const isinSerileri = useMemo(() => {
    const m = new Map<string, { tarih: string; getiri: number }[]>();
    for (const isin of secililer) m.set(isin, []);
    for (const r of zamanaGoreSuz(seriler, aralik)) {
      if (r.getiri == null) continue;
      m.get(r.isin)?.push({ tarih: r.tarih, getiri: r.getiri });
    }
    for (const dizi of m.values()) dizi.sort((a, b) => a.tarih.localeCompare(b.tarih));
    return m;
  }, [seriler, secililer, aralik]);

  // Seçilip de grafikte yer alamayan kağıtlar, SEBEBİYLE birlikte ayrılıyor:
  // hiç işlem görmemiş olmakla, bileşik getirisi hesaplanamayan bir floater
  // olmak farklı şeyler ve kullanıcıya farklı şey söylemeli.
  const { fiyatiYok, getirisiYok } = useMemo(() => {
    const fy: string[] = [];
    const gy: string[] = [];
    for (const isin of secililer) {
      if ((isinSerileri.get(isin) ?? []).length > 0) continue;
      const hicSatirVarMi = seriler.some((r) => r.isin === isin);
      (hicSatirVarMi ? gy : fy).push(isin);
    }
    return { fiyatiYok: fy, getirisiYok: gy };
  }, [secililer, isinSerileri, seriler]);

  const cizilenler = useMemo(
    () => secililer.filter((i) => (isinSerileri.get(i) ?? []).length > 0),
    [secililer, isinSerileri],
  );

  // Ana grafik verisi: tarih ekseninde birleştirilmiş, istenirse ilk ortak
  // güne göre yüzde değişime çevrilmiş seriler.
  const grafikVerisi = useMemo(() => {
    const tarihler = Array.from(
      new Set(cizilenler.flatMap((i) => (isinSerileri.get(i) ?? []).map((r) => r.tarih))),
    ).sort();
    const ilkDeger = new Map(
      cizilenler.map((i) => [i, (isinSerileri.get(i) ?? [])[0]?.getiri ?? null]),
    );
    const haritalar = new Map(
      cizilenler.map((i) => [i, new Map((isinSerileri.get(i) ?? []).map((r) => [r.tarih, r.getiri]))]),
    );
    return tarihler.map((tarih) => {
      const satir: Record<string, string | number> = { tarih };
      for (const isin of cizilenler) {
        const v = haritalar.get(isin)!.get(tarih);
        if (v == null) continue;
        const bas = ilkDeger.get(isin);
        satir[isin] = normalize && bas ? (v / bas - 1) * 100 : v;
      }
      return satir;
    });
  }, [cizilenler, isinSerileri, normalize]);

  // Spread: referansa göre AYNI GÜNLÜ getiri farkı (bps).
  const spreadVerisi = useMemo(() => {
    const ref = isinSerileri.get(referans);
    if (!ref?.length) return [];
    const refHarita = new Map(ref.map((r) => [r.tarih, r.getiri]));
    const digerleri = cizilenler.filter((i) => i !== referans);
    if (!digerleri.length) return [];
    return ref
      .map((r) => {
        const satir: Record<string, string | number> = { tarih: r.tarih };
        for (const isin of digerleri) {
          const v = (isinSerileri.get(isin) ?? []).find((x) => x.tarih === r.tarih)?.getiri;
          if (v != null) satir[isin] = (v - refHarita.get(r.tarih)!) * 100;
        }
        return satir;
      })
      .filter((s) => Object.keys(s).length > 1);
  }, [isinSerileri, referans, cizilenler]);

  // Farklı para birimlerinin bileşik getirisi kıyaslanamaz (TL ~%40,
  // döviz/altın ~%1-10) -- karışık seçimde uyar.
  const paraBirimiGruplari = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const isin of secililer) {
      const pb = bilgiHarita.get(isin)?.paraBirimi ?? "TRY";
      g.set(pb, [...(g.get(pb) ?? []), isin]);
    }
    return g;
  }, [secililer, bilgiHarita]);

  // Karşılaştırma özeti: her kağıt için dönem başı/sonu, değişim, min/max.
  const ozetSatirlari = useMemo(
    () =>
      cizilenler.map((isin) => {
        const s = isinSerileri.get(isin)!;
        const ilk = s[0].getiri;
        const son = s[s.length - 1].getiri;
        const degerler = s.map((r) => r.getiri);
        const refSon = referans && referans !== isin ? isinSerileri.get(referans)?.slice(-1)[0]?.getiri : null;
        return {
          isin,
          tanim: bilgiHarita.get(isin)?.senetTanimi ?? "",
          vade: bilgiHarita.get(isin)?.vade ?? "",
          ilk,
          son,
          degisimBps: (son - ilk) * 100,
          enDusuk: Math.min(...degerler),
          enYuksek: Math.max(...degerler),
          spreadBps: refSon != null ? (son - refSon) * 100 : null,
          gunSayisi: s.length,
        };
      }),
    [cizilenler, isinSerileri, referans, bilgiHarita],
  );

  function secimDegistir(yeni: string[]) {
    router.push(`/dashboard/dibs-detay?isinler=${yeni.join(",")}&tab=karsilastir`);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-muted-foreground">
            Birden fazla kağıdın BIST bileşik getirisini aynı grafikte karşılaştır (en fazla{" "}
            {azamiSecim} kağıt). İtfa olmuş kağıtlar listede yok.
          </p>
          <IsinCokSecici
            secililer={secililer}
            azamiSecim={azamiSecim}
            onDegisim={secimDegistir}
            secenekler={kagitlar.map((k) => ({
              isin: k.isin,
              etiket: k.senetTanimi,
              bistVeriVarMi: k.bistVeriVarMi,
            }))}
          />
        </CardContent>
      </Card>

      {secililer.length === 0 ? (
        <p className="text-sm text-muted-foreground">En az bir kağıt seç.</p>
      ) : (
        <>
          {paraBirimiGruplari.size > 1 && (
            <div className="flex gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                Seçilenler birden fazla para birimi/emtia içeriyor — bileşik getiri seviyeleri
                (TL kağıtlarda ~%20-40, döviz/altın cinsi kağıtlarda ~%1-10){" "}
                <b>kıyaslanamaz</b>, aynı grafikte gösterilse bile.
                <div className="font-figures mt-1 text-xs">
                  {[...paraBirimiGruplari].map(([pb, liste]) => `${pb}: ${liste.join(", ")}`).join(" · ")}
                </div>
              </div>
            </div>
          )}

          {(fiyatiYok.length > 0 || getirisiYok.length > 0) && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {fiyatiYok.length > 0 && (
                <p>
                  Seçilen aralıkta BIST ikincil piyasa verisi olmadığı için grafikte yok:{" "}
                  <b className="font-figures">{fiyatiYok.join(", ")}</b> — muhtemelen henüz işlem
                  görmemiş ya da çok yeni ihraç edilmiş bir kağıt.
                </p>
              )}
              {getirisiYok.length > 0 && (
                <p>
                  Bileşik getirisi hesaplanamadığı için grafikte yok:{" "}
                  <b className="font-figures">{getirisiYok.join(", ")}</b> — muhtemelen TLREF&apos;e/
                  TÜFE&apos;ye endeksli ya da değişken faizli bir kağıt; bu tür kağıtlarda getiri
                  referans orana göre spread mantığıyla hesaplanıyor (bkz. Bono ve Getiri
                  Hesaplayıcı).
                </p>
              )}
            </div>
          )}

          {cizilenler.length > 0 && (
            <>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={normalize}
                      onChange={(e) => setNormalize(e.target.checked)}
                      className="accent-primary"
                    />
                    İlk ortak güne göre normalize et (%)
                  </label>
                  <ZamanAraligiSecici deger={aralik} onChange={setAralik} secenekler={ARALIKLAR} />
                </div>
                <KarsilastirmaGrafigi
                  veri={grafikVerisi}
                  isinler={cizilenler}
                  normalize={normalize}
                />
              </div>

              <OzetSerit
                alanlar={ozetSatirlari.slice(0, 5).map((r) => ({
                  etiket: r.isin,
                  deger: `%${r.son.toFixed(2)}`,
                  altBilgi: `Dönem değişimi ${bps(r.degisimBps)}`,
                }))}
              />

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Karşılaştırma özeti</h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ISIN</TableHead>
                        <TableHead>Tip</TableHead>
                        <TableHead>Vade</TableHead>
                        <TableHead className="text-right">Dönem başı</TableHead>
                        <TableHead className="text-right">Son</TableHead>
                        <TableHead className="text-right">Değişim</TableHead>
                        <TableHead className="text-right">En düşük</TableHead>
                        <TableHead className="text-right">En yüksek</TableHead>
                        <TableHead className="text-right">Referansa spread</TableHead>
                        <TableHead className="text-right">Gün</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ozetSatirlari.map((r) => (
                        <TableRow key={r.isin}>
                          <TableCell className="font-figures font-medium">{r.isin}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.tanim}</TableCell>
                          <TableCell className="font-figures">{r.vade}</TableCell>
                          <TableCell className="font-figures text-right">%{r.ilk.toFixed(2)}</TableCell>
                          <TableCell className="font-figures text-right">%{r.son.toFixed(2)}</TableCell>
                          <TableCell
                            className={`font-figures text-right ${r.degisimBps >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                          >
                            {bps(r.degisimBps)}
                          </TableCell>
                          <TableCell className="font-figures text-right">%{r.enDusuk.toFixed(2)}</TableCell>
                          <TableCell className="font-figures text-right">%{r.enYuksek.toFixed(2)}</TableCell>
                          <TableCell className="font-figures text-right">
                            {r.spreadBps == null ? "—" : bps(r.spreadBps)}
                          </TableCell>
                          <TableCell className="font-figures text-right">{r.gunSayisi}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {cizilenler.length >= 2 && (
                <div className="space-y-2 border-t border-border pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Spread (getiri farkı)</h3>
                      <p className="text-xs text-muted-foreground">
                        Seçilenlerin bileşik getirisinin referans kağıda göre farkı. Sıfırın üstü:
                        o kağıt referanstan daha yüksek getiriyle (daha ucuz) işlem görüyor.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Referans</span>
                      <select
                        value={referans}
                        onChange={(e) => setReferans(e.target.value)}
                        className="font-figures h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {cizilenler.map((i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {spreadVerisi.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Referans kağıtla diğerlerinin ortak (aynı günlü) getiri verisi bulunamadı.
                    </p>
                  ) : (
                    <SpreadGrafigi
                      veri={spreadVerisi}
                      isinler={cizilenler.filter((i) => i !== referans)}
                      referans={referans}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
