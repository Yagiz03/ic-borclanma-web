"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { utcTarihe } from "@/lib/tarih";

/**
 * İhale geçmişinin zaman serisi grafikleri (gerçekleşen faiz / ihraç sonrası
 * stok) -- eski projede pages/isin_detay.py'deki iki px.line grafiği.
 * X ekseni ihale tarihleri; noktalar az olduğu için her noktada işaret var.
 */
export function IhaleSeyriGrafigi({
  veri,
  dataKey,
  birim = "",
  ondalik = 2,
  renk = "var(--chart-1)",
}: {
  veri: { tarih: string; faiz: number; stokMlr: number | null }[];
  dataKey: "faiz" | "stokMlr";
  birim?: string;
  ondalik?: number;
  renk?: string;
}) {
  if (veri.length < 2) {
    return <p className="text-sm text-muted-foreground">Grafik için yeterli ihale kaydı yok.</p>;
  }
  const fmt = (v: string) => {
    const d = utcTarihe(v);
    return d ? d.toLocaleDateString("tr-TR", { timeZone: "UTC" }) : v;
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="tarih"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickFormatter={fmt}
          minTickGap={32}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          width={56}
          domain={["dataMin - 1", "dataMax + 1"]}
          tickFormatter={(v) => Number(v).toFixed(ondalik === 3 ? 1 : 0)}
        />
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          labelFormatter={(v) => (typeof v === "string" ? fmt(v) : "")}
          formatter={(v) => [
            `${birim === "%" ? "%" : ""}${Number(v).toFixed(ondalik)}${birim === "%" ? "" : birim}`,
            dataKey === "faiz" ? "Ort. bileşik faiz" : "İhraç sonrası stok",
          ]}
        />
        <Line
          type="linear"
          dataKey={dataKey}
          stroke={renk}
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
