"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

type Nokta = { tarih: string; deger: number };

export function FiyatGrafigi({
  veri,
  birim,
  renk = "var(--chart-1)",
  ondalik = 3,
}: {
  veri: Nokta[];
  birim: string;
  renk?: string;
  ondalik?: number;
}) {
  if (veri.length === 0) {
    return <p className="text-sm text-muted-foreground">Grafik için yeterli veri yok.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="tarih"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          // "MMM yy" biçiminde aynı ay birden çok kez etiketlenip tekrar
          // ediyordu (May 26, May 26, ...); gün de yazılınca her etiket benzersiz.
          tickFormatter={(v: string) =>
            new Date(v).toLocaleDateString("tr-TR", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
            })
          }
          minTickGap={48}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          domain={["auto", "auto"]}
          width={52}
          tickFormatter={(v) => Number(v).toFixed(ondalik === 3 ? 0 : 1)}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => (typeof v === "string" ? new Date(v).toLocaleDateString("tr-TR") : "")}
          formatter={(v) => [`${Number(v).toFixed(ondalik)} ${birim}`.trim(), ""]}
        />
        {/* Her nokta bir İŞLEM GÖRÜLEN gün: DİBS'ler hisse gibi her gün
            fiyatlanmadığı için noktalar tek tek işaretlenip çizgiyle
            birleştiriliyor (eski Streamlit sayfasındaki görünüm). */}
        <Line
          type="monotone"
          dataKey="deger"
          stroke={renk}
          strokeWidth={2}
          dot={{ r: 3, fill: renk, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
