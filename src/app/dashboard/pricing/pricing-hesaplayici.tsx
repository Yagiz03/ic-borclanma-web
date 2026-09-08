"use client";

import { useMemo, useState } from "react";
import {
  kuponTakvimi,
  nakitAkislariniOlustur,
  kirliFiyatHesapla,
  temizFiyatHesapla,
  getiriBul,
  modifiedDurationHesapla,
  dv01Hesapla,
  konveksiteHesapla,
} from "@/lib/bond-math/tahvil-fiyatlama";
import { utcTarihe } from "@/lib/tarih";
import { SenetBadge } from "@/components/senet-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type FiyatlanabilirKagit = {
  isin: string;
  senetTanimi: string;
  vade: string; // DD.MM.YYYY ya da ISO -- utcTarihe ile parse edilir
  anchor: string;
  kuponOraniPct: number; // örn. 12.6 (= %12.6)
};

const bugunIso = () => new Date().toISOString().slice(0, 10);

function SonucKart({ etiket, deger, birim = "" }: { etiket: string; deger: string; birim?: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{etiket}</p>
      <p className="font-figures text-lg font-semibold">
        {deger}
        {birim && <span className="ml-1 text-sm text-muted-foreground">{birim}</span>}
      </p>
    </div>
  );
}

export function PricingHesaplayici({ kagitlar }: { kagitlar: FiyatlanabilirKagit[] }) {
  const [isin, setIsin] = useState(kagitlar[0]?.isin ?? "");
  const [valorStr, setValorStr] = useState(bugunIso());
  const [mod, setMod] = useState<"fiyat" | "getiri">("getiri");
  const [girdi, setGirdi] = useState("35.00");

  const kagit = kagitlar.find((k) => k.isin === isin);

  const sonuc = useMemo(() => {
    if (!kagit) return null;
    const vade = utcTarihe(kagit.vade);
    const anchor = utcTarihe(kagit.anchor);
    const valor = utcTarihe(valorStr);
    if (!vade || !anchor || !valor) return null;

    const kuponOrani = kagit.kuponOraniPct / 100;
    const girdiSayi = Number(girdi.replace(",", "."));
    if (!Number.isFinite(girdiSayi)) return null;

    const akislar = nakitAkislariniOlustur(vade, anchor, kuponOrani);
    if (akislar.length === 0 || akislar[akislar.length - 1].tarih.getTime() <= valor.getTime()) return null;

    let getiri: number;
    let kirli: number;
    if (mod === "getiri") {
      getiri = girdiSayi / 100;
      kirli = kirliFiyatHesapla(akislar, valor, getiri);
    } else {
      kirli = girdiSayi;
      getiri = getiriBul(vade, anchor, valor, kuponOrani, kirli);
    }

    const { birikmis, temiz } = temizFiyatHesapla(vade, anchor, valor, kuponOrani, getiri);
    const { modified } = modifiedDurationHesapla(akislar, valor, getiri);
    const dv01 = dv01Hesapla(akislar, valor, getiri);
    const konveksite = konveksiteHesapla(akislar, valor, getiri);
    const kuponTarihleri = kuponTakvimi(vade, anchor);
    const kalanKuponSayisi = kuponTarihleri.filter((t) => t.getTime() > valor.getTime()).length - 1;

    return { getiri, kirli, birikmis, temiz, modified, dv01, konveksite, kalanKuponSayisi };
  }, [kagit, valorStr, mod, girdi]);

  const kuponOdemeleri = useMemo(() => {
    if (!kagit) return null;
    const vade = utcTarihe(kagit.vade);
    const anchor = utcTarihe(kagit.anchor);
    if (!vade || !anchor) return null;
    try {
      return nakitAkislariniOlustur(vade, anchor, kagit.kuponOraniPct / 100);
    } catch {
      return null;
    }
  }, [kagit]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>Kağıt</Label>
              <Combobox
                value={isin}
                onChange={setIsin}
                placeholder="ISIN veya kağıt adı yazın..."
                emptyText="Eşleşen kağıt yok."
                options={kagitlar.map((k) => ({
                  value: k.isin,
                  label: `${k.isin} — ${k.senetTanimi} (kupon %${k.kuponOraniPct.toFixed(2)})`,
                  keywords: k.isin,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">Valör tarihi</Label>
              <Input id="valor" type="date" value={valorStr} onChange={(e) => setValorStr(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex gap-1 rounded-md border border-input p-1">
              <Button
                type="button"
                size="sm"
                variant={mod === "getiri" ? "default" : "ghost"}
                onClick={() => setMod("getiri")}
              >
                Getiriden fiyata
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mod === "fiyat" ? "default" : "ghost"}
                onClick={() => setMod("fiyat")}
              >
                Fiyattan getiriye
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="girdi">{mod === "getiri" ? "Bileşik getiri (%)" : "Kirli fiyat"}</Label>
              <Input
                id="girdi"
                inputMode="decimal"
                value={girdi}
                onChange={(e) => setGirdi(e.target.value)}
                className="w-40 font-figures"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {kagit && (
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{kagit.isin}</h2>
          <SenetBadge tanim={kagit.senetTanimi} />
        </div>
      )}

      {!sonuc ? (
        <p className="text-sm text-muted-foreground">
          Geçerli bir valör tarihi ve değer gir (valör, son kupon/vade tarihinden önce olmalı).
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SonucKart etiket="Temiz fiyat" deger={sonuc.temiz.toFixed(3)} />
          <SonucKart etiket="Kirli fiyat" deger={sonuc.kirli.toFixed(3)} />
          <SonucKart etiket="Birikmiş faiz" deger={sonuc.birikmis.toFixed(4)} />
          <SonucKart etiket="Bileşik getiri" deger={`%${(sonuc.getiri * 100).toFixed(2)}`} />
          <SonucKart etiket="Modified duration" deger={sonuc.modified.toFixed(3)} birim="yıl" />
          <SonucKart etiket="DV01" deger={sonuc.dv01.toFixed(4)} birim="/ 100 nominal" />
          <SonucKart etiket="Konveksite" deger={sonuc.konveksite.toFixed(2)} />
          <SonucKart etiket="Kalan kupon sayısı" deger={String(sonuc.kalanKuponSayisi)} />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Hesap tarayıcıda anlık çalışır (sunucu round-trip'i yok) -- Actual/365 bileşik iskonto, 182 günlük
        (6 aylık) kupon periyodu varsayımıyla. Sadece sabit kuponlu / kuponsuz kağıtlar için geçerli --
        TLREF/TÜFE/Değişken Faizli kağıtların floater formülleri henüz portlanmadı.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Kupon ödemeleri</CardTitle>
        </CardHeader>
        <CardContent>
          {!kagit || !kuponOdemeleri || kuponOdemeleri.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu kağıt için kupon takvimi hesaplanamadı.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {kagit.isin} -- {kagit.senetTanimi} kağıdının tüm kupon takvimi (geçmiş ödenenler dahil).
              </p>
              <div className="max-h-[340px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead className="text-right">Nakit akışı (100 nominal)</TableHead>
                      <TableHead>Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kuponOdemeleri.map((a, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-figures">{a.tarih.toLocaleDateString("tr-TR", { timeZone: "UTC" })}</TableCell>
                        <TableCell className="font-figures text-right">{a.tutar.toFixed(3)}</TableCell>
                        <TableCell>{a.tarih.getTime() <= Date.now() ? "Ödendi" : "Yaklaşan"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
