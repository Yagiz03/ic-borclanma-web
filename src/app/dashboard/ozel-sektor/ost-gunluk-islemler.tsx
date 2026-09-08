"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isoTarihGoster } from "@/lib/tarih";

const FIYAT_ANOMALI_ESIK_PCT = 3.0;
const GETIRI_ANOMALI_ESIK_BPS = 300.0;
const MAX_KARSILASTIRMA_GUN = 45;
const KUPON_RESET_TOLERANS_GUN = 3;
const KUPON_RESET_PAR_TOLERANS = 3.0;

type BistSatiri = {
  tarih: string;
  isin: string;
  temiz_fiyat: number | null;
  ag_ort_takas_fiyati: number | null;
  kapanis_bilesik_getiri_pct: number | null;
  birikmis_faiz: number | null;
  islem_hacmi_tl: number | null;
  miktar: number | null;
};

type MkbSatiri = {
  isin: string;
  ihracci_kurum: string | null;
  mk_turu: string | null;
  getiri_turu: string | null;
  toplam_ihrac_tutari_bin: number | null;
  itfa_tarihi: string | null;
  kupon_sikligi: string | null;
  ilk_ihrac_tarihi: string | null;
};

function yuzde(v: number | null): string {
  return v == null || !Number.isFinite(v) ? "–" : `%${v.toFixed(2)}`;
}
function sayi(v: number | null, ondalik = 0): string {
  return v == null ? "–" : v.toLocaleString("tr-TR", { maximumFractionDigits: ondalik });
}

function trTarihiParcala(s: string | null): Date | null {
  if (!s) return null;
  const [g, a, y] = s.split(".").map(Number);
  if (!g || !a || !y) return null;
  return new Date(Date.UTC(y, a - 1, g));
}

function kuponAraliginaMi(ilkIhrac: string | null, kuponSikligi: string | null, oncekiTarih: string, buguninTarih: string): boolean {
  const siklik = kuponSikligi != null ? Number(kuponSikligi) : NaN;
  if (!Number.isFinite(siklik) || siklik <= 0) return false;
  const ilkIhracDate = trTarihiParcala(ilkIhrac);
  if (!ilkIhracDate) return false;
  const periyotGun = Math.round(365 / siklik);
  if (periyotGun <= 0) return false;

  const oncekiMs = new Date(oncekiTarih).getTime() - KUPON_RESET_TOLERANS_GUN * 86_400_000;
  const bugunMs = new Date(buguninTarih).getTime() + KUPON_RESET_TOLERANS_GUN * 86_400_000;
  let d = ilkIhracDate.getTime() + periyotGun * 86_400_000;
  let guard = 0;
  while (d <= bugunMs && guard < 60) {
    if (d >= oncekiMs) return true;
    d += periyotGun * 86_400_000;
    guard++;
  }
  return false;
}

function pariyeYakinMi(v: number | null): boolean {
  return v != null && Math.abs(v - 100) <= KUPON_RESET_PAR_TOLERANS;
}

