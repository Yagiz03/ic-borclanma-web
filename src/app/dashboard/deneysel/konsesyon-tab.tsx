"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { BosDurum } from "@/components/bos-durum";
import { OzetSerit } from "@/components/ozet-serit";
import { Bolum } from "@/components/bolum";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sayi } from "@/lib/bicim";
import {
  eventEgrisi, konsesyonOzeti, type KonsesyonIhale, type KonsesyonOlay,
} from "@/lib/konsesyon";

const DONEMLER = [
  { etiket: "Tüm veri", ay: null },
  { etiket: "Son 12 ay", ay: 12 },
  { etiket: "Son 6 ay", ay: 6 },
  { etiket: "Son 3 ay", ay: 3 },
] as const;

const bps = (v: number | null | undefined, ondalik = 1) =>
  v == null ? "–" : `${v >= 0 ? "+" : ""}${sayi(v, ondalik)} bps`;

export function KonsesyonTab({
  olaylar,
  ihaleler,
}: {
  olaylar: KonsesyonOlay[];
  ihaleler: KonsesyonIhale[];
}) {
  const [donemAy, setDonemAy] = useState<number | null>(null);

  const { egri, ozet, seciliIhaleler } = useMemo(() => {
    let esik: string | null = null;
    if (donemAy != null) {
      const d = new Date();
      d.setMonth(d.getMonth() - donemAy);
      esik = d.toISOString().slice(0, 10);
    }
    const ih = esik ? ihaleler.filter((i) => i.ihale_tarihi >= esik!) : ihaleler;
    const anahtarlar = new Set(ih.map((i) => `${i.isin}|${i.ihale_tarihi}`));
    const ol = esik ? olaylar.filter((o) => anahtarlar.has(`${o.isin}|${o.ihale_dt}`)) : olaylar;
    return { egri: eventEgrisi(ol), ozet: konsesyonOzeti(ih), seciliIhaleler: ih };
  }, [olaylar, ihaleler, donemAy]);

  if (ihaleler.length === 0) {
    return (
      <BosDurum
        baslik="Konsesyon analizi hazır değil"
        aciklama="Analiz gece pipeline'ında hesaplanıyor; sonuçlar henüz aktarılmamış."
      />
    );
  }

  const anlamli = ozet.tStat != null && Math.abs(ozet.tStat) > 2;
  const siraliIhaleler = [...seciliIhaleler].sort((a, b) => b.ihale_tarihi.localeCompare(a.ihale_tarihi));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Yeniden ihraç ihalelerinde ikincil piyasa spread&apos;i (kağıdın Nelson-Siegel eğrisine göre
        ucuzluğu) ihale çevresinde nasıl hareket ediyor? Klasik konsesyon paterninde spread ihale
        <b> öncesi yükselir</b> (piyasa arza hazırlanırken ucuzlar) ve <b>sonrası geriler</b> — yani
        değişim (sonra − önce) NEGATİF beklenir. Aşağıdaki eğri ihale gününe göre iş günü bazında
        ortalama spread&apos;i gösteriyor; 0 = ihale günü.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {DONEMLER.map((d) => (
          <button
            key={d.etiket}
            type="button"
            onClick={() => setDonemAy(d.ay)}
            className={`rounded-md border px-3 py-1 text-sm ${
              donemAy === d.ay
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:bg-muted"
            }`}
          >
            {d.etiket}
          </button>
        ))}
      </div>

      <OzetSerit
        alanlar={[
          { etiket: "İhale sayısı", deger: String(ozet.nIhale) },
          { etiket: "İhale öncesi ort. spread", deger: bps(ozet.spreadOnceOrt) },
          { etiket: "İhale sonrası ort. spread", deger: bps(ozet.spreadSonraOrt) },
          {
            etiket: "Ortalama değişim",
            deger: bps(ozet.degisimOrt),
            altBilgi: (ozet.degisimOrt ?? 0) < 0 ? "zenginleşme (beklenen yön)" : "ucuzlama",
          },
          {
            etiket: "t istatistiği",
            deger: ozet.tStat == null ? "–" : sayi(ozet.tStat, 2),
            altBilgi: anlamli ? "|t| > 2 — anlamlı" : "anlamsız",
          },
          {
            etiket: "Zenginleşen ihale",
            deger: ozet.zenginlesenOran == null ? "–" : `%${sayi(ozet.zenginlesenOran, 1)}`,
          },
        ]}
      />

      <Bolum baslik="Olay eğrisi — ihale gününe göre ortalama spread">
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={egri} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="offset"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              label={{ value: "İhale gününe göre iş günü (0 = ihale)", position: "insideBottom", offset: -5, fontSize: 11 }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              width={64}
              unit=" bp"
              tickFormatter={(v) => sayi(Number(v), 0)}
            />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(v) => `Offset ${v} iş günü`}
              formatter={(v, _ad, yuk) => [
                `${sayi(Number(v), 1)} bps (n=${(yuk?.payload as { adet?: number })?.adet ?? "?"})`,
                "Ortalama spread",
              ]}
            />
            {/* İhale günü: eğrinin kırılma noktası buradan okunuyor. */}
            <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeDasharray="4 3" />
            <Line type="monotone" dataKey="ortalama" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </Bolum>

      <Bolum baslik={`İhale bazında (${siraliIhaleler.length})`}>
        <div className="max-h-[460px] overflow-y-auto rounded-lg border border-border">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead>İhale Tarihi</TableHead>
                <TableHead>ISIN</TableHead>
                <TableHead>Senet</TableHead>
                <TableHead className="px-4 text-right">Önce</TableHead>
                <TableHead className="px-4 text-right">Sonra</TableHead>
                <TableHead className="px-4 text-right">Değişim</TableHead>
                <TableHead className="px-4 text-right">Tail</TableHead>
                <TableHead className="px-4 text-right">Bid/Cover</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {siraliIhaleler.map((i) => (
                <TableRow key={`${i.isin}|${i.ihale_tarihi}`}>
                  <TableCell className="font-figures whitespace-nowrap">{i.ihale_tarihi}</TableCell>
                  <TableCell className="font-figures">{i.isin}</TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-muted-foreground">{i.senet_tanimi ?? "–"}</TableCell>
                  <TableCell className="font-figures px-4 text-right">{bps(i.spread_once)}</TableCell>
                  <TableCell className="font-figures px-4 text-right">{bps(i.spread_sonra)}</TableCell>
                  <TableCell
                    className={`font-figures px-4 text-right ${
                      i.degisim_bps == null ? "" : i.degisim_bps < 0 ? "text-[var(--pozitif)]" : "text-[var(--negatif)]"
                    }`}
                  >
                    {bps(i.degisim_bps)}
                  </TableCell>
                  <TableCell className="font-figures px-4 text-right">{i.tail_bps == null ? "–" : sayi(i.tail_bps, 0)}</TableCell>
                  <TableCell className="font-figures px-4 text-right">{i.bid_to_cover == null ? "–" : sayi(i.bid_to_cover, 2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Bolum>

      <p className="text-xs text-muted-foreground">
        Değişim = ihale sonrası 3 iş günü ortalaması − öncesi 3 iş günü ortalaması. t istatistiği
        scipy olmadan normal yaklaşıklığıyla hesaplanıyor; |t| &gt; 2 kabaca %5 anlamlılık olarak
        okunur, az ihaleli dönemlerde güvenilmez. Analiz yalnızca YENİDEN İHRAÇ ihalelerini kapsar —
        ilk ihraçta kağıdın ikincil piyasa geçmişi olmadığı için &quot;öncesi&quot; ölçülemez.
      </p>
    </div>
  );
}
