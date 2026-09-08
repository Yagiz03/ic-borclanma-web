"use client";

import { useMemo, useState } from "react";
import { YuzdeAlanGrafigi } from "./coklu-cizgi-grafigi";
import { TIP_KISA } from "@/lib/isin-tip";
import type { AylikKumulatif } from "@/lib/outstanding-ledger";
import { kullanilanTipler } from "@/lib/outstanding-ledger";

function ayFmt(ay: string): string {
  const [yil, ayNo] = ay.split("-").map(Number);
  return new Date(Date.UTC(yil, ayNo - 1, 1)).toLocaleDateString("tr-TR", { month: "short", year: "numeric" });
}

export function KagitTipiDagilimiClient({
  ledger,
  kapsamNotu,
}: {
  ledger: AylikKumulatif[];
  kapsamNotu: string;
}) {
  const [tumGecmis, setTumGecmis] = useState(false);
  const [gorunum, setGorunum] = useState<"alan" | "isi">("alan");

  const dilim = useMemo(() => {
    if (tumGecmis) return ledger;
    const bugun = new Date();
    const esikYil = bugun.getUTCFullYear() - 5;
    const esikAy = bugun.getUTCMonth() + 1;
    const esik = `${esikYil}-${String(esikAy).padStart(2, "0")}`;
    return ledger.filter((r) => r.ay >= esik);
  }, [ledger, tumGecmis]);

  const tipler = useMemo(() => kullanilanTipler(dilim), [dilim]);

  const alanVerisi = useMemo(
    () =>
      dilim.map((r) => {
        const satir: Record<string, string | number> = { ay: r.ay };
        for (const tip of tipler) {
          satir[tip] = r.ayToplam > 0 ? (r.degerler[tip] / r.ayToplam) * 100 : 0;
        }
        return satir;
      }),
    [dilim, tipler],
  );

  if (dilim.length === 0) {
    return <p className="text-sm text-muted-foreground">Seçili aralıkta veri yok.</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Kağıt tipine göre outstanding stok dağılımı</h3>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={tumGecmis}
            onChange={(e) => setTumGecmis(e.target.checked)}
            className="size-4 rounded border-border"
          />
          Tüm geçmişi göster (2006&apos;dan itibaren)
        </label>
        <div className="flex overflow-hidden rounded-md border border-border text-sm">
          <button
            type="button"
            onClick={() => setGorunum("isi")}
            className={`px-3 py-1.5 ${gorunum === "isi" ? "bg-primary text-primary-foreground" : "bg-transparent"}`}
          >
            Isı haritası
          </button>
          <button
            type="button"
            onClick={() => setGorunum("alan")}
            className={`px-3 py-1.5 ${gorunum === "alan" ? "bg-primary text-primary-foreground" : "bg-transparent"}`}
          >
            Alan grafiği
          </button>
        </div>
      </div>

      {gorunum === "alan" ? (
        <YuzdeAlanGrafigi
          veri={alanVerisi}
          seriler={tipler.map((t) => ({ anahtar: t, etiket: TIP_KISA[t] ?? t }))}
        />
      ) : (
        <div className="max-h-[520px] overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                <th className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">Ay</th>
                {tipler.map((t) => (
                  <th key={t} className="whitespace-nowrap px-2 py-1.5 text-right font-medium text-muted-foreground">
                    {TIP_KISA[t] ?? t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dilim.map((r) => (
                <tr key={r.ay}>
                  <td className="whitespace-nowrap px-2 py-1 font-figures">{ayFmt(r.ay)}</td>
                  {tipler.map((t) => {
                    const pct = r.ayToplam > 0 ? (r.degerler[t] / r.ayToplam) * 100 : 0;
                    const alpha = Math.min(1, Math.max(0, pct / 100));
                    return (
                      <td
                        key={t}
                        className="whitespace-nowrap px-2 py-1 text-right font-figures"
                        style={{
                          backgroundColor: `oklch(0.6 0.19 25 / ${alpha})`,
                          color: pct > 45 ? "white" : "inherit",
                        }}
                      >
                        {pct.toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        TCMB&apos;nin &quot;İhale Yöntemi ile Satılan Hazine Bonoları ve Devlet Tahvilleri&quot; istatistiğinden
        kurulan bir ihraç/itfa defterinden — her ihracın NOMİNAL tutarı ihraç ayında eklenip, o ISIN&apos;in TÜM
        tutarı vade ayında tamamen düşülüyor (bullet itfa). Bu GERÇEK OUTSTANDING&apos;dir (itfa olanlar kalıcı
        olarak düşer), aylık ihraç akışı değildir. {kapsamNotu}%100&apos;e tam ulaşmayabilir çünkü Doğrudan Satış
        (Kira Sertifikası/FX DİBS/Altın Tahvili) kanalı ve 2006 öncesi ihraç edilip hâlâ vadesi gelmemiş kağıtlar
        bu deftere dahil değil.
      </p>
    </div>
  );
}