export function OstGunlukIslemler({ bist, mkb }: { bist: BistSatiri[]; mkb: MkbSatiri[] }) {
  const mkbHarita = useMemo(() => new Map(mkb.map((m) => [m.isin, m])), [mkb]);

  const tarihler = useMemo(() => Array.from(new Set(bist.map((r) => r.tarih))).sort().reverse(), [bist]);
  const [seciliTarih, setSeciliTarih] = useState(tarihler[0] ?? "");

  const gunluk = useMemo(() => {
    return bist
      .filter((r) => r.tarih === seciliTarih)
      .map((r) => {
        const m = mkbHarita.get(r.isin);
        const kirliFiyat = r.temiz_fiyat != null && r.birikmis_faiz != null ? r.temiz_fiyat + r.birikmis_faiz : null;
        return { ...r, ...m, kirliFiyat };
      })
      .sort((a, b) => (b.islem_hacmi_tl ?? 0) - (a.islem_hacmi_tl ?? 0));
  }, [bist, seciliTarih, mkbHarita]);

  const anomaliler = useMemo(() => {
    if (!seciliTarih) return [];
    const oncekiPerIsin = new Map<string, BistSatiri>();
    for (const r of bist) {
      if (r.tarih >= seciliTarih) continue;
      const mevcut = oncekiPerIsin.get(r.isin);
      if (!mevcut || r.tarih > mevcut.tarih) oncekiPerIsin.set(r.isin, r);
    }
    const bugunPerIsin = new Map<string, BistSatiri>();
    for (const r of bist) if (r.tarih === seciliTarih) bugunPerIsin.set(r.isin, r);

    const sonuc: {
      isin: string; ihracci: string; fiyatDegisimPct: number | null; getiriDegisimBps: number | null;
      oncekiFiyat: number | null; oncekiGetiri: number | null; bugunFiyat: number | null; bugunGetiri: number | null;
      gunFarki: number; kuponResetiyleAciklanabilir: boolean;
    }[] = [];

    for (const [isin, bugun] of bugunPerIsin) {
      const onceki = oncekiPerIsin.get(isin);
      if (!onceki) continue;
      const gunFarki = Math.round((new Date(seciliTarih).getTime() - new Date(onceki.tarih).getTime()) / 86_400_000);
      if (gunFarki > MAX_KARSILASTIRMA_GUN) continue;

      const fiyatDegisimPct =
        bugun.temiz_fiyat != null && onceki.temiz_fiyat != null
          ? ((bugun.temiz_fiyat - onceki.temiz_fiyat) / onceki.temiz_fiyat) * 100
          : null;
      const getiriDegisimBps =
        bugun.kapanis_bilesik_getiri_pct != null && onceki.kapanis_bilesik_getiri_pct != null
          ? (bugun.kapanis_bilesik_getiri_pct - onceki.kapanis_bilesik_getiri_pct) * 100
          : null;

      const anormal =
        (fiyatDegisimPct != null && Math.abs(fiyatDegisimPct) >= FIYAT_ANOMALI_ESIK_PCT) ||
        (getiriDegisimBps != null && Math.abs(getiriDegisimBps) >= GETIRI_ANOMALI_ESIK_BPS);
      if (!anormal) continue;

      const m = mkbHarita.get(isin);
      const kuponAraliginda =
        (pariyeYakinMi(bugun.temiz_fiyat) || pariyeYakinMi(onceki.temiz_fiyat)) &&
        kuponAraliginaMi(m?.ilk_ihrac_tarihi ?? null, m?.kupon_sikligi ?? null, onceki.tarih, seciliTarih);

      sonuc.push({
        isin, ihracci: m?.ihracci_kurum ?? "–", fiyatDegisimPct, getiriDegisimBps,
        oncekiFiyat: onceki.temiz_fiyat, oncekiGetiri: onceki.kapanis_bilesik_getiri_pct,
        bugunFiyat: bugun.temiz_fiyat, bugunGetiri: bugun.kapanis_bilesik_getiri_pct,
        gunFarki, kuponResetiyleAciklanabilir: kuponAraliginda,
      });
    }
    sonuc.sort((a, b) => Math.max(Math.abs(b.fiyatDegisimPct ?? 0), Math.abs(b.getiriDegisimBps ?? 0) / 100) - Math.max(Math.abs(a.fiyatDegisimPct ?? 0), Math.abs(a.getiriDegisimBps ?? 0) / 100));
    return sonuc;
  }, [bist, seciliTarih, mkbHarita]);

  const anomaliGercek = anomaliler.filter((a) => !a.kuponResetiyleAciklanabilir);
  const anomaliKupon = anomaliler.filter((a) => a.kuponResetiyleAciklanabilir);

  function anomaliMesaji(a: (typeof anomaliler)[number]): string {
    const parcalar = [`${a.isin} (${a.ihracci})`];
    if (a.getiriDegisimBps != null && Math.abs(a.getiriDegisimBps) >= GETIRI_ANOMALI_ESIK_BPS) {
      parcalar.push(`getiri ${a.getiriDegisimBps >= 0 ? "+" : ""}${a.getiriDegisimBps.toFixed(0)} bps (${yuzde(a.oncekiGetiri)} → ${yuzde(a.bugunGetiri)})`);
    }
    if (a.fiyatDegisimPct != null && Math.abs(a.fiyatDegisimPct) >= FIYAT_ANOMALI_ESIK_PCT) {
      parcalar.push(`fiyat %${a.fiyatDegisimPct >= 0 ? "+" : ""}${a.fiyatDegisimPct.toFixed(1)} (${a.oncekiFiyat?.toFixed(2)} → ${a.bugunFiyat?.toFixed(2)})`);
    }
    parcalar.push(a.gunFarki <= 1 ? "önceki gün işlem gördü" : `${a.gunFarki} gün önce işlem gördü`);
    if (a.kuponResetiyleAciklanabilir) {
      const fiyatDusuyor = a.fiyatDegisimPct != null && a.fiyatDegisimPct < 0;
      parcalar.push(fiyatDusuyor ? "muhtemelen kira/kupon ödendi, pariye indi" : "muhtemelen yeni dönem başladı, pariden birikime geçti");
    }
    return parcalar.join(", ");
  }

  const toplamHacim = gunluk.reduce((s, r) => s + (r.islem_hacmi_tl ?? 0), 0);
  const toplamNominal = gunluk.reduce((s, r) => s + (r.miktar ?? 0), 0);

  if (tarihler.length === 0) {
    return <p className="text-sm text-muted-foreground">BIST ÖST verisi bulunamadı.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground" htmlFor="ost-tarih">Tarih</label>
        <select
          id="ost-tarih"
          value={seciliTarih}
          onChange={(e) => setSeciliTarih(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm font-figures"
        >
          {tarihler.map((t) => (
            <option key={t} value={t}>{isoTarihGoster(t)}</option>
          ))}
        </select>
      </div>

      {anomaliGercek.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="mb-1 font-semibold text-destructive">⚠️ {anomaliGercek.length} kağıtta anormal hareket</p>
          <ul className="list-inside list-disc space-y-0.5 text-destructive/90">
            {anomaliGercek.map((a) => (
              <li key={a.isin}>{anomaliMesaji(a)}</li>
            ))}
          </ul>
        </div>
      )}
      {anomaliKupon.length > 0 && (
        <details className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">
            ℹ️ {anomaliKupon.length} kağıtta kupon/kira resetiyle açıklanabilir hareket
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Fiyat, önceki ya da bugünkü işlemde pariye (100.00) yakınken, o kağıdın hesaplanan bir kira/kupon ödeme
            tarihine denk gelen bir aralıkta değişmiş — kesin bir resmi ÖST kupon takvimi kaynağı olmadığından bu
            YAKLAŞIK bir tahmindir.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-0.5 text-muted-foreground">
            {anomaliKupon.map((a) => (
              <li key={a.isin}>{anomaliMesaji(a)}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">İşlem gören ÖST sayısı</div><div className="font-figures mt-1 text-xl font-semibold">{gunluk.length}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Toplam işlem hacmi</div><div className="font-figures mt-1 text-xl font-semibold">{sayi(toplamHacim)} TL</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Toplam nominal işlem hacmi</div><div className="font-figures mt-1 text-xl font-semibold">{sayi(toplamNominal)}</div></CardContent></Card>
      </div>

      <div className="max-h-[500px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>ISIN</TableHead>
              <TableHead>İhraççı</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>Getiri Türü</TableHead>
              <TableHead className="text-right">Temiz Fiyat</TableHead>
              <TableHead className="text-right">Takas Fiyatı</TableHead>
              <TableHead className="text-right">Bileşik Getiri</TableHead>
              <TableHead className="text-right">Kirli Fiyat</TableHead>
              <TableHead className="text-right">İşlem Hacmi (TL)</TableHead>
              <TableHead className="text-right">İşlem Hacmi (Nominal)</TableHead>
              <TableHead>İtfa Tarihi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gunluk.map((r) => (
              <TableRow key={r.isin}>
                <TableCell className="font-figures">{r.isin}</TableCell>
                <TableCell className="max-w-40 truncate text-xs" title={r.ihracci_kurum ?? ""}>{r.ihracci_kurum ?? "–"}</TableCell>
                <TableCell className="max-w-32 truncate text-xs text-muted-foreground">{r.mk_turu ?? "–"}</TableCell>
                <TableCell className="max-w-32 truncate text-xs text-muted-foreground">{r.getiri_turu ?? "–"}</TableCell>
                <TableCell className="font-figures text-right">{r.temiz_fiyat != null ? r.temiz_fiyat.toFixed(3) : "–"}</TableCell>
                <TableCell className="font-figures text-right">{r.ag_ort_takas_fiyati != null ? r.ag_ort_takas_fiyati.toFixed(3) : "–"}</TableCell>
                <TableCell className="font-figures text-right">{yuzde(r.kapanis_bilesik_getiri_pct)}</TableCell>
                <TableCell className="font-figures text-right">{r.kirliFiyat != null ? r.kirliFiyat.toFixed(3) : "–"}</TableCell>
                <TableCell className="font-figures text-right">{sayi(r.islem_hacmi_tl)}</TableCell>
                <TableCell className="font-figures text-right">{sayi(r.miktar)}</TableCell>
                <TableCell className="font-figures text-xs">{r.itfa_tarihi ?? "–"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
