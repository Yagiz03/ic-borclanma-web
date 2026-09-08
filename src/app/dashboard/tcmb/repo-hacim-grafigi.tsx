"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { ZamanAraligiSecici, zamanaGoreSuz, type ZamanAraligi } from "@/components/zaman-araligi";

const ARALIKLAR: ZamanAraligi[] = ["3a", "6a", "ytd", "1y", "3y", "tum"];

const tarihFmt = (v: string) =>
  new Date(`${v}T00:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "UTC" });

/** Milyar TL kısaltması -- ham TL değerler ekseni okunmaz kılıyor. */
const milyar = (v: number) => `${(v / 1e9).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} mlr`;

export function RepoHacimGrafigi({ veri }: { veri: { tarih: string; deger: number }[] }) {
  const [aralik, setAralik] = useState<ZamanAraligi>("1y");
  const gosterilecek = zamanaGoreSuz(veri, aralik);

  if (veri.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ZamanAraligiSecici deger={aralik} onChange={setAralik} secenekler={ARALIKLAR} />
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={gosterilecek} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="tarih"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={tarihFmt}
            minTickGap={48}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            width={72}
            tickFormatter={milyar}
          />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(v) => (typeof v === "string" ? tarihFmt(v) : "")}
            formatter={(v) => [
              `${Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`,
              "İşlem hacmi",
            ]}
          />
          <Bar dataKey="deger" fill="var(--chart-1)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
