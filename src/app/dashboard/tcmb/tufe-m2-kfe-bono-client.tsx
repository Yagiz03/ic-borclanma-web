"use client";

import { useMemo, useState } from "react";
import { CokluCizgiGrafigi } from "./coklu-cizgi-grafigi";

export type AylikSatir = {
  ay: string;
  tufeYillikPct: number | null;
  tufeAylikPct: number | null;
  cYillikPct: number | null;
  cAylikPct: number | null;
  m2: number | null;
  kfe: number | null;
  bonoToplam: number | null;
  m2AylikPct: number | null;
  m2YillikPct: number | null;
  kfeAylikPct: number | null;
  kfeYillikPct: number | null;
  bonoAylikPct: number | null;
  bonoYillikPct: number | null;
  m2ReelAylikPct: number | null;
  m2ReelYillikPct: number | null;
  kfeReelAylikPct: number | null;
  kfeReelYillikPct: number | null;
  bonoReelAylikPct: number | null;
  bonoReelYillikPct: number | null;
};

const ARALIKLAR = [
  { anahtar: "1a", etiket: "1 Ay", ay: 1 },
  { anahtar: "3a", etiket: "3 Ay", ay: 3 },
  { anahtar: "6a", etiket: "6 Ay", ay: 6 },
  { anahtar: "ytd", etiket: "YTD", ay: null },
  { anahtar: "1y", etiket: "1 Yıl", ay: 12 },
  { anahtar: "tumu", etiket: "Tümü", ay: null },
] as const;
type AralikAnahtari = (typeof ARALIKLAR)[number]["anahtar"];

function ayIsoTarihe(ay: string): string {
  return `${ay}-01`;
}

function pct2(v: number | null): string {
  return v == null ? "–" : `%${v.toFixed(2)}`;
}

