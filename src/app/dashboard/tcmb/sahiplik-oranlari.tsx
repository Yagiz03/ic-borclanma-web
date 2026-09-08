"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { OzetSerit } from "@/components/ozet-serit";

/**
 * DİBS piyasa değeri sekmesinin sayısal özeti: kesim bazında son piyasa
 * değerleri ve bunların toplamdaki payı -- pages/tcmb_gostergeler.py'deki
 * "Piyasa değerleri (milyon TL)" / "Toplama oranlar" / "Toplama oranlar (%)"
 * bölümlerinin karşılığı.
 */

export type DibsSatiri = Record<string, string | number>;

const KESIMLER = [
  { anahtar: "dunya_geri_kalani", etiket: "Yabancı sahipliği", renk: "#F472B6" },
  { anahtar: "tcmb", etiket: "TCMB sahipliği", renk: "#FBBF24" },
  { anahtar: "bankalar", etiket: "Bankalar sahipliği", renk: "#34D399" },
  { anahtar: "fonlar", etiket: "Yatırım ve emeklilik fonları sahipliği", renk: "#A78BFA" },
] as const;

const sayi = (v: number | null) =>
  v == null ? "–" : v.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
const tarihFmt = (v: string) =>
  new Date(`${v}T00:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "UTC" });

export function SahiplikOranlari({ veri }: { veri: DibsSatiri[] }) {
  // Emeklilik + yatırım fonları tek "fonlar" kalemi (Python'daki min_count=1
  // ile aynı: ikisi de boşsa boş, biri doluysa o).
  const satirlar = veri.map((r) => {
    const em = r["dibs_piy_deg_emeklilik_fonlari"];
    const ya = r["dibs_piy_deg_yatirim_fonlari"];
    const fonlar =
      typeof em === "number" || typeof ya === "number"
        ? (typeof em === "number" ? em : 0) + (typeof ya === "number" ? ya : 0)
        : null;
    return {
      tarih: String(r.tarih ?? r.ay ?? ""),
      toplam: typeof r["dibs_piy_deg_toplam"] === "number" ? (r["dibs_piy_deg_toplam"] as number) : null,
      dunya_geri_kalani:
        typeof r["dibs_piy_deg_dunya_geri_kalani"] === "number" ? (r["dibs_piy_deg_dunya_geri_kalani"] as number) : null,
      tcmb: typeof r["dibs_piy_deg_tcmb"] === "number" ? (r["dibs_piy_deg_tcmb"] as number) : null,
      bankalar: typeof r["dibs_piy_deg_bankalar"] === "number" ? (r["dibs_piy_deg_bankalar"] as number) : null,
      fonlar,
    };
  });

  const toplamliSatirlar = satirlar.filter((r) => r.toplam != null && r.toplam > 0);
  if (toplamliSatirlar.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        DİBS piyasa değeri toplamı (evds_seriler.dibs_piy_deg_toplam) bulunamadı.
      </p>
    );
  }
  const son = toplamliSatirlar[toplamliSatirlar.length - 1];

  const pay = (v: number | null) => (v == null || !son.toplam ? null : (v / son.toplam) * 100);

  const oranSerisi = toplamliSatirlar.map((r) => ({
    tarih: r.tarih,
    ...Object.fromEntries(
      KESIMLER.map((k) => [k.anahtar, r[k.anahtar] != null && r.toplam ? (r[k.anahtar]! / r.toplam) * 100 : null]),
    ),
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-base font-semibold">Piyasa değerleri (milyon TL)</h3>
        <OzetSerit
          alanlar={[
            { etiket: "Bono piyasa toplam değeri", deger: sayi(son.toplam) },
            { etiket: "Dünyanın geri kalanı (S2)", deger: sayi(son.dunya_geri_kalani) },
            { etiket: "TCMB (S121)", deger: sayi(son.tcmb) },
            { etiket: "Bankalar (S122)", deger: sayi(son.bankalar) },
            { etiket: "Fonlar (S129+S1234)", deger: sayi(son.fonlar) },
          ]}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-semibold">Toplama oranlar</h3>
        <OzetSerit
          alanlar={KESIMLER.map((k) => {
            const p = pay(son[k.anahtar]);
            return { etiket: k.etiket, deger: p == null ? "–" : `%${p.toFixed(2)}` };
          })}
        />
        <p className="text-xs text-muted-foreground">Son veri tarihi: {tarihFmt(son.tarih)}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-semibold">Toplama oranlar (%)</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {KESIMLER.map((k) => (
            <div key={k.anahtar} className="min-w-0 rounded-xl border border-border p-3">
              <p className="mb-2 text-sm font-medium">{k.etiket}</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={oranSerisi} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="tarih"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickFormatter={tarihFmt}
                    minTickGap={40}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    width={44}
                    tickFormatter={(v) => `%${Number(v).toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v) => (typeof v === "string" ? tarihFmt(v) : "")}
                    formatter={(v) => [`%${Number(v).toFixed(2)}`, k.etiket]}
                  />
                  <Area
                    type="monotone"
                    dataKey={k.anahtar}
                    stroke={k.renk}
                    fill={k.renk}
                    fillOpacity={0.22}
                    strokeWidth={1.5}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
