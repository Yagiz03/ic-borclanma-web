"use client";

import { Bar, BarChart, Cell, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { bps, sayi } from "@/lib/bicim";
import { yumusakEksen } from "@/lib/eksen";

type Nokta = { isin: string; carryRollBp: number; kalanVadeYil: number };

/** Carry+Roll'a göre sıralı ISIN çubukları -- pozitif yeşil, negatif kırmızı
 *  (deneysel.py::_carry_roll_bolumu'ndaki Plotly grafiğinin karşılığı). */
export function CarryRollGrafigi({ veri }: { veri: Nokta[] }) {
  if (veri.length === 0) return null;

  const eksen = yumusakEksen(veri.map((n) => n.carryRollBp));

  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 56 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="isin"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          angle={-45}
          textAnchor="end"
          interval={0}
          height={56}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          width={56}
          domain={eksen?.domain}
          ticks={eksen?.ticks}
          tickFormatter={(v) => sayi(v, 0)}
        />
        <Tooltip
          cursor={{ fill: "color-mix(in oklch, var(--muted) 50%, transparent)" }}
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [bps(Number(v)), "Carry+Roll"]}
          labelFormatter={(etiket) => {
            const n = veri.find((x) => x.isin === etiket);
            return n ? `${n.isin} · ${sayi(n.kalanVadeYil, 1)} yıl` : String(etiket);
          }}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        <Bar dataKey="carryRollBp">
          {veri.map((n) => (
            <Cell
              key={n.isin}
              fill={n.carryRollBp >= 0 ? "var(--pozitif)" : "var(--negatif)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
