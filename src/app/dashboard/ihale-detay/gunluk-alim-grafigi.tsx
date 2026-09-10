"use client";

import { Bar, BarChart, CartesianGrid, Label, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { sayi } from "@/lib/bicim";

const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/**
 * TCMB'nin günlük doğrudan alımları — GERÇEK TAKVİM ekseninde.
 *
 * Önce paylaşılan RenkliBarGrafik kullanılıyordu: o KATEGORİ ekseni çiziyor,
 * yani dizideki her eleman eşit aralıkta bir yuva alıyor. Dizide yalnızca
 * alım YAPILAN günler olduğu için grafik "her gün alım olmuş" gibi
 * görünüyordu; iki alım arasındaki üç haftalık boşluk ile ertesi gün
 * yapılan alım aynı mesafede duruyordu.
 *
 * Burada x ekseni sayısal (zaman damgası) ve alan yılbaşından bugüne sabit.
 * Çubuklar gerçek tarihlerine oturuyor, alım olmayan günler boş kalıyor.
 */
export function GunlukAlimGrafigi({
  veri,
  birim = " Bin TL",
}: {
  veri: { tarih: string; tutar: number }[];
  birim?: string;
}) {
  if (veri.length === 0) return <p className="text-sm text-muted-foreground">Veri yok.</p>;

  const noktalar = veri
    .map((v) => ({ t: Date.parse(`${v.tarih}T00:00:00Z`), tutar: v.tutar, tarih: v.tarih }))
    .filter((v) => Number.isFinite(v.t))
    .sort((a, b) => a.t - b.t);
  if (noktalar.length === 0) return <p className="text-sm text-muted-foreground">Veri yok.</p>;

  const yil = new Date(noktalar[0].t).getUTCFullYear();
  const bas = Date.UTC(yil, 0, 1);
  // Alan yılın sonuna kadar değil, son alım gününe kadar: boş bir gelecek
  // yarım yıl çizmek grafiği okunmaz yapıyor.
  const son = noktalar[noktalar.length - 1].t + 5 * 86_400_000;

  const ticks: number[] = [];
  for (let ay = 0; ay < 12; ay++) {
    const t = Date.UTC(yil, ay, 1);
    if (t >= bas && t <= son) ticks.push(t);
  }

  const gunSayisi = Math.max(1, Math.round((son - bas) / 86_400_000));
  // Çubuk genişliği: gün sayısı arttıkça incelir ama 2 px'in altına inmesin,
  // yoksa tek günlük alımlar kaybolur.
  const cubuk = Math.max(2, Math.min(10, Math.round(900 / gunSayisi)));

  const gunFmt = (t: number) => {
    const d = new Date(t);
    return `${AY_KISA[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };

  /** 5.000.000 yerine 5M -- ham rakamlar Y eksenini gereksiz genisletiyordu. */
  const kisaSayi = (v: number) => {
    if (v === 0) return "0";
    if (Math.abs(v) >= 1e6) return `${sayi(v / 1e6, Math.abs(v) >= 1e7 ? 0 : 1)}M`;
    if (Math.abs(v) >= 1e3) return `${sayi(v / 1e3, 0)}B`;
    return sayi(v, 0);
  };
  const tamTarih = (t: number) => {
    const d = new Date(t);
    return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
  };

  const yilBasindanMi = noktalar[0].t >= bas;

  return (
    <div className="space-y-1">
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={noktalar} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="t"
          domain={[bas, son]}
          ticks={ticks}
          tickFormatter={gunFmt}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          allowDataOverflow={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          width={72}
          tickFormatter={kisaSayi}
        >
          <Label
            value="Bin TL"
            angle={-90}
            position="insideLeft"
            style={{ fontSize: 11, fill: "var(--muted-foreground)", textAnchor: "middle" }}
          />
        </YAxis>
        <Tooltip
          cursor={{ fill: "color-mix(in oklch, var(--muted) 55%, transparent)" }}
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          labelFormatter={(t) => (typeof t === "number" ? tamTarih(t) : String(t))}
          formatter={(v) => [`${sayi(Number(v), 1)}${birim}`, "Alım Tutarı"]}
        />
        <Bar dataKey="tutar" fill="var(--chart-1)" barSize={cubuk} />
      </BarChart>
    </ResponsiveContainer>
      {yilBasindanMi && (
        <p className="text-xs text-muted-foreground">{yil} başından (YTD) itibaren gösteriliyor.</p>
      )}
    </div>
  );
}
