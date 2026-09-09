"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SenetBadge } from "@/components/senet-badge";
import { utcTarihe } from "@/lib/tarih";
import {
  birikmisFaizHesapla,
  getiriBul,
} from "@/lib/bond-math/tahvil-fiyatlama";
import { nelsonSiegelFit, polinom2Fit, rvEkraniOlustur, tlrefBilesikFonlama } from "@/lib/rv-analiz";
import { yuzde } from "@/lib/bicim";

type OzetSatiri = {
  isin: string; senet_tanimi: string | null; vade_tarihi: string | null; para_birimi: string | null;
  tahmini_kupon_orani: number | null; ilk_valor_tarihi: string | null; ilk_ihrac_tarihi: string | null;
};
type BistSatiri = { tarih: string; isin: string; temiz_fiyat: number | null; kapanis_bilesik_getiri_pct: number | null; islem_hacmi_tl: number | null };

type EgriNokta = { isin: string; senetTanimi: string | null; vade: Date | null; kalanVadeYil: number; getiri: number };

const RENKLER = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
const HACIM_SECENEKLERI = [
  { etiket: "Tümü", deger: 0 },
  { etiket: "≥10 milyon TL", deger: 10_000_000 },
  { etiket: "≥50 milyon TL", deger: 50_000_000 },
  { etiket: "≥100 milyon TL", deger: 100_000_000 },
  { etiket: "≥250 milyon TL", deger: 250_000_000 },
];

function tarihFmt(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("tr-TR", { timeZone: "UTC" });
}
function bp(v: number | null): string {
  return v == null || !Number.isFinite(v) ? "–" : `${v >= 0 ? "+" : ""}${v.toFixed(0)}`;
}

/** Uyarlanan eğriyi (polinom / Nelson-Siegel) çizebilmek için, verinin vade
 *  aralığı boyunca eşit aralıklı örnekler üretir. */
function egriNoktalariUret(
  noktalar: { kalanVadeYil: number }[],
  tahmin: (t: number) => number | null,
  adet = 80,
): { kalanVadeYil: number; egri: number }[] {
  if (noktalar.length === 0) return [];
  const vadeler = noktalar.map((n) => n.kalanVadeYil).filter(Number.isFinite);
  if (vadeler.length === 0) return [];
  const min = Math.min(...vadeler);
  const max = Math.max(...vadeler);
  if (!(max > min)) return [];
  const cikti: { kalanVadeYil: number; egri: number }[] = [];
  for (let i = 0; i <= adet; i++) {
    const t = min + ((max - min) * i) / adet;
    const y = tahmin(t);
    if (y != null && Number.isFinite(y)) cikti.push({ kalanVadeYil: t, egri: y });
  }
  return cikti;
}

type NoktaTooltipPayload = { isin: string; senetTanimi?: string | null; kalanVadeYil: number; getiri: number; zSkoru?: number };

function NoktaTooltip({ active, payload }: { active?: boolean; payload?: { payload: NoktaTooltipPayload }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, padding: "8px 10px" }}>
      <div style={{ fontWeight: 600, fontFamily: "var(--font-figures, monospace)" }}>{p.isin}</div>
      {p.senetTanimi && <div style={{ color: "var(--muted-foreground)" }}>{p.senetTanimi}</div>}
      <div>Kalan vade: {p.kalanVadeYil.toFixed(2)} yıl</div>
      <div>Getiri: %{p.getiri.toFixed(2)}</div>
      {p.zSkoru != null && <div>Z-skoru: {p.zSkoru >= 0 ? "+" : ""}{p.zSkoru.toFixed(2)}</div>}
    </div>
  );
}

/** Bugünün UTC gün damgası (YYYY-MM-DD). String döndüğü için render'lar
 *  arasında kararlı -- Date nesnesinin aksine memo bağımlılığı olabiliyor. */
