"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tarihFmt = (v: string) =>
  new Date(`${v}T00:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "UTC" });

export function OrtKalanVadeGrafigi({ veri }: { veri: { tarih: string; ortVadeYil: number }[] }) {
  if (veri.length === 0) {
    return <p className="text-sm text-muted-foreground">Vade geçmişi için yeterli veri yok.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="tarih"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={tarihFmt}
          minTickGap={48}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          width={52}
          domain={["dataMin - 0.2", "dataMax + 0.2"]}
          tickFormatter={(v) => Number(v).toFixed(1)}
          unit=" yıl"
        />
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          labelFormatter={(v) => (typeof v === "string" ? tarihFmt(v) : "")}
          formatter={(v) => [`${Number(v).toFixed(2)} yıl`, "Ağırlıklı ort. kalan vade"]}
        />
        <Area
          type="monotone"
          dataKey="ortVadeYil"
          stroke="var(--chart-1)"
          fill="var(--chart-1)"
          fillOpacity={0.18}
          strokeWidth={1.5}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
