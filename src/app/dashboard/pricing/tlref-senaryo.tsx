"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { tlrefKirliPatika } from "@/lib/takas-repo";
import { kuponDonemleri } from "@/lib/bond-math/floater";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const trTarih = (d: Date) => d.toLocaleDateString("tr-TR", { timeZone: "UTC" });
const trIso = (s: string) =>
  new Date(`${s}T00:00:00Z`).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

/**
 * "Senaryo analizi: PPK sonrası TLREF" -- pages/pricing.py'deki
 * _tlref_senaryo_analizi'nin karşılığı.
 *
 * Ufuk BİR SONRAKİ KUPON GÜNÜ (gün girdisi yok). Patika bugüne kadar
 * GERÇEKLEŞEN birikmiş kupondan başlar; PPK kararına kadar bu birikimin ima
 * ettiği ortalama oranla, karar ertesinden itibaren kullanıcının girdiği
 * senaryo oranıyla ilerler.
 */
export function TlrefSenaryoAnalizi({
  temizFiyat,
  birikmisPct,
  gozlemBas,
  gozlemSimdi,
  endeksBas,
  endeksSimdi,
  guncelTlrefPct,
  ilkIhrac,
  vade,
  valor,
  periyotGun,
  ekGetiri,
  ppkGunleri,
}: {
  temizFiyat: number;
  birikmisPct: number;
  gozlemBas: Date;
  gozlemSimdi: Date;
  endeksBas: number;
  endeksSimdi: number;
  guncelTlrefPct: number;
  ilkIhrac: Date;
  vade: Date;
  valor: Date;
  periyotGun: number;
  ekGetiri: number;
  /** Ufuk içindeki PPK karar günleri (ISO). */
  ppkGunleri: string[];
}) {
  const sonrakiKupon = useMemo(
    () => kuponDonemleri(ilkIhrac, vade, periyotGun).find((t) => t > valor) ?? null,
    [ilkIhrac, vade, periyotGun, valor],
  );

  // PPK'ya kadar geçerli oran: dönemde bugüne kadar FİİLEN gerçekleşen endeks
  // büyümesinin günlük ortalamasından basit yıllıklandırma -- birikmiş neyle
  // biriktiyse aynı hızla devam eder.
  const oranBaslangic = useMemo(() => {
    const nGozlem = Math.round((gozlemSimdi.getTime() - gozlemBas.getTime()) / 86_400_000);
    if (nGozlem <= 0) return guncelTlrefPct;
    return (Math.pow(endeksSimdi / endeksBas, 1 / nGozlem) - 1) * 365 * 100;
  }, [gozlemBas, gozlemSimdi, endeksBas, endeksSimdi, guncelTlrefPct]);

  const ufukIciPpk = useMemo(
    () =>
      sonrakiKupon
        ? ppkGunleri
            .filter((t) => {
              const d = new Date(`${t}T00:00:00Z`);
              return d > valor && d <= sonrakiKupon;
            })
            .sort()
        : [],
    [ppkGunleri, valor, sonrakiKupon],
  );

  const [senaryoOranlari, setSenaryoOranlari] = useState<Record<string, string>>({});
  const oranMetni = (t: string) => senaryoOranlari[t] ?? oranBaslangic.toFixed(2);

  const sonuc = useMemo(() => {
    if (!sonrakiKupon) return null;
    const ufuk = Math.round((sonrakiKupon.getTime() - valor.getTime()) / 86_400_000);
    if (ufuk <= 0) return null;

    const donemler = [{ baslangic: valor, oran: oranBaslangic / 100 }];
    for (const t of ufukIciPpk) {
      const deger = Number((senaryoOranlari[t] ?? oranBaslangic.toFixed(2)).replace(",", "."));
      if (!Number.isFinite(deger)) continue;
      const ertesiGun = new Date(`${t}T00:00:00Z`);
      ertesiGun.setUTCDate(ertesiGun.getUTCDate() + 1);
      donemler.push({ baslangic: ertesiGun, oran: deger / 100 });
    }

    const { patika, odemeler } = tlrefKirliPatika(
      temizFiyat, birikmisPct, ufuk, donemler, [sonrakiKupon], ekGetiri, valor,
    );

    // Grafik ÖDENECEK KUPONUN birikim patikasını gösteriyor: birikmiş kupon
    // = kirli − temiz; kupon gününde fiilen ödenecek tutarda biter.
    const kuponIso = sonrakiKupon.toISOString().slice(0, 10);
    const odenecek = odemeler.get(kuponIso) ?? null;
    const seri = [...patika.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tarih, kirli]) => ({
        tarih,
        birikmis: tarih === kuponIso && odenecek != null ? odenecek : kirli - temizFiyat,
      }));

    return { ufuk, seri, odenecek, kuponIso };
  }, [sonrakiKupon, valor, oranBaslangic, ufukIciPpk, senaryoOranlari, temizFiyat, birikmisPct, ekGetiri]);

  if (!sonrakiKupon) {
    return (
      <p className="text-sm text-muted-foreground">
        Sonraki kupon tarihi bulunamadı — senaryo çizilemiyor.
      </p>
    );
  }

  return (
    <div className="space-y-4 border-t border-border pt-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Senaryo analizi: PPK sonrası TLREF</h3>
        <p className="text-xs text-muted-foreground">
          Ufuk: bir sonraki kupon ödeme günü <b>{trTarih(sonrakiKupon)}</b> ({sonuc?.ufuk ?? 0} gün).
          Patika, bugüne kadar GERÇEKLEŞEN birikmiş kupondan (%{birikmisPct.toFixed(4)}) başlar ve
          PPK kararına kadar bu birikimin ima ettiği ortalama oranla (basit{" "}
          <b>%{oranBaslangic.toFixed(2)}</b>) ilerletilir; karar ertesinden itibaren aşağıdaki
          senaryo oranı geçerli olur.
        </p>
      </div>

      {ufukIciPpk.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Seçilen ufukta PPK toplantısı yok — birikim, gerçekleşen ortalama oranla kupon gününe
          kadar sabit ilerletilir.
        </p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {ufukIciPpk.map((t) => (
            <div key={t} className="space-y-1.5">
              <Label htmlFor={`ppk-${t}`} className="text-xs">
                {trIso(t)} PPK sonrası TLREF (basit, %)
              </Label>
              <Input
                id={`ppk-${t}`}
                inputMode="decimal"
                value={oranMetni(t)}
                onChange={(e) => setSenaryoOranlari((o) => ({ ...o, [t]: e.target.value }))}
                className="w-36 font-figures"
              />
            </div>
          ))}
        </div>
      )}

      {sonuc && (
        <>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={sonuc.seri} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="tarih"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={trIso}
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                width={56}
                tickFormatter={(v) => `%${Number(v).toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v) => (typeof v === "string" ? trIso(v) : "")}
                formatter={(v) => [`%${Number(v).toFixed(4)}`, "Birikmiş kupon"]}
              />
              {ufukIciPpk.map((t) => (
                <ReferenceLine key={t} x={t} stroke="var(--chart-4)" strokeDasharray="3 3" />
              ))}
              <ReferenceLine x={sonuc.kuponIso} stroke="#34D399" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="birikmis"
                stroke="var(--chart-1)"
                fill="var(--chart-1)"
                fillOpacity={0.18}
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          {sonuc.odenecek != null && (
            <p className="text-xs text-muted-foreground">
              Senaryoya göre <b>{trTarih(sonrakiKupon)}</b> günü ödenecek kupon:{" "}
              <b className="font-figures">%{sonuc.odenecek.toFixed(4)}</b> (bugüne kadar gerçekleşen
              %{birikmisPct.toFixed(4)} + senaryo oranıyla işleyecek kalan kısım
              {ekGetiri ? ` + dönemsel ek getiri %${ekGetiri.toFixed(2)}` : ""}).
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Turuncu noktalı çizgiler PPK kararları (oran ertesi gün değişir), yeşil çizgi kupon
            ödeme günü. Birikmiş kupon, (100 + birikmiş) tabanı üzerinden senaryo TLREF oranıyla iş
            günü bloklarında işler.
          </p>
        </>
      )}
    </div>
  );
}
