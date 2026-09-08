"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const RENKLER = [
  "oklch(0.7 0.16 250)",
  "oklch(0.72 0.15 40)",
  "oklch(0.72 0.15 155)",
  "oklch(0.68 0.15 300)",
  "oklch(0.75 0.16 95)",
];

const tarihKisa = (v: string) =>
  new Date(`${v}T00:00:00Z`).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const tarihUzun = (v: string) =>
  new Date(`${v}T00:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "UTC" });

const KUTU = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

export function KarsilastirmaGrafigi({
  veri,
  isinler,
  normalize = false,
}: {
  veri: Record<string, string | number>[];
  isinler: string[];
  normalize?: boolean;
}) {
  if (veri.length === 0) {
    return <p className="text-sm text-muted-foreground">Seçilen kağıtlar için ortak veri bulunamadı.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={380}>
      <LineChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="tarih"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={(v: string) => tarihKisa(v)}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          width={56}
          domain={["auto", "auto"]}
          tickFormatter={(v) => (normalize ? `${Number(v).toFixed(0)}%` : `%${Number(v).toFixed(0)}`)}
        />
        <Tooltip
          contentStyle={KUTU}
          labelFormatter={(v) => (typeof v === "string" ? tarihUzun(v) : "")}
          formatter={(v, isim) => [
            normalize ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%` : `%${Number(v).toFixed(2)}`,
            isim,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {/* Normalize modda 0 çizgisi referans: üstü ilk güne göre yükselmiş demek. */}
        {normalize && <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />}
        {isinler.map((isin, i) => (
          <Line
            key={isin}
            type="linear"
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

/**
 * Referans kağıda göre getiri farkı (bps). Sıfır çizgisinin iki yanı ayrı
 * renkte dolduruluyor -- eski projedeki Plotly grafiğiyle aynı okuma:
 * yeşil = referanstan daha yüksek getiri (daha ucuz), kırmızı = tersi.
 */
export function SpreadGrafigi({
  veri,
  isinler,
  referans,
}: {
  veri: Record<string, string | number>[];
  isinler: string[];
  referans: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          {isinler.map((isin, i) => (
            <linearGradient key={isin} id={`spread-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={RENKLER[i % RENKLER.length]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={RENKLER[i % RENKLER.length]} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="tarih"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={(v: string) => tarihKisa(v)}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          width={56}
          tickFormatter={(v) => `${Number(v).toFixed(0)}`}
          unit=" bp"
        />
        <Tooltip
          contentStyle={KUTU}
          labelFormatter={(v) => (typeof v === "string" ? tarihUzun(v) : "")}
          formatter={(v, isim) => [
            `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(0)} bps`,
            `${isim} − ${referans}`,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => `${v} − ${referans}`} />
        <ReferenceLine y={0} stroke="var(--muted-foreground)" />
        {isinler.map((isin, i) => (
          <Area
            key={isin}
            type="linear"
            dataKey={isin}
            stroke={RENKLER[i % RENKLER.length]}
            strokeWidth={1.5}
            fill={`url(#spread-${i})`}
            connectNulls
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
