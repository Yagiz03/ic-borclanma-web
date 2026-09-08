"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type IzlemeSerisi = {
  isin: string;
  noktalar: { tarih: string; temizFiyat: number | null; getiri: number | null }[];
};

const RENKLER = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type Metrik = "fiyat" | "getiri";

export function IzlemeGrafigi({ seriler }: { seriler: IzlemeSerisi[] }) {
  const [metrik, setMetrik] = useState<Metrik>("fiyat");
  const [normalize, setNormalize] = useState(false);

  const { veri, isinler } = useMemo(() => {
    const alan = metrik === "fiyat" ? "temizFiyat" : "getiri";
    const ilkDeger = new Map<string, number>();
    const tarihHarita = new Map<string, Record<string, number | string>>();
    const kullanilan: string[] = [];

    for (const s of seriler) {
      const gecerli = s.noktalar.filter((n) => n[alan] != null);
      if (gecerli.length === 0) continue;
      kullanilan.push(s.isin);
      ilkDeger.set(s.isin, gecerli[0][alan] as number);

      for (const n of gecerli) {
        let satir = tarihHarita.get(n.tarih);
        if (!satir) {
          satir = { tarih: n.tarih };
          tarihHarita.set(n.tarih, satir);
        }
        const ham = n[alan] as number;
        const taban = ilkDeger.get(s.isin)!;
        satir[s.isin] = normalize && taban !== 0 ? (ham / taban - 1) * 100 : ham;
      }
    }

    return {
      veri: [...tarihHarita.values()].sort((a, b) => String(a.tarih).localeCompare(String(b.tarih))),
      isinler: kullanilan,
    };
  }, [seriler, metrik, normalize]);

  if (isinler.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        İzleme listendeki ISIN&apos;ler için BIST fiyat verisi bulunamadı.
      </p>
    );
  }

  const yBaslik = normalize
    ? "Değişim (%, ilk güne göre)"
    : metrik === "fiyat"
      ? "Temiz fiyat"
      : "Bileşik getiri (%)";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {(
            [
              ["fiyat", "Temiz fiyat"],
              ["getiri", "Bileşik getiri"],
            ] as const
          ).map(([deger, etiket]) => (
            <button
              key={deger}
              onClick={() => setMetrik(deger)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                metrik === deger
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {etiket}
            </button>
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={normalize}
            onChange={(e) => setNormalize(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          İlk ortak güne göre normalize et (%)
        </label>
      </div>

      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={veri} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="tarih" tick={{ fontSize: 11 }} minTickGap={40} />
            <YAxis
              tick={{ fontSize: 11 }}
              width={64}
              domain={["dataMin - 0.5", "dataMax + 0.5"]}
              tickFormatter={(v) => Number(v).toFixed(2)}
            />
            <Tooltip
              formatter={(v) => Number(v).toFixed(3)}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {isinler.map((isin, i) => (
              <Line
                key={isin}
                type="monotone"
                dataKey={isin}
                stroke={RENKLER[i % RENKLER.length]}
                dot={false}
                strokeWidth={2}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">{yBaslik}</p>
    </div>
  );
}
