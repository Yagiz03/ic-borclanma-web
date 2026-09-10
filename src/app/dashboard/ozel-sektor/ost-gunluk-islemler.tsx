"use client";

import { useMemo, useState } from "react";
import { OzetSerit } from "@/components/ozet-serit";
import { sayi, yuzde } from "@/lib/bicim";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KolonBasligi } from "@/components/kolon-basligi";
import { IslemGunuSecici } from "@/components/islem-gunu-secici";
import { ostAnomaliMesaji, ostAnomalileriBul } from "@/lib/ost-anomali";

// Sayfanin tablosu anomali hesabindan DAHA COK alan kullaniyor (hacim,
// birikmis faiz, ihrac buyuklugu...); lib/ost-anomali.ts yalnizca kendi
// ihtiyaci olan alt kumeyi tanimliyor.
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
        // İhraç büyüklüğü BIST'in referans listesinde BİN TL cinsinden.
        const ihracBuyukluguMn =
          m?.toplam_ihrac_tutari_bin != null ? Number(m.toplam_ihrac_tutari_bin) / 1000 : null;
        return { ...r, ...m, kirliFiyat, ihracBuyukluguMn };
      })
      .sort((a, b) => (b.islem_hacmi_tl ?? 0) - (a.islem_hacmi_tl ?? 0));
  }, [bist, seciliTarih, mkbHarita]);

  const anomaliler = useMemo(
    () => ostAnomalileriBul(bist, mkb, seciliTarih),
    [bist, mkb, seciliTarih],
  );

  // Kisa vade etkisi ayri listeye alinmisti; kullanici uyarinin KIRMIZI
  // kalmasini istedi -- sebep satirin sonunda yaziyor, kayit gizlenmiyor.
  const anomaliGercek = anomaliler.filter((a) => !a.kuponResetiyleAciklanabilir);
  const anomaliKupon = anomaliler.filter((a) => a.kuponResetiyleAciklanabilir);

  const toplamHacim = gunluk.reduce((s, r) => s + (r.islem_hacmi_tl ?? 0), 0);
  const toplamNominal = gunluk.reduce((s, r) => s + (r.miktar ?? 0), 0);

  if (tarihler.length === 0) {
    return <p className="text-sm text-muted-foreground">BIST ÖST verisi bulunamadı.</p>;
  }

  return (
    <div className="space-y-4">
      <IslemGunuSecici
        id="ost-tarih"
        tarihler={tarihler}
        deger={seciliTarih}
        onChange={setSeciliTarih}
      />

      {anomaliGercek.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="mb-1 font-semibold text-destructive">⚠️ {anomaliGercek.length} kağıtta anormal hareket</p>
          <ul className="list-inside list-disc space-y-0.5 text-destructive/90">
            {anomaliGercek.map((a) => (
              <li key={a.isin}>{ostAnomaliMesaji(a)}</li>
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
              <li key={a.isin}>{ostAnomaliMesaji(a)}</li>
            ))}
          </ul>
        </details>
      )}

      <OzetSerit
        alanlar={[
          { etiket: "İşlem gören ÖST sayısı", deger: String(gunluk.length) },
          { etiket: "Toplam işlem hacmi", deger: `${sayi(toplamHacim)} TL` },
          { etiket: "Toplam nominal işlem hacmi", deger: sayi(toplamNominal) },
        ]}
      />

      <div className="max-h-[500px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-[var(--tablo-baslik)]">
            <TableRow>
              <TableHead>ISIN</TableHead>
              {/* İhraççı adı en uzun metin: artan genişliği bu sütun emiyor. */}
              <TableHead className="w-full min-w-[10rem]">İhraççı</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>Getiri Türü</TableHead>
              <TableHead className="text-right">
                <KolonBasligi ust="İhraç Büyüklüğü" alt="Mn TL" />
              </TableHead>
              <TableHead className="text-right">
                <KolonBasligi ust="Temiz" alt="Fiyat" />
              </TableHead>
              <TableHead className="text-right">
                <KolonBasligi ust="Takas" alt="Fiyatı" />
              </TableHead>
              <TableHead className="text-right">
                <KolonBasligi ust="Bileşik" alt="Getiri" />
              </TableHead>
              <TableHead className="text-right">
                <KolonBasligi ust="Kirli" alt="Fiyat" />
              </TableHead>
              <TableHead className="text-right">
                <KolonBasligi ust="İşlem Hacmi" alt="TL" />
              </TableHead>
              <TableHead className="text-right">
                <KolonBasligi ust="İşlem Hacmi" alt="Nominal" />
              </TableHead>
              <TableHead>
                <KolonBasligi ust="İtfa" alt="Tarihi" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gunluk.map((r) => (
              <TableRow key={r.isin}>
                <TableCell className="font-figures">{r.isin}</TableCell>
                <TableCell className="max-w-40 truncate text-xs" title={r.ihracci_kurum ?? ""}>{r.ihracci_kurum ?? "–"}</TableCell>
                <TableCell className="max-w-32 truncate text-xs text-muted-foreground">{r.mk_turu ?? "–"}</TableCell>
                <TableCell className="max-w-32 truncate text-xs text-muted-foreground">{r.getiri_turu ?? "–"}</TableCell>
                <TableCell className="font-figures text-right">
                  {r.ihracBuyukluguMn != null
                    ? r.ihracBuyukluguMn.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                    : "–"}
                </TableCell>
                <TableCell className="font-figures text-right">{sayi(r.temiz_fiyat, 3)}</TableCell>
                <TableCell className="font-figures text-right">{sayi(r.ag_ort_takas_fiyati, 3)}</TableCell>
                <TableCell className="font-figures text-right">{yuzde(r.kapanis_bilesik_getiri_pct)}</TableCell>
                <TableCell className="font-figures text-right">{sayi(r.kirliFiyat, 3)}</TableCell>
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
