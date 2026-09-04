"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

type Nokta = { tarih: string; deger: number };

export function FiyatGrafigi({ veri, birim }: { veri: Nokta[]; birim: string }) {
  if (veri.length === 0) {
    return <p className="text-sm text-muted-foreground">Grafik için yeterli veri yok.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="tarih"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={(v: string) => new Date(v).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          domain={["auto", "auto"]}
          width={48}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => (typeof v === "string" ? new Date(v).toLocaleDateString("tr-TR") : "")}
          formatter={(v) => [`${Number(v).toFixed(3)} ${birim}`, ""]}
        />
        <Line type="monotone" dataKey="deger" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