function pctIsaretli(v: number | null): string {
  return v == null ? "–" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function AralikSecici({ secili, onSec }: { secili: AralikAnahtari; onSec: (a: AralikAnahtari) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ARALIKLAR.map((a) => (
        <button
          key={a.anahtar}
          type="button"
          onClick={() => onSec(a.anahtar)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            secili === a.anahtar
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          {a.etiket}
        </button>
      ))}
    </div>
  );
}

function grafikSatiri(veri: { tarih: string; [seri: string]: number | null | string }): Record<string, string | number> {
  const satir: Record<string, string | number> = { tarih: veri.tarih };
  for (const [k, v] of Object.entries(veri)) {
    if (k !== "tarih" && v != null) satir[k] = v;
  }
  return satir;
}

function aralikFiltrele<T extends { ay: string }>(satirlar: T[], secili: AralikAnahtari): T[] {
  if (satirlar.length === 0) return satirlar;
  if (secili === "tumu") return satirlar;
  if (secili === "ytd") {
    const guncelYil = satirlar[satirlar.length - 1].ay.slice(0, 4);
    return satirlar.filter((s) => s.ay.startsWith(guncelYil));
  }
  const aySayisi = ARALIKLAR.find((a) => a.anahtar === secili)?.ay ?? 12;
  return satirlar.slice(-aySayisi);
}

export function TufeM2KfeBonoClient({ satirlar, son }: { satirlar: AylikSatir[]; son: AylikSatir }) {
  const [aralik1, setAralik1] = useState<AralikAnahtari>("tumu");
  const [aralik2, setAralik2] = useState<AralikAnahtari>("tumu");
  const [tabloAcik, setTabloAcik] = useState(false);

  const enflasyonVerisi = useMemo(
    () =>
      aralikFiltrele(satirlar, aralik1).map((s) =>
        grafikSatiri({
          tarih: ayIsoTarihe(s.ay),
          TÜFE: s.tufeYillikPct,
          "C çekirdek": s.cYillikPct,
        }),
      ),
    [satirlar, aralik1],
  );

  const karsilastirmaVerisi = useMemo(
    () =>
      aralikFiltrele(satirlar, aralik2).map((s) =>
        grafikSatiri({
          tarih: ayIsoTarihe(s.ay),
          TÜFE: s.tufeYillikPct,
          "M2 Para Arzı": s.m2YillikPct,
          "Konut Fiyat Endeksi": s.kfeYillikPct,
          "Bono Piyasa Toplam Değeri": s.bonoYillikPct,
        }),
      ),
    [satirlar, aralik2],
  );

  const ozetSatirlari = useMemo(() => {
    function aySub(ay: string, ayFark: number): string {
      const [y, m] = ay.split("-").map(Number);
      const toplam = y * 12 + (m - 1) - ayFark;
      const ny = Math.floor(toplam / 12);
      const nm = (toplam % 12) + 1;
      return `${ny}-${String(nm).padStart(2, "0")}`;
    }
    function ozet(anahtar: "TÜFE" | "M2" | "KFE" | "Bono", secici: (s: AylikSatir) => number | null) {
      const dolular = satirlar.filter((s) => secici(s) != null);
      if (dolular.length === 0) return { seri: anahtar, son: null, uc: null, yil: null };
      const sonSatir = dolular[dolular.length - 1];
      const sonAy = sonSatir.ay;
      const ucIdx = dolular.findLastIndex((s) => s.ay <= aySub(sonAy, 3));
      const yilIdx = dolular.findLastIndex((s) => s.ay <= aySub(sonAy, 12));
      return {
        seri: anahtar,
        son: secici(sonSatir),
        uc: ucIdx >= 0 ? secici(dolular[ucIdx]) : null,
        yil: yilIdx >= 0 ? secici(dolular[yilIdx]) : null,
      };
    }
    return [
      ozet("TÜFE", (s) => s.tufeYillikPct),
      ozet("M2", (s) => s.m2YillikPct),
      ozet("KFE", (s) => s.kfeYillikPct),
      ozet("Bono", (s) => s.bonoYillikPct),
    ];
  }, [satirlar]);

  const goster12Ay = [...satirlar].filter((s) => s.m2 != null).slice(-12).reverse();

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">TÜFE yıllık</p>
          <p className="font-figures text-xl font-semibold">{pct2(son.tufeYillikPct)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">TÜFE aylık</p>
          <p className="font-figures text-xl font-semibold">{pct2(son.tufeAylikPct)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">C çekirdek yıllık</p>
          <p className="font-figures text-xl font-semibold">{pct2(son.cYillikPct)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">C çekirdek aylık</p>
          <p className="font-figures text-xl font-semibold">{pct2(son.cAylikPct)}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Son veri tarihi: {son.ay} -- &quot;C&quot; TCMB&apos;nin özel kapsamlı çekirdek enflasyon göstergesi (enerji,
        gıda ve alkolsüz içecekler, alkollü içkiler ile tütün ürünleri ve altın hariç TÜFE).
      </p>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Yıllık enflasyon (%)</h3>
          <AralikSecici secili={aralik1} onSec={setAralik1} />
        </div>
        <CokluCizgiGrafigi
          veri={enflasyonVerisi}
          seriler={[
            { anahtar: "TÜFE", etiket: "TÜFE" },
            { anahtar: "C çekirdek", etiket: "C çekirdek" },
          ]}
          birim="%"
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold">M2 para arzı ve Konut Fiyat Endeksi -- nominal ve reel getiriler</h3>
        <p className="text-xs text-muted-foreground">Reel getiri = (1 + Nominal Değişim) / (1 + TÜFE Değişim) - 1.</p>

        <button
          type="button"
          onClick={() => setTabloAcik((v) => !v)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {tabloAcik ? "▾" : "▸"} M2 Para Arzı ve Konut Fiyat Endeksi -- Nominal ve Reel Getiriler ({goster12Ay.length}{" "}
          / son 12 satır)
        </button>
        {tabloAcik && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="whitespace-nowrap px-2 py-1.5">Ay</th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right">M2 Aylık %</th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right">M2 Reel Aylık %</th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right">M2 Yıllık %</th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right">M2 Reel Yıllık %</th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right">KFE Aylık %</th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right">KFE Reel Aylık %</th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right">KFE Yıllık %</th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right">KFE Reel Yıllık %</th>
                </tr>
              </thead>
              <tbody>
                {goster12Ay.map((s) => (
                  <tr key={s.ay} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-2 py-1 font-figures">{s.ay}</td>
                    <td className="px-2 py-1 text-right font-figures">{pctIsaretli(s.m2AylikPct)}</td>
                    <td className="px-2 py-1 text-right font-figures">{pctIsaretli(s.m2ReelAylikPct)}</td>
                    <td className="px-2 py-1 text-right font-figures">{pctIsaretli(s.m2YillikPct)}</td>
                    <td className="px-2 py-1 text-right font-figures">{pctIsaretli(s.m2ReelYillikPct)}</td>
                    <td className="px-2 py-1 text-right font-figures">{pctIsaretli(s.kfeAylikPct)}</td>
                    <td className="px-2 py-1 text-right font-figures">{pctIsaretli(s.kfeReelAylikPct)}</td>
                    <td className="px-2 py-1 text-right font-figures">{pctIsaretli(s.kfeYillikPct)}</td>
                    <td className="px-2 py-1 text-right font-figures">{pctIsaretli(s.kfeReelYillikPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold">Yıllık değişim karşılaştırması</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Seri</th>
                <th className="px-3 py-2 text-right font-medium">Son</th>
                <th className="px-3 py-2 text-right font-medium">3 Ay Önce</th>
                <th className="px-3 py-2 text-right font-medium">1 Yıl Önce</th>
              </tr>
            </thead>
            <tbody>
              {ozetSatirlari.map((o) => (
                <tr key={o.seri} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2">{o.seri}</td>
                  <td className="px-3 py-2 text-right font-figures">{pctIsaretli(o.son)}</td>
                  <td className="px-3 py-2 text-right font-figures">{pctIsaretli(o.uc)}</td>
                  <td className="px-3 py-2 text-right font-figures">{pctIsaretli(o.yil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <AralikSecici secili={aralik2} onSec={setAralik2} />
        </div>
        <CokluCizgiGrafigi
          veri={karsilastirmaVerisi}
          seriler={[
            { anahtar: "TÜFE", etiket: "TÜFE" },
            { anahtar: "M2 Para Arzı", etiket: "M2 Para Arzı" },
            { anahtar: "Konut Fiyat Endeksi", etiket: "Konut Fiyat Endeksi" },
            { anahtar: "Bono Piyasa Toplam Değeri", etiket: "Bono Piyasa Toplam Değeri" },
          ]}
          birim="%"
        />
      </div>
    </div>
  );
}
