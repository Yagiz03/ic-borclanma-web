"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

const RENK_HEX: Record<string, string> = {
  "Sabit Kuponlu Devlet Tahvili": "oklch(0.7 0.16 250)",
  "TLREF'e Endeksli Devlet Tahvili": "oklch(0.68 0.15 300)",
  "TÜFE'ye Endeksli Devlet Tahvili": "oklch(0.72 0.15 155)",
  "Değişken Faizli Devlet Tahvili": "oklch(0.75 0.16 95)",
  "Kuponsuz Devlet Tahvili": "oklch(0.72 0.15 40)",
  "Hazine Bonosu": "oklch(0.55 0.02 255)",
};

export function DagilimGrafigi({ veri }: { veri: { tip: string; adet: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={veri} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="tip"
          width={150}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v) => [`${v} kağıt`, ""]}
        />
        <Bar dataKey="adet" radius={[0, 4, 4, 0]} barSize={14}>
          {veri.map((d) => (
            <Cell key={d.tip} fill={RENK_HEX[d.tip] ?? "var(--muted-foreground)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