function bugununIsoGunu(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

export function GetiriEgrisiClient({
  isinOzet, bist, tlrefSonPct,
}: {
  isinOzet: OzetSatiri[]; bist: BistSatiri[]; tlrefSonPct: number | null;
}) {
  const vadeBilgi = useMemo(() => {
    const m = new Map<string, { senetTanimi: string | null; vade: Date | null; kupon: number | null; anchor: Date | null }>();
    for (const r of isinOzet) {
      m.set(r.isin, {
        senetTanimi: r.senet_tanimi,
        vade: utcTarihe(r.vade_tarihi),
        kupon: r.tahmini_kupon_orani,
        anchor: utcTarihe(r.ilk_valor_tarihi ?? r.ilk_ihrac_tarihi),
      });
    }
    return m;
  }, [isinOzet]);

  const tarihler = useMemo(() => Array.from(new Set(bist.map((r) => r.tarih))).sort().reverse(), [bist]);

  const [mod, setMod] = useState<"kapanis" | "canli">("kapanis");
  const [gosterim, setGosterim] = useState<"grafik" | "tablo">("grafik");
  const [minHacim, setMinHacim] = useState(50_000_000);
  const [seciliTarih, setSeciliTarih] = useState(tarihler[0] ?? "");

  const egriVerisi = useCallback((tarih: string, minHacimTl: number): EgriNokta[] => {
    const referans = utcTarihe(tarih)!;
    return bist
      .filter((r) => r.tarih === tarih && (minHacimTl <= 0 || (r.islem_hacmi_tl ?? 0) >= minHacimTl))
      .map((r): EgriNokta | null => {
        const v = vadeBilgi.get(r.isin);
        if (!v?.vade || r.kapanis_bilesik_getiri_pct == null) return null;
        const kalanVadeYil = (v.vade.getTime() - referans.getTime()) / (365 * 86_400_000);
        if (kalanVadeYil <= 0) return null;
        return { isin: r.isin, senetTanimi: v.senetTanimi, vade: v.vade, kalanVadeYil, getiri: Number(r.kapanis_bilesik_getiri_pct) };
      })
      .filter((r): r is EgriNokta => r != null)
      .sort((a, b) => a.kalanVadeYil - b.kalanVadeYil);
  }, [bist, vadeBilgi]);

  const canliEgriVerisi = useCallback((minHacimTl: number, bugunIso: string): EgriNokta[] => {
    if (!tarihler.length) return [];
    const sonTarih = tarihler[0];
    const sonKapanisIsinleri = new Set(
      bist.filter((r) => r.tarih === sonTarih && (minHacimTl <= 0 || (r.islem_hacmi_tl ?? 0) >= minHacimTl)).map((r) => r.isin),
    );
    // Başlıkta gösterilen referans günle AYNI gün kullanılıyor (ayrı bir
    // `new Date()` üretilirse gece yarısını geçen bir oturumda ikisi
    // ayrışabiliyordu).
    const bugunUtc = utcTarihe(bugunIso)!;

    const enSonPerIsin = new Map<string, BistSatiri>();
    for (const r of bist) {
      if (!sonKapanisIsinleri.has(r.isin)) continue;
      const mevcut = enSonPerIsin.get(r.isin);
      if (!mevcut || r.tarih > mevcut.tarih) enSonPerIsin.set(r.isin, r);
    }

    const sonuc: EgriNokta[] = [];
    for (const [isin, r] of enSonPerIsin) {
      const v = vadeBilgi.get(isin);
      if (!v?.vade || r.temiz_fiyat == null) continue;
      const kalanVadeYil = (v.vade.getTime() - bugunUtc.getTime()) / (365 * 86_400_000);
      if (kalanVadeYil <= 0) continue;

      let getiri = r.kapanis_bilesik_getiri_pct != null ? Number(r.kapanis_bilesik_getiri_pct) : null;
      if (v.kupon != null && v.anchor) {
        try {
          const kuponOrani = v.kupon / 100;
          const birikmis = birikmisFaizHesapla(v.vade, v.anchor, bugunUtc, kuponOrani);
          const kirli = Number(r.temiz_fiyat) + birikmis;
          getiri = getiriBul(v.vade, v.anchor, bugunUtc, kuponOrani, kirli) * 100;
        } catch {
          // reprice başarısız -- ham kapanış getirisine düş
        }
      }
      if (getiri == null || !Number.isFinite(getiri)) continue;
      sonuc.push({ isin, senetTanimi: v.senetTanimi, vade: v.vade, kalanVadeYil, getiri });
    }
    return sonuc.sort((a, b) => a.kalanVadeYil - b.kalanVadeYil);
  }, [bist, tarihler, vadeBilgi]);

  // Referans gün ISO STRING olarak tutuluyor: "canlı" modda her render'da
  // `new Date()` üretmek Date nesnesinin kimliğini değiştirip aşağıdaki tüm
  // useMemo'ları geçersiz kılıyordu (React Compiler da bu yüzden bu bileşeni
  // optimize etmeden geçiyordu). Eğri yalnızca GÜNÜ kullandığından saat
  // bilgisi zaten gereksiz.
  const referansIso = mod === "canli" ? bugununIsoGunu() : seciliTarih;
  const referansTarihDate = useMemo(
    () => utcTarihe(referansIso) ?? new Date(),
    [referansIso],
  );
  const gunluk = useMemo(
    () =>
      mod === "canli"
        ? canliEgriVerisi(minHacim, referansIso)
        : egriVerisi(seciliTarih, minHacim),
    [mod, minHacim, seciliTarih, referansIso, canliEgriVerisi, egriVerisi],
  );
  const baslik =
    mod === "canli"
      ? `${tarihFmt(referansTarihDate)} getiri eğrisi (canlı — her ISIN'in son bilinen fiyatı sabit tutulup bugünün kalan vadesi/birikmiş faiziyle yeniden çözüldü)`
      : `${tarihFmt(referansTarihDate)} getiri eğrisi`;

  // --- Karşılaştırma tarihleri ---
  const karsilastirmaSecenekleri = useMemo(
    () => tarihler.filter((t) => new Date(t).getTime() < referansTarihDate.getTime()),
    [tarihler, referansTarihDate],
  );
  const varsayilanKarsilastirma = useMemo(() => {
    const hedef = referansTarihDate.getTime() - 7 * 86_400_000;
    const aday = karsilastirmaSecenekleri.filter((t) => new Date(t).getTime() <= hedef);
    return aday.length ? [aday[0]] : [];
  }, [karsilastirmaSecenekleri, referansTarihDate]);
  const [karsilastirmaTarihleri, setKarsilastirmaTarihleri] = useState<string[]>(varsayilanKarsilastirma);

  function hizliEkle(gunFarki: number) {
    const hedef = referansTarihDate.getTime() - gunFarki * 86_400_000;
    const aday = karsilastirmaSecenekleri.filter((t) => new Date(t).getTime() <= hedef);
    if (!aday.length) return;
    const eklenecek = aday[0];
    setKarsilastirmaTarihleri((liste) => (liste.includes(eklenecek) ? liste : [...liste, eklenecek]));
  }
  function tarihToggle(t: string) {
    setKarsilastirmaTarihleri((liste) => (liste.includes(t) ? liste.filter((x) => x !== t) : [...liste, t]));
  }

  const [yeniTarihGirisi, setYeniTarihGirisi] = useState("");
  function yaziliTarihEkle() {
    if (!yeniTarihGirisi) return;
    const hedef = new Date(yeniTarihGirisi).getTime();
    const aday = karsilastirmaSecenekleri.filter((t) => new Date(t).getTime() <= hedef);
    if (!aday.length) return;
    const eklenecek = aday[0];
    setKarsilastirmaTarihleri((liste) => (liste.includes(eklenecek) ? liste : [...liste, eklenecek]));
    setYeniTarihGirisi("");
  }

  const egriler = karsilastirmaTarihleri
    .map((t, i) => ({ etiket: tarihFmt(t), veri: egriVerisi(t, minHacim), renk: RENKLER[(i + 1) % RENKLER.length] }))
    .filter((e) => e.veri.length > 0);

  // Karşılaştırma grafiğinde iki eğri üst üste çiziliyordu ama aralarındaki
  // FARK okunamıyordu -- steepener/flattener tam olarak bu farkın vade boyunca
  // nasıl değiştiğidir. Her karşılaştırma günü için, iki tarihte de işlem gören
  // ISIN'lerin getiri farkı (bps) vadeye göre ayrı bir panelde çiziliyor.
  const spreadSerileri = egriler.map((e) => {
    const referansHarita = new Map(gunluk.map((r) => [r.isin, r]));
    const noktalar = e.veri
      .map((es) => {
        const ref = referansHarita.get(es.isin);
        if (!ref) return null;
        return {
          isin: es.isin,
          senetTanimi: ref.senetTanimi,
          kalanVadeYil: ref.kalanVadeYil,
          farkBps: (ref.getiri - es.getiri) * 100,
        };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null)
      .sort((a, b) => a.kalanVadeYil - b.kalanVadeYil);
    return { etiket: e.etiket, renk: e.renk, noktalar };
  }).filter((s) => s.noktalar.length > 0);

  // Çubuk grafik, çizginin aksine seri başına ayrı `data` kabul etmiyor:
  // tüm karşılaştırma günleri ISIN bazında TEK veri kümesinde birleştiriliyor
  // (her karşılaştırma günü ayrı bir kolon/dataKey oluyor).
  const spreadVerisi = (() => {
    const satirlar = new Map<string, Record<string, string | number | null>>();
    for (const s of spreadSerileri) {
      for (const n of s.noktalar) {
        let satir = satirlar.get(n.isin);
        if (!satir) {
          satir = { isin: n.isin, senetTanimi: n.senetTanimi ?? "", kalanVadeYil: n.kalanVadeYil };
          satirlar.set(n.isin, satir);
        }
        satir[s.etiket] = n.farkBps;
      }
    }
    return [...satirlar.values()].sort(
      (a, b) => Number(a.kalanVadeYil) - Number(b.kalanVadeYil),
    );
  })();

  // --- RV z-skoru (2. derece polinom) ---
  // Fit bir kez hesaplanıyor; hem satırların spread/z-skoru hem de grafikte
  // çizilen eğri aynı fit'ten türüyor (önce grafikte sadece noktalar vardı,
  // uyarlanan eğrinin kendisi görünmüyordu).
  const rvPoliSonuc = useMemo(() => {
    if (gunluk.length < 5) return null;
    const fit = polinom2Fit(gunluk.map((r) => r.kalanVadeYil), gunluk.map((r) => r.getiri));
    if (!fit) return null;
    const satirlar = gunluk.map((r) => {
      const egriBeklenen = fit(r.kalanVadeYil);
      const spreadBps = (r.getiri - egriBeklenen) * 100;
      return { ...r, egriBeklenen, spreadBps };
    });
    const ortalama = satirlar.reduce((s, r) => s + r.spreadBps, 0) / satirlar.length;
    const std = Math.sqrt(satirlar.reduce((s, r) => s + (r.spreadBps - ortalama) ** 2, 0) / satirlar.length);
    return {
      satirlar: satirlar.map((r) => ({ ...r, zSkoru: std ? (r.spreadBps - ortalama) / std : 0 })),
      egri: egriNoktalariUret(gunluk, fit),
    };
  }, [gunluk]);
  const rvPoli = rvPoliSonuc?.satirlar ?? null;

  // --- Nelson-Siegel RV ekranı ---
  const kuponMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const [isin, v] of vadeBilgi) if (v.kupon != null) m.set(isin, v.kupon);
    return m;
  }, [vadeBilgi]);
  const anchorMap = useMemo(() => {
    const m = new Map<string, Date>();
    for (const [isin, v] of vadeBilgi) if (v.anchor) m.set(isin, v.anchor);
    return m;
  }, [vadeBilgi]);
  const fonlama = tlrefSonPct != null ? tlrefBilesikFonlama(tlrefSonPct) : null;
  const rvNs = useMemo(
    () => rvEkraniOlustur(gunluk, kuponMap, anchorMap, fonlama, referansTarihDate, 3),
    [gunluk, kuponMap, anchorMap, fonlama, referansTarihDate],
  );
  const nsFit = rvNs && rvNs.length >= 5 ? nelsonSiegelFit(rvNs.map((r) => r.kalanVadeYil), rvNs.map((r) => r.getiri)) : null;
  const nsEgriNoktalari = useMemo(
    () => (rvNs && nsFit ? egriNoktalariUret(rvNs, (t) => nsFit.tahmin(t) as number) : []),
    [rvNs, nsFit],
  );

  if (tarihler.length === 0) {
    return <p className="text-sm text-muted-foreground">BIST fiyat verisi bulunamadı.</p>;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Görünüm</label>
              <div className="flex gap-1 rounded-md border border-input p-1">
                <Button type="button" size="sm" variant={mod === "kapanis" ? "default" : "ghost"} onClick={() => setMod("kapanis")}>Son kapanışa göre</Button>
                <Button type="button" size="sm" variant={mod === "canli" ? "default" : "ghost"} onClick={() => setMod("canli")}>Bugüne göre (canlı)</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Gösterim</label>
              <div className="flex gap-1 rounded-md border border-input p-1">
                <Button type="button" size="sm" variant={gosterim === "grafik" ? "default" : "ghost"} onClick={() => setGosterim("grafik")}>Grafik</Button>
                <Button type="button" size="sm" variant={gosterim === "tablo" ? "default" : "ghost"} onClick={() => setGosterim("tablo")}>Tablo</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="ge-hacim">Min. günlük hacim</label>
              <select id="ge-hacim" value={minHacim} onChange={(e) => setMinHacim(Number(e.target.value))} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                {HACIM_SECENEKLERI.map((h) => (
                  <option key={h.deger} value={h.deger}>{h.etiket}</option>
                ))}
              </select>
            </div>
            {mod === "kapanis" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground" htmlFor="ge-tarih">Tarih</label>
                <select id="ge-tarih" value={seciliTarih} onChange={(e) => setSeciliTarih(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm font-figures">
                  {tarihler.map((t) => (
                    <option key={t} value={t}>{tarihFmt(t)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {gunluk.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu tarihte eğri çizmek için yeterli veri yok (getiri veya vade eksik).</p>
          ) : gosterim === "tablo" ? (
            <div className="max-h-[460px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
              <p className="border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{baslik}</p>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>ISIN</TableHead>
                    <TableHead>Kağıt tipi</TableHead>
                    <TableHead className="text-right">Kalan vade (yıl)</TableHead>
                    <TableHead className="text-right">Bileşik getiri (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gunluk.map((r) => (
                    <TableRow key={r.isin}>
                      <TableCell className="font-figures">{r.isin}</TableCell>
                      <TableCell><SenetBadge tanim={r.senetTanimi} /></TableCell>
                      <TableCell className="font-figures text-right">{r.kalanVadeYil.toFixed(2)}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(r.getiri)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">{baslik}</p>
              <ResponsiveContainer width="100%" height={420}>
                <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" dataKey="kalanVadeYil" name="Kalan vade" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `${Number(v).toFixed(1)} yıl`} domain={["dataMin - 0.2", "dataMax + 0.2"]} />
                  <YAxis type="number" dataKey="getiri" name="Getiri" unit="%" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={48} domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                  <Tooltip content={<NoktaTooltip />} />
                  <Scatter data={gunluk} fill="var(--chart-1)" line={{ stroke: "var(--chart-1)", strokeWidth: 2 }} lineType="joint" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {gunluk.length > 0 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-lg font-semibold">Eğri karşılaştırması (steepener / flattener takibi)</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => hizliEkle(7)}>+ 1 hafta önce</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => hizliEkle(30)}>+ 1 ay önce</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => hizliEkle(90)}>+ 3 ay önce</Button>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground" htmlFor="ge-karsilastirma-tarih">
                Karşılaştırma tarihi ekle (istediğin kadar ekleyebilirsin)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="ge-karsilastirma-tarih"
                  type="date"
                  value={yeniTarihGirisi}
                  onChange={(e) => setYeniTarihGirisi(e.target.value)}
                  min={karsilastirmaSecenekleri[karsilastirmaSecenekleri.length - 1] ?? undefined}
                  max={karsilastirmaSecenekleri[0] ?? undefined}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm font-figures"
                />
                <Button type="button" size="sm" onClick={yaziliTarihEkle} disabled={!yeniTarihGirisi}>Ekle</Button>
              </div>
              {karsilastirmaTarihleri.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {karsilastirmaTarihleri.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => tarihToggle(t)}
                      title="Kaldırmak için tıkla"
                      className="rounded-full bg-primary px-2.5 py-1 text-xs font-figures text-primary-foreground transition-opacity hover:opacity-80"
                    >
                      {tarihFmt(t)} ✕
                    </button>
                  ))}
                </div>
              )}
            </div>

            {egriler.length === 0 ? (
              <p className="text-sm text-muted-foreground">Karşılaştırmak için en az bir tarih seç.</p>
            ) : gosterim === "tablo" ? (
              <div className="max-h-[460px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>ISIN</TableHead>
                      <TableHead className="text-right">Kalan vade (yıl)</TableHead>
                      <TableHead className="text-right">{tarihFmt(referansTarihDate)} (%)</TableHead>
                      {egriler.map((e) => (
                        <TableHead key={e.etiket} className="text-right">{e.etiket} (%) / Δ (bp)</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gunluk.map((r) => (
                      <TableRow key={r.isin}>
                        <TableCell className="font-figures">{r.isin}</TableCell>
                        <TableCell className="font-figures text-right">{r.kalanVadeYil.toFixed(2)}</TableCell>
                        <TableCell className="font-figures text-right">{yuzde(r.getiri)}</TableCell>
                        {egriler.map((e) => {
                          const es = e.veri.find((x) => x.isin === r.isin);
                          const delta = es ? (r.getiri - es.getiri) * 100 : null;
                          return (
                            <TableCell key={e.etiket} className="font-figures text-right">
                              {es ? `${yuzde(es.getiri)} / ${bp(delta)}` : "–"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={420}>
                <ComposedChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" dataKey="kalanVadeYil" name="Kalan vade" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `${Number(v).toFixed(1)} yıl`} domain={["dataMin - 0.2", "dataMax + 0.2"]} />
                  <YAxis type="number" dataKey="getiri" unit="%" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={48} domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => (typeof v === "number" ? `%${v.toFixed(2)}` : v)}
                    labelFormatter={(v) => (typeof v === "number" ? `Kalan vade: ${v.toFixed(2)} yıl` : String(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line data={gunluk} type="linear" dataKey="getiri" name={tarihFmt(referansTarihDate)} stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 3 }} />
                  {egriler.map((e) => (
                    <Line key={e.etiket} data={e.veri} type="linear" dataKey="getiri" name={e.etiket} stroke={e.renk} strokeDasharray="4 3" dot={{ r: 2 }} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {gosterim === "grafik" && spreadSerileri.length > 0 && (
              <div className="space-y-1.5 border-t border-border pt-4">
                <h3 className="text-sm font-semibold">
                  Spread farkı — {tarihFmt(referansTarihDate)} eksi karşılaştırma günü (bps)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Sıfır çizgisinin üstü: getiri o günden bu yana yükselmiş. Eğrinin kısa vadede aşağı,
                  uzun vadede yukarı gitmesi <b>steepener</b>; tersi <b>flattener</b> hareketidir.
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={spreadVerisi} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" dataKey="kalanVadeYil" name="Kalan vade" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `${Number(v).toFixed(1)} yıl`} domain={["dataMin - 0.2", "dataMax + 0.2"]} />
                    <YAxis type="number" unit=" bp" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={64} domain={["dataMin - 5", "dataMax + 5"]} tickFormatter={(v) => Number(v).toFixed(0)} />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v) => (typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(0)} bp` : v)}
                      labelFormatter={(v, yuk) => {
                        const p = yuk?.[0]?.payload as { isin?: string; kalanVadeYil?: number } | undefined;
                        const vade = p?.kalanVadeYil != null ? `${p.kalanVadeYil.toFixed(2)} yıl` : String(v);
                        return p?.isin ? `${p.isin} — ${vade}` : vade;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                    {/* Bloomberg terminalindeki gibi spread ÇUBUK olarak: sıfır
                        çizgisinden yukarı/aşağı uzayan İNCE çubuklar. X ekseni
                        kategori değil SAYISAL -- çubuklar gerçek vade konumunda
                        durup üstteki eğri grafiğiyle aynı hizaya geliyor. */}
                    {spreadSerileri.map((s) => (
                      <Bar key={s.etiket} dataKey={s.etiket} name={`Δ ${s.etiket}`} fill={s.renk} barSize={13} />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            {egriler.length > 0 && gosterim === "grafik" && (
              <p className="text-xs text-muted-foreground">
                Pozitif Δ = o kağıdın getirisi karşılaştırma gününe göre yükselmiş (kısa vadede negatif / uzun
                vadede pozitif — ya da tersi — steepener/flattener hareketidir). Tablo görünümünde spread (bp)
                değerleri de listelenir.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {rvPoli && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <h2 className="text-lg font-semibold">Relative value (eğriye göre z-skoru)</h2>
              <p className="text-sm text-muted-foreground">
                Pozitif z-skoru = getirisi eğrinin üstünde, yani emsallerine göre <b>UCUZ</b>. Negatif z-skoru =
                eğrinin altında, yani <b>PAHALI</b>.
              </p>
            </div>

            {gosterim === "tablo" ? (
              <div className="max-h-[460px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>ISIN</TableHead>
                      <TableHead>Kağıt tipi</TableHead>
                      <TableHead className="text-right">Kalan vade (yıl)</TableHead>
                      <TableHead className="text-right">Getiri (%)</TableHead>
                      <TableHead className="text-right">Eğri beklentisi (%)</TableHead>
                      <TableHead className="text-right">Spread (bps)</TableHead>
                      <TableHead className="text-right">Z-skoru</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...rvPoli].sort((a, b) => b.zSkoru - a.zSkoru).map((r) => (
                      <TableRow key={r.isin}>
                        <TableCell className="font-figures">{r.isin}</TableCell>
                        <TableCell><SenetBadge tanim={r.senetTanimi} /></TableCell>
                        <TableCell className="font-figures text-right">{r.kalanVadeYil.toFixed(2)}</TableCell>
                        <TableCell className="font-figures text-right">{yuzde(r.getiri)}</TableCell>
                        <TableCell className="font-figures text-right">{yuzde(r.egriBeklenen)}</TableCell>
                        <TableCell className="font-figures text-right">{bp(r.spreadBps)}</TableCell>
                        <TableCell className="font-figures text-right">{r.zSkoru >= 0 ? "+" : ""}{r.zSkoru.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={440}>
                <ComposedChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" dataKey="kalanVadeYil" name="Kalan vade" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `${Number(v).toFixed(1)} yıl`} domain={["dataMin - 0.2", "dataMax + 0.2"]} allowDuplicatedCategory={false} />
                  <YAxis type="number" dataKey="getiri" name="Getiri" unit="%" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={48} domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                  <ZAxis dataKey="zSkoru" range={[40, 200]} />
                  <Tooltip content={<NoktaTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line data={rvPoliSonuc?.egri ?? []} dataKey="egri" name="Uyarlanan eğri (2. derece polinom)" type="monotone" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={false} legendType="line" />
                  <Scatter name="Ucuz (z>0)" data={rvPoli.filter((r) => r.zSkoru >= 0)} fill="var(--pozitif)" />
                  <Scatter name="Pahalı (z<0)" data={rvPoli.filter((r) => r.zSkoru < 0)} fill="var(--negatif)" />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="space-y-2 pt-6">
                  <p className="text-sm font-semibold text-emerald-600">En ucuz — eğrinin üstünde</p>
                  <p className="text-xs text-muted-foreground">En düşük fiyatlı (emsallerine göre en yüksek getirili) 5 ISIN</p>
                  <div className="space-y-1">
                    {[...rvPoli].sort((a, b) => b.zSkoru - a.zSkoru).slice(0, 5).map((r) => (
                      <div key={r.isin} className="flex justify-between text-sm font-figures">
                        <span>{r.isin}</span>
                        <span>{bp(r.spreadBps)} bps / {r.zSkoru >= 0 ? "+" : ""}{r.zSkoru.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-2 pt-6">
                  <p className="text-sm font-semibold text-destructive">En pahalı — eğrinin altında</p>
                  <p className="text-xs text-muted-foreground">En yüksek fiyatlı (emsallerine göre en düşük getirili) 5 ISIN</p>
                  <div className="space-y-1">
                    {[...rvPoli].sort((a, b) => a.zSkoru - b.zSkoru).slice(0, 5).map((r) => (
                      <div key={r.isin} className="flex justify-between text-sm font-figures">
                        <span>{r.isin}</span>
                        <span>{bp(r.spreadBps)} bps / {r.zSkoru >= 0 ? "+" : ""}{r.zSkoru.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {rvNs && rvNs.length > 0 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-lg font-semibold">Nelson-Siegel</h2>
            <div className="max-h-[460px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>ISIN</TableHead>
                    <TableHead className="text-right">Vade (yıl)</TableHead>
                    <TableHead className="text-right">Getiri (%)</TableHead>
                    <TableHead className="text-right">NS eğri (%)</TableHead>
                    <TableHead className="text-right">Spread (bps)</TableHead>
                    <TableHead className="text-right">Z</TableHead>
                    <TableHead className="text-right">ModDur</TableHead>
                    <TableHead className="text-right">Carry (bp)</TableHead>
                    <TableHead className="text-right">Roll (bp)</TableHead>
                    <TableHead className="text-right">Konverjans (bp)</TableHead>
                    <TableHead className="text-right">Toplam (bp)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...rvNs].sort((a, b) => (b.toplamBp ?? -Infinity) - (a.toplamBp ?? -Infinity)).map((r) => (
                    <TableRow key={r.isin}>
                      <TableCell className="font-figures">{r.isin}</TableCell>
                      <TableCell className="font-figures text-right">{r.kalanVadeYil.toFixed(2)}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(r.getiri)}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(r.egriBeklenen)}</TableCell>
                      <TableCell className="font-figures text-right">{bp(r.spreadBps)}</TableCell>
                      <TableCell className="font-figures text-right">{r.zSkoru >= 0 ? "+" : ""}{r.zSkoru.toFixed(2)}</TableCell>
                      <TableCell className="font-figures text-right">{r.modDur != null ? r.modDur.toFixed(2) : "–"}</TableCell>
                      <TableCell className="font-figures text-right">{bp(r.carryBp)}</TableCell>
                      <TableCell className="font-figures text-right">{bp(r.rollBp)}</TableCell>
                      <TableCell className="font-figures text-right">{bp(r.konverjansBp)}</TableCell>
                      <TableCell className="font-figures text-right">{bp(r.toplamBp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {nsFit && (
              <ResponsiveContainer width="100%" height={440}>
                <ComposedChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" dataKey="kalanVadeYil" name="Kalan vade" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `${Number(v).toFixed(1)} yıl`} domain={["dataMin - 0.2", "dataMax + 0.2"]} allowDuplicatedCategory={false} />
                  <YAxis type="number" dataKey="getiri" name="Getiri" unit="%" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={48} domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                  <Tooltip content={<NoktaTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line data={nsEgriNoktalari} dataKey="egri" name="Nelson-Siegel eğrisi" type="monotone" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={false} legendType="line" />
                  <Scatter name="Ucuz (z>0)" data={rvNs.filter((r) => r.zSkoru >= 0)} fill="var(--pozitif)" />
                  <Scatter name="Pahalı (z<0)" data={rvNs.filter((r) => r.zSkoru < 0)} fill="var(--negatif)" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
