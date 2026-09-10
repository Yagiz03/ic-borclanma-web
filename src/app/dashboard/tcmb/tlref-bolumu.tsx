"use client";

import { useMemo, useState } from "react";
import { Bolum } from "@/components/bolum";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { OzetSerit } from "@/components/ozet-serit";
import { BosDurum } from "@/components/bos-durum";
import {
  ZamanAraligiSecici,
  zamanaGoreSuz,
  type ZamanAraligi,
} from "@/components/zaman-araligi";

export type TlrefNoktasi = { tarih: string; oran_pct: number };

const ARALIKLAR: ZamanAraligi[] = ["1a", "3a", "6a", "ytd", "1y", "tum"];

function tarihFmt(v: string) {
  return new Date(v).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/**
 * core/bist_tlref.py::donem_fonlama_orani_hesapla'nın karşılığı.
 *
 * [baslangic, bitis) aralığındaki günlük TLREF oranları Actual/365 BİLEŞİK
 * işletilip dönemin gerçekleşen getirisi bulunuyor, sonra TLREF'in kendi
 * yayımlama biçimiyle (basit yıllık %) karşılaştırılabilsin diye BASİTÇE
 * yıllıklandırılıyor. Hafta sonu/tatilde bir önceki iş gününün oranı geçerli
 * sayılıyor (ffill).
 */
function donemFonlamaOrani(
  seri: TlrefNoktasi[],
  baslangic: string,
  bitis: string,
): { fonlamaOraniPct: number; ortalamaGunlukPct: number; bilesikGetiriPct: number; gunSayisi: number } | null {
  if (seri.length === 0 || bitis <= baslangic) return null;
  if (baslangic < seri[0].tarih) return null;

  const oranHarita = new Map(seri.map((r) => [r.tarih, r.oran_pct]));
  const bas = new Date(`${baslangic}T00:00:00Z`);
  const bit = new Date(`${bitis}T00:00:00Z`);

  let carpim = 1;
  let toplam = 0;
  let gunSayisi = 0;

  // Başlangıç hafta sonuna/tatile denk gelirse o gün için BİR ÖNCEKİ İŞ
  // GÜNÜNÜN oranı geçerli (Python tarafındaki ffill ile aynı). Tohum değeri
  // serinin en başı yapılırsa (ilk hata buydu) 2019'daki oran kullanılıp
  // dönem ortalaması aşağı çekiliyor.
  let sonBilinen: number | null = null;
  for (const r of seri) {
    if (r.tarih <= baslangic) sonBilinen = r.oran_pct;
    else break;
  }
  if (sonBilinen == null) return null;

  for (const g = new Date(bas); g < bit; g.setUTCDate(g.getUTCDate() + 1)) {
    const iso = g.toISOString().slice(0, 10);
    const oran = oranHarita.get(iso);
    if (oran != null) sonBilinen = oran;
    if (sonBilinen == null) return null;
    carpim *= 1 + sonBilinen / 100 / 365;
    toplam += sonBilinen;
    gunSayisi++;
  }
  if (gunSayisi === 0) return null;

  const bilesikGetiriPct = (carpim - 1) * 100;
  return {
    fonlamaOraniPct: bilesikGetiriPct * (365 / gunSayisi),
    ortalamaGunlukPct: toplam / gunSayisi,
    bilesikGetiriPct,
    gunSayisi,
  };
}

export function TlrefBolumu({ seri }: { seri: TlrefNoktasi[] }) {
  const [aralik, setAralik] = useState<ZamanAraligi>("ytd");

  const ilkTarih = seri[0]?.tarih ?? "";
  const sonTarih = seri[seri.length - 1]?.tarih ?? "";

  // Varsayılan dönem: son 30 gün (Python'daki varsayilan_baslangic ile aynı).
  const varsayilanBaslangic = useMemo(() => {
    if (!sonTarih) return "";
    const d = new Date(`${sonTarih}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 30);
    const iso = d.toISOString().slice(0, 10);
    return iso < ilkTarih ? ilkTarih : iso;
  }, [sonTarih, ilkTarih]);

  const [baslangic, setBaslangic] = useState(varsayilanBaslangic);
  const [bitis, setBitis] = useState(sonTarih);

  const grafikVerisi = zamanaGoreSuz(seri, aralik);
  const gosterilecek = grafikVerisi.length > 1 ? grafikVerisi : seri;
  const sonuc = donemFonlamaOrani(seri, baslangic, bitis);
  const son = seri[seri.length - 1];

  if (seri.length === 0) {
    return <BosDurum baslik="TLREF oranı verisi yok" aciklama="BIST TLREF Komitesi'nin yayımladığı günlük oran serisi henüz aktarılmadı." />;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        BIST TLREF Komitesi&apos;nin yayımladığı Türk Lirası Gecelik Referans Faiz Oranı — kaynak:
        borsaistanbul.com/endeksler/tlref. Veri her gece otomatik güncelleniyor.
      </p>

      <OzetSerit
        alanlar={[
          {
            etiket: "Son TLREF Oranı",
            deger: `%${son.oran_pct.toFixed(2)}`,
            altBilgi: `Son veri tarihi: ${tarihFmt(son.tarih)}`,
          },
        ]}
      />

      <div className="space-y-2">
        <div className="flex justify-end">
          <ZamanAraligiSecici deger={aralik} onChange={setAralik} secenekler={ARALIKLAR} />
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={gosterilecek} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="tarih" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={tarihFmt} minTickGap={48} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={52} unit="%" domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={(v) => Number(v).toFixed(0)} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(v) => (typeof v === "string" ? tarihFmt(v) : "")}
              formatter={(v) => [`%${Number(v).toFixed(2)}`, "TLREF"]}
            />
            <Line type="monotone" dataKey="oran_pct" stroke="var(--chart-1)" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <Bolum baslik="Dönem fonlama oranı">
        <p className="text-sm text-muted-foreground">
          İki tarih arasında günlük TLREF oranları Actual/365 bileşik işletilip (hafta sonu/tatil
          günlerinde bir önceki iş gününün oranı geçerli sayılır), gerçekleşen getiri TLREF&apos;in kendi
          yayımlama biçimiyle (basit yıllık %) karşılaştırılabilir olsun diye basitçe yıllıklandırılıyor.
        </p>

        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="tlref-bas">Başlangıç tarihi</label>
            <input
              id="tlref-bas" type="date" value={baslangic} min={ilkTarih} max={sonTarih}
              onChange={(e) => setBaslangic(e.target.value)}
              className="font-figures block h-9 rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="tlref-bit">Bitiş tarihi</label>
            <input
              id="tlref-bit" type="date" value={bitis} min={ilkTarih} max={sonTarih}
              onChange={(e) => setBitis(e.target.value)}
              className="font-figures block h-9 rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
        </div>

        {sonuc == null ? (
          <p className="text-sm text-muted-foreground">
            Bitiş tarihi başlangıçtan sonra olmalı ve veri kapsamı içinde kalmalı.
          </p>
        ) : (
          <OzetSerit
            alanlar={[
              {
                etiket: "Fonlama Oranı (Yıllıklandırılmış, %)",
                deger: `%${sonuc.fonlamaOraniPct.toFixed(2)}`,
                yardim: "Dönem içindeki bileşik getirinin basit Act/365 ile yıllıklandırılmış hali.",
              },
              { etiket: "Ortalama Günlük TLREF Oranı (%)", deger: `%${sonuc.ortalamaGunlukPct.toFixed(2)}` },
              { etiket: "Dönem Getirisi (Bileşik, %)", deger: `%${sonuc.bilesikGetiriPct.toFixed(2)}` },
              { etiket: "Gün Sayısı", deger: String(sonuc.gunSayisi) },
            ]}
          />
        )}
      </Bolum>
    </div>
  );
}
