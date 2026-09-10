"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";

type MkbSatiri = {
  isin: string;
  ihracci_kurum: string | null;
  araci_kurum_unvan: string | null;
  mk_turu: string | null;
  getiri_turu: string | null;
  ilk_ihrac_tarihi: string | null;
  ilk_ihrac_fiyati: string | null;
  ilk_ihrac_getirisi_ham: string | null;
  itfa_tarihi: string | null;
  toplam_ihrac_tutari_bin: number | null;
  ek_getiri_pct_ham: string | null;
  aciklama: string | null;
};

const TUMU = "Tümü";

function trTarihiParcala(s: string | null): Date | null {
  if (!s) return null;
  const [g, a, y] = s.split(".").map(Number);
  if (!g || !a || !y) return null;
  return new Date(Date.UTC(y, a - 1, g));
}

export function OstIhracciProfili({ kagitlar }: { kagitlar: MkbSatiri[] }) {
  const ihracciOzet = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of kagitlar) {
      if (!k.ihracci_kurum) continue;
      m.set(k.ihracci_kurum, (m.get(k.ihracci_kurum) ?? 0) + 1);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, "tr"));
  }, [kagitlar]);

  const araciOzet = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of kagitlar) {
      if (!k.araci_kurum_unvan) continue;
      m.set(k.araci_kurum_unvan, (m.get(k.araci_kurum_unvan) ?? 0) + 1);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, "tr"));
  }, [kagitlar]);

  const [seciliIhracci, setSeciliIhracci] = useState(TUMU);
  const [seciliAraci, setSeciliAraci] = useState(TUMU);
  const [arama, setArama] = useState("");

  /** ISIN öncelikli, ama ihraççı/aracı/açıklama metninde de arıyor. */
  const eslesiyorMu = (k: MkbSatiri, q: string) =>
    [k.isin, k.ihracci_kurum, k.araci_kurum_unvan, k.mk_turu, k.aciklama]
      .some((alan) => alan?.toLocaleLowerCase("tr").includes(q));

  const sorgu = arama.trim().toLocaleLowerCase("tr");

  const buIhracci = useMemo(() => {
    let sonuc = seciliIhracci === TUMU ? kagitlar : kagitlar.filter((k) => k.ihracci_kurum === seciliIhracci);
    if (seciliAraci !== TUMU) sonuc = sonuc.filter((k) => k.araci_kurum_unvan === seciliAraci);
    if (sorgu) sonuc = sonuc.filter((k) => eslesiyorMu(k, sorgu));
    return sonuc;
  }, [kagitlar, seciliIhracci, seciliAraci, sorgu]);

  // Arama sonuc vermediyse kağıt seçili filtrelerin DIŞINDA olabilir --
  // kullanıcı ISIN'i doğru yazdığı halde boş ekran görmesin.
  const filtreDisiEslesme = useMemo(() => {
    if (!sorgu || buIhracci.length > 0) return 0;
    return kagitlar.filter((k) => eslesiyorMu(k, sorgu)).length;
  }, [kagitlar, sorgu, buIhracci.length]);

  const toplamTutar = buIhracci.reduce((s, k) => s + (k.toplam_ihrac_tutari_bin ?? 0), 0) / 1000;
  const ilkIhracTarihleri = buIhracci.map((k) => trTarihiParcala(k.ilk_ihrac_tarihi)).filter((d): d is Date => d != null);
  const enErkenIlkIhrac = ilkIhracTarihleri.length > 0 ? new Date(Math.min(...ilkIhracTarihleri.map((d) => d.getTime()))) : null;

  const bugun = new Date();
  const aktifSayisi = buIhracci.filter((k) => {
    const itfa = trTarihiParcala(k.itfa_tarihi);
    return itfa && itfa.getTime() >= Date.UTC(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
  }).length;

  const goster = [...buIhracci].sort((a, b) => {
    const da = trTarihiParcala(a.ilk_ihrac_tarihi)?.getTime() ?? 0;
    const db = trTarihiParcala(b.ilk_ihrac_tarihi)?.getTime() ?? 0;
    return db - da;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">İhraççı kurum (detay için seç)</label>
          <Combobox
            className="max-w-72"
            value={seciliIhracci}
            onChange={setSeciliIhracci}
            placeholder="Kurum ara..."
            options={[
              { value: TUMU, label: `${TUMU} (${kagitlar.length} kağıt)` },
              ...ihracciOzet.map(([isim, sayi]) => ({ value: isim, label: `${isim} (${sayi} kağıt)` })),
            ]}
          />
        </div>
        {araciOzet.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Aracı kurum (detay için seç)</label>
            <Combobox
              className="max-w-72"
              value={seciliAraci}
              onChange={setSeciliAraci}
              placeholder="Kurum ara..."
              options={[
                { value: TUMU, label: `${TUMU} (${kagitlar.length} kağıt)` },
                ...araciOzet.map(([isim, sayi]) => ({ value: isim, label: `${isim} (${sayi} kağıt)` })),
              ]}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="ost-isin-ara">
            ISIN ara
          </label>
          <input
            id="ost-isin-ara"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="ISIN, ihraççı veya açıklama…"
            className="font-figures h-9 w-64 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {arama && (
            <button
              type="button"
              onClick={() => setArama("")}
              className="rounded-md border border-input px-2.5 py-1 text-xs hover:bg-muted"
            >
              Temizle
            </button>
          )}
        </div>
      </div>

      {filtreDisiEslesme > 0 && (
        <p className="text-sm text-muted-foreground">
          Seçili filtrelerde eşleşme yok — bu aramaya uyan{" "}
          <b className="text-foreground">{filtreDisiEslesme}</b> kağıt var ama seçili ihraççı/aracı
          kurum dışında.{" "}
          <button
            type="button"
            onClick={() => {
              setSeciliIhracci(TUMU);
              setSeciliAraci(TUMU);
            }}
            className="underline underline-offset-2"
          >
            Filtreleri kaldır
          </button>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Toplam ihraç sayısı</div><div className="font-figures mt-1 text-xl font-semibold">{buIhracci.length}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Toplam ihraç tutarı</div><div className="font-figures mt-1 text-xl font-semibold">{toplamTutar.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} Milyon</div></CardContent></Card>
        {enErkenIlkIhrac && (
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">İlk ihraç</div><div className="font-figures mt-1 text-xl font-semibold">{enErkenIlkIhrac.toLocaleDateString("tr-TR", { timeZone: "UTC" })}</div></CardContent></Card>
        )}
      </div>
      <p className="text-sm text-muted-foreground">Bunlardan <b className="text-foreground">{aktifSayisi}</b> tanesi hâlâ vadesi gelmemiş (aktif).</p>

      <div className="max-h-[500px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-[var(--tablo-baslik)]">
            <TableRow>
              <TableHead>ISIN</TableHead>
              {seciliIhracci === TUMU && <TableHead>İhraççı</TableHead>}
              {seciliAraci === TUMU && <TableHead>Aracı Kurum</TableHead>}
              <TableHead>Tip</TableHead>
              <TableHead>Getiri Türü</TableHead>
              <TableHead>İlk İhraç</TableHead>
              <TableHead>İlk Fiyat</TableHead>
              <TableHead>İlk Getiri (Basit) / Spread</TableHead>
              <TableHead>İtfa Tarihi</TableHead>
              <TableHead className="text-right">Toplam Tutar (Milyon TL)</TableHead>
              <TableHead className="text-right">Ek Getiri (%)</TableHead>
              <TableHead>Açıklama</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {goster.map((k) => (
              <TableRow key={k.isin}>
                <TableCell className="font-figures">{k.isin}</TableCell>
                {seciliIhracci === TUMU && <TableCell className="max-w-40 truncate text-xs" title={k.ihracci_kurum ?? ""}>{k.ihracci_kurum ?? "–"}</TableCell>}
                {seciliAraci === TUMU && <TableCell className="max-w-40 truncate text-xs" title={k.araci_kurum_unvan ?? ""}>{k.araci_kurum_unvan ?? "–"}</TableCell>}
                <TableCell className="max-w-32 truncate text-xs text-muted-foreground">{k.mk_turu ?? "–"}</TableCell>
                <TableCell className="max-w-32 truncate text-xs text-muted-foreground">{k.getiri_turu ?? "–"}</TableCell>
                <TableCell className="font-figures text-xs">{k.ilk_ihrac_tarihi ?? "–"}</TableCell>
                <TableCell className="font-figures text-xs">{k.ilk_ihrac_fiyati ?? "–"}</TableCell>
                <TableCell className="max-w-56 truncate text-xs" title={k.ilk_ihrac_getirisi_ham ?? ""}>{k.ilk_ihrac_getirisi_ham ?? "–"}</TableCell>
                <TableCell className="font-figures text-xs">{k.itfa_tarihi ?? "–"}</TableCell>
                <TableCell className="font-figures text-right">
                  {k.toplam_ihrac_tutari_bin != null ? (k.toplam_ihrac_tutari_bin / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : "–"}
                </TableCell>
                <TableCell className="font-figures text-right">{k.ek_getiri_pct_ham ?? "–"}</TableCell>
                <TableCell className="max-w-40 truncate text-xs" title={k.aciklama ?? ""}>{k.aciklama ?? "–"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        &quot;İlk Getiri (Basit) / Spread&quot; alanı BIST&apos;in kendi metnidir — TLREF&apos;e endeksli kağıtlarda
        genelde &quot;TLREF + %X Ek Getiri&quot; gibi serbest metin, sabit getirili kağıtlarda ise doğrudan yıllık
        basit getiri yüzdesi olarak gelir. &quot;Ek Getiri (%)&quot; sütunu BIST tarafından çoğu özel sektör
        kağıdında ayrı bir sayı olarak doldurulmuyor — bu yüzden asıl spread bilgisi genelde soldaki serbest metin
        sütununda.
      </p>
    </div>
  );
}
