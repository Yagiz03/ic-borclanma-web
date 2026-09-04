"use client";

import { useMemo, useState } from "react";
import { trTarihAyristir } from "@/lib/tarih";

type IhaleRow = {
  isin: string;
  ihale_tarihi: string;
  ihrac_tipi: string | null;
  ort_fiyat_gerceklesme: number | null;
};

type BistRow = { isin: string; tarih: string; temiz_fiyat: number | null };

function tOranRozeti(v: number | null) {
  if (v == null) return <span className="text-muted-foreground">–</span>;
  const t = Math.max(-1, Math.min(1, v / 2));
  const ton = (t + 1) * 65; // -2% kırmızı(0), +2% yeşil(130)
  return (
    <span
      className="font-figures inline-block rounded px-1.5 py-0.5"
      style={{ backgroundColor: `oklch(0.93 0.08 ${ton})`, color: `oklch(0.32 0.14 ${ton})` }}
    >
      {v >= 0 ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}

export function PerformansTab({ ihale, bist, isinler }: { ihale: IhaleRow[]; bist: BistRow[]; isinler: { isin: string; etiket: string; vadeD: Date }[] }) {
  const bistIsinler = useMemo(() => new Set(bist.map((r) => r.isin)), [bist]);
  const ihaleIsinler = useMemo(() => new Set(ihale.map((r) => r.isin)), [ihale]);
  const uygunlar = useMemo(
    () => isinler.filter((r) => ihaleIsinler.has(r.isin) && bistIsinler.has(r.isin)),
    [isinler, ihaleIsinler, bistIsinler],
  );
  const [secili, setSecili] = useState(uygunlar[0]?.isin ?? isinler[0]?.isin ?? "");

  const satirlar = useMemo(() => {
    const buIsinIhale = ihale
      .filter((r) => r.isin === secili && r.ort_fiyat_gerceklesme != null)
      .map((r) => ({ ...r, tarihD: trTarihAyristir(r.ihale_tarihi) }))
      .filter((r): r is typeof r & { tarihD: Date } => r.tarihD != null)
      .sort((a, b) => a.tarihD.getTime() - b.tarihD.getTime());
    const buIsinBist = bist
      .filter((r) => r.isin === secili)
      .map((r) => ({ ...r, tarihD: new Date(r.tarih) }))
      .sort((a, b) => a.tarihD.getTime() - b.tarihD.getTime());

    return buIsinIhale
      .map((r) => {
        const sonraki = buIsinBist.filter((b) => b.tarihD.getTime() >= r.tarihD.getTime());
        if (sonraki.length === 0) return null;
        const oranlar: Record<string, number | null> = {};
        for (const n of [1, 5, 10, 20]) {
          const fiyatN = sonraki[n]?.temiz_fiyat;
          oranlar[`T+${n}`] = fiyatN != null && r.ort_fiyat_gerceklesme
            ? (fiyatN / r.ort_fiyat_gerceklesme - 1) * 100
            : null;
        }
        return { tarih: r.tarihD.toLocaleDateString("tr-TR"), ihracTipi: r.ihrac_tipi, ihaleFiyat: r.ort_fiyat_gerceklesme, oranlar };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
  }, [ihale, bist, secili]);

  if (bist.length === 0 || ihale.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        BIST fiyat verisi veya ihale sonuçları boş -- veri henüz yeterince göç etmedi.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Bir ISIN ihalede çıktıktan sonra, ihale ortalama fiyatına göre ikincil piyasada (BIST Kesin Alım Satım
        Pazarı) T+1/T+5/T+10/T+20 işlem gününde ne kadar değiştiğini gösterir -- pozitif değer, ihale fiyatının
        ucuz kaldığını (concession) düşündürür.
      </p>

      <div className="space-y-1.5">
        <label className="text-sm text-muted-foreground" htmlFor="perf-isin">ISIN</label>
        <select
          id="perf-isin" value={secili} onChange={(e) => setSecili(e.target.value)}
          className="block rounded-md border border-input bg-background px-2 py-1.5 text-sm font-figures"
        >
          {isinler.map((r) => <option key={r.isin} value={r.isin}>{r.isin} — {r.etiket}</option>)}
        </select>
      </div>

      {satirlar.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Bu ISIN için ihale fiyatı veya BIST verisi eksik -- ikincil piyasa verisi (bist_bap_fiyatlar) henüz
          sınırlı, gece senkronizasyonu ilerledikçe daha çok ISIN için sonuç görünecek.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">İhale tarihi</th>
                <th className="px-3 py-2 font-medium">İhraç Tipi</th>
                <th className="px-3 py-2 text-right font-medium">İhale Fiyatı</th>
                <th className="px-3 py-2 text-right font-medium">T+1</th>
                <th className="px-3 py-2 text-right font-medium">T+5</th>
                <th className="px-3 py-2 text-right font-medium">T+10</th>
                <th className="px-3 py-2 text-right font-medium">T+20</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((s, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="font-figures px-3 py-2 whitespace-nowrap">{s.tarih}</td>
                  <td className="px-3 py-2">{s.ihracTipi ?? "–"}</td>
                  <td className="font-figures px-3 py-2 text-right">{s.ihaleFiyat!.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right">{tOranRozeti(s.oranlar["T+1"])}</td>
                  <td className="px-3 py-2 text-right">{tOranRozeti(s.oranlar["T+5"])}</td>
                  <td className="px-3 py-2 text-right">{tOranRozeti(s.oranlar["T+10"])}</td>
                  <td className="px-3 py-2 text-right">{tOranRozeti(s.oranlar["T+20"])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
