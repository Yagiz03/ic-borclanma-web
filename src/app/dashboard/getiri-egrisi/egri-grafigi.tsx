"use client";

import { ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Scatter, ScatterChart, ZAxis } from "recharts";

type Nokta = { isin: string; kalanVadeYil: number; getiri: number };

export function EgriGrafigi({ veri }: { veri: Nokta[] }) {
  if (veri.length < 2) {
    return <p className="text-sm text-muted-foreground">Eğri çizmek için yeterli veri yok.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="kalanVadeYil"
          name="Kalan vade"
          unit=" yıl"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          label={{ value: "Kalan vade (yıl)", position: "insideBottom", offset: -4, fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          type="number"
          dataKey="getiri"
          name="Bileşik getiri"
          unit="%"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          width={48}
          domain={["auto", "auto"]}
        />
        <ZAxis range={[60, 60]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v, isim) => (isim === "getiri" ? [`%${Number(v).toFixed(2)}`, "Getiri"] : [`${Number(v).toFixed(2)} yıl`, "Kalan vade"])}
          labelFormatter={() => ""}
        />
        <Scatter data={veri} fill="var(--chart-1)" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
