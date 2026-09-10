"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trTarihAyristir } from "@/lib/tarih";
import { Combobox } from "@/components/ui/combobox";

type IhaleRow = {
  isin: string;
  ihale_tarihi: string;
  ihrac_tipi: string | null;
  ort_fiyat_gerceklesme: number | null;
};

/** ihale_sonrasi_fiyatlar gorunumu: her (isin, ihale_tarihi) icin ihale
 *  gununden itibaren siralanmis ilk 21 kapanis. `sira` 0 = ihale gunu. */
type PerformansFiyat = {
  isin: string;
  ihale_tarihi: string;
  sira: number;
  temiz_fiyat: number | null;
};

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

export function PerformansTab({ ihale, fiyatlar, isinler }: { ihale: IhaleRow[]; fiyatlar: PerformansFiyat[]; isinler: { isin: string; etiket: string; vadeD: Date }[] }) {
  const bistIsinler = useMemo(() => new Set(fiyatlar.map((r) => r.isin)), [fiyatlar]);
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
    // (ihale tarihi -> sira -> fiyat). Gorunum dilimi zaten ihale gununden
    // basliyor, yani sira n = T+n.
    const seriler = new Map<string, Map<number, number | null>>();
    for (const f of fiyatlar) {
      if (f.isin !== secili) continue;
      let m = seriler.get(f.ihale_tarihi);
      if (!m) seriler.set(f.ihale_tarihi, (m = new Map()));
      m.set(f.sira, f.temiz_fiyat);
    }

    return buIsinIhale
      .map((r) => {
        const sonraki = seriler.get(r.ihale_tarihi);
        if (!sonraki || sonraki.size === 0) return null;
        const oranlar: Record<string, number | null> = {};
        for (const n of [1, 5, 10, 20]) {
          const fiyatN = sonraki.get(n);
          oranlar[`T+${n}`] = fiyatN != null && r.ort_fiyat_gerceklesme
            ? (fiyatN / r.ort_fiyat_gerceklesme - 1) * 100
            : null;
        }
        return { tarih: r.tarihD.toLocaleDateString("tr-TR"), ihracTipi: r.ihrac_tipi, ihaleFiyat: r.ort_fiyat_gerceklesme, oranlar };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
  }, [ihale, fiyatlar, secili]);

  if (fiyatlar.length === 0 || ihale.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        BIST fiyat verisi veya ihale sonuçları boş — veri henüz yeterince göç etmedi.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Bir ISIN ihalede çıktıktan sonra, ihale ortalama fiyatına göre ikincil piyasada (BIST Kesin Alım Satım
        Pazarı) T+1/T+5/T+10/T+20 işlem gününde ne kadar değiştiğini gösterir — pozitif değer, ihale fiyatının
        ucuz kaldığını (concession) düşündürür.
      </p>

      <div className="max-w-sm space-y-1.5">
        <label className="text-sm text-muted-foreground">ISIN</label>
        <Combobox
          value={secili}
          onChange={setSecili}
          placeholder="ISIN veya kağıt adı yazın..."
          emptyText="Eşleşen ISIN yok."
          options={isinler.map((r) => ({ value: r.isin, label: `${r.isin} — ${r.etiket}`, keywords: r.isin }))}
        />
      </div>

      {satirlar.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Bu ISIN için ihale fiyatı veya BIST verisi eksik — ikincil piyasa verisi (bist_bap_fiyatlar) henüz
          sınırlı, gece senkronizasyonu ilerledikçe daha çok ISIN için sonuç görünecek.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium">İhale tarihi</TableHead>
                <TableHead className="font-medium">İhraç Tipi</TableHead>
                <TableHead className="text-right font-medium">İhale Fiyatı</TableHead>
                <TableHead className="text-right font-medium">T+1</TableHead>
                <TableHead className="text-right font-medium">T+5</TableHead>
                <TableHead className="text-right font-medium">T+10</TableHead>
                <TableHead className="text-right font-medium">T+20</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {satirlar.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-figures whitespace-nowrap">{s.tarih}</TableCell>
                  <TableCell>{s.ihracTipi ?? "–"}</TableCell>
                  <TableCell className="font-figures text-right">{s.ihaleFiyat!.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{tOranRozeti(s.oranlar["T+1"])}</TableCell>
                  <TableCell className="text-right">{tOranRozeti(s.oranlar["T+5"])}</TableCell>
                  <TableCell className="text-right">{tOranRozeti(s.oranlar["T+10"])}</TableCell>
                  <TableCell className="text-right">{tOranRozeti(s.oranlar["T+20"])}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
