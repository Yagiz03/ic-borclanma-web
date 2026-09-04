"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

const RENKLER = [
  "oklch(0.7 0.16 250)",
  "oklch(0.72 0.15 40)",
  "oklch(0.72 0.15 155)",
  "oklch(0.68 0.15 300)",
  "oklch(0.75 0.16 95)",
];

export function KarsilastirmaGrafigi({
  veri,
  isinler,
}: {
  veri: Record<string, string | number>[];
  isinler: string[];
}) {
  if (veri.length === 0) {
    return <p className="text-sm text-muted-foreground">Seçilen kağıtlar için ortak veri bulunamadı.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="tarih"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={(v: string) => new Date(v).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}
          minTickGap={24}
        />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={48} domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => (typeof v === "string" ? new Date(v).toLocaleDateString("tr-TR") : "")}
          formatter={(v, isim) => [`%${Number(v).toFixed(2)}`, isim]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {isinler.map((isin, i) => (
          <Line
            key={isin}
            type="monotone"
            dataKey={isin}
            stroke={RENKLER[i % RENKLER.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
