"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, Area, AreaChart, Bar, BarChart, Cell, ReferenceLine, Pie, PieChart, ComposedChart } from "recharts";

const RENKLER = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.55 0.18 200)",
  "oklch(0.62 0.2 15)",
  "oklch(0.5 0.05 260)",
];

type Seri = { anahtar: string; etiket: string };

function tarihFmt(v: string) {
  return new Date(v).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function ayFmt(v: string) {
  const [yil, ay] = v.split("-").map(Number);
  return new Date(Date.UTC(yil, ay - 1, 1)).toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
}

/** %100 yığılmış alan grafiği -- her ay toplamı %100 olan kompozisyon
 * serileri için (ör. kağıt tipine göre outstanding stok dağılımı). */
export function YuzdeAlanGrafigi({
  veri,
  seriler,
}: {
  veri: Record<string, string | number>[];
  seriler: Seri[];
}) {
  if (veri.length === 0) return <p className="text-sm text-muted-foreground">Veri yok.</p>;
  return (
    <ResponsiveContainer width="100%" height={460}>
      <AreaChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="ay" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={ayFmt} minTickGap={32} />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={48} domain={[0, 100]} tickFormatter={(v) => `%${Math.round(v)}`} />
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          labelFormatter={(v) => (typeof v === "string" ? ayFmt(v) : "")}
          formatter={(v, isim) => [`%${Number(v).toFixed(1)}`, isim]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {seriler.map((s, i) => (
          <Area
            key={s.anahtar}
            type="monotone"
            dataKey={s.anahtar}
            name={s.etiket}
            stackId="1"
            stroke={RENKLER[i % RENKLER.length]}
            fill={RENKLER[i % RENKLER.length]}
            fillOpacity={0.75}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CokluCizgiGrafigi({
  veri,
  seriler,
  birim = "",
  ondalik = 2,
}: {
  veri: Record<string, string | number>[];
  seriler: Seri[];
  birim?: string;
  ondalik?: number;
}) {
  if (veri.length === 0) return <p className="text-sm text-muted-foreground">Veri yok.</p>;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="tarih" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={tarihFmt} minTickGap={32} />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={56} domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          labelFormatter={(v) => (typeof v === "string" ? tarihFmt(v) : "")}
          formatter={(v, isim) => [`${Number(v).toFixed(ondalik)}${birim}`, isim]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {seriler.map((s, i) => (
          <Line key={s.anahtar} type="monotone" dataKey={s.anahtar} name={s.etiket} stroke={RENKLER[i % RENKLER.length]} strokeWidth={2} dot={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** İşareti pozitif/negatife göre renklenen bar grafiği -- nakit dengesi,
 * çevirme oranı (%100 referans çizgisiyle) gibi seriler için. */
export function RenkliBarGrafik({
  veri, dataKey, etiket, esikDeger, birim = "",
}: {
  veri: Record<string, string | number>[];
  dataKey: string;
  etiket: string;
  esikDeger?: number;
  birim?: string;
}) {
  if (veri.length === 0) return <p className="text-sm text-muted-foreground">Veri yok.</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="etiket" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} angle={-45} textAnchor="end" interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={56} />
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [`${Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}${birim}`, etiket]}
        />
        {esikDeger != null && (
          <ReferenceLine y={esikDeger} stroke="var(--chart-2)" strokeDasharray="4 4" />
        )}
        <Bar dataKey={dataKey} name={etiket}>
          {veri.map((v, i) => (
            <Cell key={i} fill={Number(v[dataKey]) < (esikDeger ?? 0) ? "var(--chart-2)" : "var(--chart-1)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Halka (donut) pasta grafiği -- kağıt tipine göre dağılım gibi tek
 * seferlik kompozisyon gösterimleri için. */
export function PastaGrafigi({
  veri,
}: {
  veri: { etiket: string; deger: number }[];
}) {
  if (veri.length === 0) return <p className="text-sm text-muted-foreground">Veri yok.</p>;
  const toplam = veri.reduce((s, v) => s + v.deger, 0);
  return (
    <ResponsiveContainer width="100%" height={380}>
      <PieChart>
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={(v, isim) => [
            `${Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} (%${((Number(v) / toplam) * 100).toFixed(1)})`,
            isim,
          ]}
        />
        <Pie
          data={veri}
          dataKey="deger"
          nameKey="etiket"
          innerRadius="45%"
          outerRadius="80%"
          label={(p: { etiket?: string; percent?: number }) =>
            `${p.etiket} %${((p.percent ?? 0) * 100).toFixed(0)}`
          }
        >
          {veri.map((v, i) => (
            <Cell key={v.etiket} fill={RENKLER[i % RENKLER.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Yığılmış alan grafiği -- varsayılan olarak gerçek tarih ekseni (DİBS
 * piyasa değeri gibi haftalık seriler) bekler. `xKey`/`kategorik` ile
 * önceden formatlanmış kategorik etiketler (ör. "2026 Temmuz" gibi aylık
 * bir `etiket` sütunu) kullanan seriler için de kullanılabilir. */
export function YiginliAlanGrafigi({
  veri,
  seriler,
  xKey = "tarih",
  kategorik = false,
  birim = "Mn TL",
}: {
  veri: Record<string, string | number>[];
  seriler: Seri[];
  xKey?: string;
  kategorik?: boolean;
  birim?: string;
}) {
  if (veri.length === 0) return <p className="text-sm text-muted-foreground">Veri yok.</p>;
  return (
    <ResponsiveContainer width="100%" height={340}>
      <AreaChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={kategorik ? undefined : tarihFmt}
          minTickGap={32}
        />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={64} />
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          labelFormatter={kategorik ? undefined : (v) => (typeof v === "string" ? tarihFmt(v) : "")}
          formatter={(v, isim) => [`${Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ${birim}`, isim]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {seriler.map((s, i) => (
          <Area
            key={s.anahtar}
            type="monotone"
            dataKey={s.anahtar}
            name={s.etiket}
            stackId="1"
            stroke={RENKLER[i % RENKLER.length]}
            fill={RENKLER[i % RENKLER.length]}
            fillOpacity={0.65}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Aylık bar (işarete göre yeşil/kırmızı) + kümülatif çizgi kombinasyonu --
 * cari işlemler dengesi gibi "tek ay pozitif/negatif ama trend nasıl"
 * sorusuna cevap veren seriler için. */
export function BarCizgiGrafigi({
  veri, barDataKey, cizgiDataKey, barEtiket, cizgiEtiket, birim = "",
}: {
  veri: Record<string, string | number>[];
  barDataKey: string;
  cizgiDataKey: string;
  barEtiket: string;
  cizgiEtiket: string;
  birim?: string;
}) {
  if (veri.length === 0) return <p className="text-sm text-muted-foreground">Veri yok.</p>;
  return (
    <ResponsiveContainer width="100%" height={380}>
      <ComposedChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="tarih" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={tarihFmt} minTickGap={32} />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={72} />
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          labelFormatter={(v) => (typeof v === "string" ? tarihFmt(v) : "")}
          formatter={(v, isim) => [`${Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}${birim}`, isim]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <Bar dataKey={barDataKey} name={barEtiket}>
          {veri.map((v, i) => (
            <Cell key={i} fill={Number(v[barDataKey]) < 0 ? "var(--chart-2)" : "oklch(0.65 0.16 155)"} />
          ))}
        </Bar>
        <Line type="monotone" dataKey={cizgiDataKey} name={cizgiEtiket} stroke="var(--chart-2)" strokeWidth={2} dot={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
