"use client";

/**
 * Floater kağıtların (TLREF'e Endeksli / Değişken Faizli / TÜFE'ye Endeksli)
 * fiyatlama bölümleri -- pages/pricing.py'deki TLREF_TIPI, DEGISKEN_FAIZLI_TIPI
 * ve TUFE_TIPI bloklarının karşılığı. Hesaplar lib/bond-math/floater.ts'te
 * (Python golden testleriyle doğrulanmış).
 */

import { useMemo, useState } from "react";
import {
  donemselKuponAkislari,
  kuponDonemleri,
  kuponDonemleriGeriye,
  degiskenFaizliDonemKuponu,
  degiskenFaizliYaklasikGetiri,
  gecmisIhalelereEndeksliGetiri,
  referansTufeEndeksi,
  tlrefBirikmisKupon,
  tufeEndeksOrani,
  type ReferansIhale,
  type TlrefSeri,
  type TufeSeri,
} from "@/lib/bond-math/floater";
import {
  getiriBul,
  temizFiyatHesapla,
  modifiedDurationHesapla,
  dv01Hesapla,
  nakitAkislariniOlustur,
} from "@/lib/bond-math/tahvil-fiyatlama";
import { OzetSerit, type OzetAlan } from "@/components/ozet-serit";
import { TlrefSenaryoAnalizi } from "./tlref-senaryo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const g = (s: string) => new Date(`${s}T00:00:00Z`);
const trTarih = (d: Date) => d.toLocaleDateString("tr-TR", { timeZone: "UTC" });
const pct = (v: number, n = 2) => `%${v.toFixed(n)}`;

export type FloaterVeri = {
  tlref: { tarihler: string[]; degerler: number[] };
  tufe: { tarihler: string[]; degerler: number[] };
  referansIhaleler: { valor: string; vade: string; bf: number; ts: number }[];
};

export function useFloaterSeriler(veri: FloaterVeri) {
  return useMemo(
    () => ({
      tlrefSeri: {
        tarihler: veri.tlref.tarihler.map(g),
        degerler: veri.tlref.degerler,
      } satisfies TlrefSeri,
      tufeSeri: {
        tarihler: veri.tufe.tarihler.map(g),
        duzeyler: veri.tufe.degerler,
      } satisfies TufeSeri,
      referansIhaleler: veri.referansIhaleler.map(
        (r): ReferansIhale => ({ valor: g(r.valor), vade: g(r.vade), bf: r.bf, ts: r.ts }),
      ),
    }),
    [veri],
  );
}

/** Kalan nakit akışları tablosu -- floater bölümlerinin ortak parçası
 *  (pages/pricing.py'deki "Kupon ödeme takvimi (kalan nakit akışları)"). */
function KalanAkisTablosu({
  akislar,
  valor,
  reelMi = false,
  endeksOrani,
}: {
  akislar: { tarih: Date; tutar: number }[];
  valor: Date;
  /** TÜFE'ye endekslide tutarlar REEL; nominal karşılığı endeks oranıyla bulunur. */
  reelMi?: boolean;
  endeksOrani?: number | null;
}) {
  const kalanlar = akislar.filter((a) => a.tarih > valor && a.tutar > 0);
  if (kalanlar.length === 0) {
    return <p className="text-sm text-muted-foreground">Kalan nakit akışı yok.</p>;
  }
  return (
    <div className="max-h-[300px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Tarih</th>
            <th className="px-3 py-2 text-right font-medium">
              {reelMi ? "Reel nakit akışı (100 nominal)" : "Nakit akışı (100 nominal)"}
            </th>
            {reelMi && <th className="px-3 py-2 text-right font-medium">Nominal (TL) tutar</th>}
            <th className="px-3 py-2 text-right font-medium">Kalan gün</th>
          </tr>
        </thead>
        <tbody>
          {kalanlar.map((a, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="font-figures px-3 py-1.5">{trTarih(a.tarih)}</td>
              <td className="font-figures px-3 py-1.5 text-right">{a.tutar.toFixed(3)}</td>
              {reelMi && (
                <td className="font-figures px-3 py-1.5 text-right">
                  {endeksOrani == null ? "–" : (a.tutar * endeksOrani).toFixed(3)}
                </td>
              )}
              <td className="font-figures px-3 py-1.5 text-right">
                {Math.round((a.tarih.getTime() - valor.getTime()) / 86_400_000)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FiyatGirdisi({
  deger,
  onChange,
  etiket = "Temiz fiyat (100 nominal)",
  id = "floater-fiyat",
}: {
  deger: string;
  onChange: (v: string) => void;
  etiket?: string;
  id?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{etiket}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={deger}
        onChange={(e) => onChange(e.target.value)}
        className="w-40 font-figures"
      />
    </div>
  );
}

// --------------------------------------------------------------------------
// TLREF'e Endeksli
// --------------------------------------------------------------------------

export function TlrefFiyatlama({
  seri,
  ilkIhrac,
  vade,
  valor,
  periyotGun,
  ppkGunleri,
}: {
  seri: TlrefSeri;
  ilkIhrac: Date;
  vade: Date;
  valor: Date;
  periyotGun: number;
  /** Yaklaşan PPK karar günleri (ISO) -- senaryo analizinde kullanılıyor. */
  ppkGunleri: string[];
}) {
  const [fiyatStr, setFiyatStr] = useState("100.00");
  const [ekGetiriStr, setEkGetiriStr] = useState("0.00");

  const temiz = Number(fiyatStr.replace(",", "."));
  const ekGetiri = Number(ekGetiriStr.replace(",", "."));

  const sonuc = useMemo(() => {
    if (!Number.isFinite(temiz) || !Number.isFinite(ekGetiri)) return null;
    return degiskenFaizliYaklasikGetiri(seri, ilkIhrac, vade, valor, temiz, ekGetiri, periyotGun);
  }, [seri, ilkIhrac, vade, valor, temiz, ekGetiri, periyotGun]);

  // Kalan nakit akışları: mevcut dönemin kuponu her dönemin kendi uzunluğuna
  // günlük bileşikle ölçeklenerek ilerletiliyor (getirinin çözüldüğü varsayımın
  // ta kendisi -- tabloda da aynısı gösteriliyor ki sayılar tutarlı olsun).
  const kalanAkislar = useMemo(() => {
    if (!sonuc) return [];
    const donemler = kuponDonemleri(ilkIhrac, vade, periyotGun);
    const idx = donemler.findIndex(
      (d, i) => i < donemler.length - 1 && d <= sonuc.donemBasi && sonuc.donemBasi <= d,
    );
    const baslangic = idx >= 0 ? idx : donemler.findIndex((d) => d.getTime() === sonuc.donemBasi.getTime());
    if (baslangic < 0) return [];
    const n1 = Math.round((sonuc.donemSonu.getTime() - sonuc.donemBasi.getTime()) / 86_400_000);
    const gunlukKupon = Math.pow(1 + (sonuc.donemKuponPct - ekGetiri) / 100, 1 / n1) - 1;
    const dilim = donemler.slice(baslangic);
    const kuponlar = [sonuc.donemKuponPct];
    for (let i = 1; i < dilim.length - 1; i++) {
      const nI = Math.round((dilim[i + 1].getTime() - dilim[i].getTime()) / 86_400_000);
      kuponlar.push((Math.pow(1 + gunlukKupon, nI) - 1) * 100 + ekGetiri);
    }
    return donemselKuponAkislari(dilim, kuponlar);
  }, [sonuc, ilkIhrac, vade, periyotGun, ekGetiri]);

  const birikmis = useMemo(() => {
    if (!sonuc) return null;
    const n1 = Math.round(
      (sonuc.donemSonu.getTime() - sonuc.donemBasi.getTime()) / 86_400_000,
    );
    return tlrefBirikmisKupon(seri, sonuc.donemBasi, valor, n1, ekGetiri);
  }, [seri, sonuc, valor, ekGetiri]);

  if (seri.tarihler.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        TLREF endeks serisi (evds_seriler.tlref_kapanis) yüklenemedi — yaklaşık getiri
        hesaplanamıyor.
      </p>
    );
  }

  const n1 = sonuc
    ? Math.round((sonuc.donemSonu.getTime() - sonuc.donemBasi.getTime()) / 86_400_000)
    : 0;

  const alanlar: OzetAlan[] = sonuc
    ? [
        {
          etiket: "Bileşik getiri",
          deger: pct(sonuc.yaklasikGetiriPct),
          yardim:
            "Vadeye kadarki TÜM dönemlerin kuponlarının, içinde bulunulan dönemin kuponuyla aynı hızda gerçekleşeceği varsayılır. Kirli fiyattan (temiz + endeksten gerçekleşen birikmiş) tüm akışlara Actual/365 bileşik iskonto.",
        },
        {
          etiket: "Beklenen dönem kuponu",
          deger: pct(sonuc.donemKuponPct),
          altBilgi: sonuc.donemKuponKesinMi
            ? `${n1} günlük dönem — tüm gözlemler gerçekleşti, KESİN`
            : `${n1} günlük dönemin ${sonuc.gerceklesenGun} günü kesin, kalanı tahmin`,
          yardim:
            "HMB Yatırımcı Kılavuzu'ndaki resmi formül: ((dönem sonu endeksi / dönem başı endeksi)^(n1/n2) − 1) × 100 + ek getiri (gözlemler ilgili tarihten 2 iş günü öncesi).",
        },
        {
          etiket: "Yıllık karşılığı",
          deger: pct(sonuc.yillikKuponPct),
          yardim: `Dönemsel kuponun bileşik yıllıklandırılmışı: (1 + dönemsel)^(365/${n1}) − 1.`,
        },
        ...(sonuc.sonOdenenKuponPct != null
          ? [
              {
                etiket: "Son ödenen kupon",
                deger: pct(sonuc.sonOdenenKuponPct),
                yardim: "Bir önceki dönemin resmi formülle kesinleşmiş dönemsel kuponu.",
              },
            ]
          : []),
        {
          etiket: "Güncel TLREF seviyesi",
          deger: pct(sonuc.guncelTlrefOraniPct),
          yardim:
            "BASİT oran (piyasa kotasyonu mertebesi): yılbaşından bugüne endeks büyümesinin günlük ortalaması × 365.",
        },
        {
          etiket: "Kupon dönemi",
          deger: `${trTarih(sonuc.donemBasi)} → ${trTarih(sonuc.donemSonu)}`,
          altBilgi: `Kupon periyodu: ${periyotGun} gün`,
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <FiyatGirdisi deger={fiyatStr} onChange={setFiyatStr} id="tlref-fiyat" />
        <div className="space-y-2">
          <Label htmlFor="tlref-ek">Ek getiri (dönemsel, %)</Label>
          <Input
            id="tlref-ek"
            inputMode="decimal"
            value={ekGetiriStr}
            onChange={(e) => setEkGetiriStr(e.target.value)}
            className="w-40 font-figures"
          />
        </div>
      </div>

      {!sonuc ? (
        <p className="text-sm text-muted-foreground">
          Bu valör/fiyat için hesap yapılamadı (TLREF endeksi bu tarih aralığını kapsamıyor ya da
          kağıt vadesi geçmiş olabilir).
        </p>
      ) : (
        <>
          <OzetSerit alanlar={alanlar} />

          {birikmis && (
            <OzetSerit
              alanlar={[
                {
                  etiket: "Birikmiş kupon",
                  deger: pct(birikmis.birikmisPct, 4),
                  altBilgi: `Gözlem: ${trTarih(birikmis.gozlemBas)} → ${trTarih(birikmis.gozlemSimdi)}`,
                  yardim:
                    "Dönem başından bugüne GERÇEKLEŞEN kupon, doğrudan resmi BIST TLREF endeksinden: (E_bugün / E_dönem_başı − 1) × 100 + ek getiri × (geçen gün / n1).",
                },
                {
                  etiket: "Kirli fiyat",
                  deger: (temiz + birikmis.birikmisPct).toFixed(4),
                  altBilgi: "Temiz fiyat + birikmiş kupon",
                },
                { etiket: "Dönemde geçen gün", deger: `${birikmis.gecenGun} / ${n1}` },
                { etiket: "Kupona kalan gün", deger: String(sonuc.gunKupona) },
              ]}
            />
          )}
        </>
      )}

      {sonuc && kalanAkislar.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold">Kupon ödeme takvimi (kalan nakit akışları)</h3>
          <p className="text-xs text-muted-foreground">
            Mevcut dönemin kuponu, sonraki her dönemin kendi uzunluğuna günlük bileşikle
            ölçeklenerek ilerletildi — bileşik getirinin çözüldüğü varsayımın aynısı.
          </p>
          <KalanAkisTablosu akislar={kalanAkislar} valor={valor} />
        </div>
      )}

      {sonuc && birikmis && (
        <TlrefSenaryoAnalizi
          temizFiyat={temiz}
          birikmisPct={birikmis.birikmisPct}
          gozlemBas={birikmis.gozlemBas}
          gozlemSimdi={birikmis.gozlemSimdi}
          endeksBas={birikmis.endeksBas}
          endeksSimdi={birikmis.endeksSimdi}
          guncelTlrefPct={sonuc.guncelTlrefOraniPct}
          ilkIhrac={ilkIhrac}
          vade={vade}
          valor={valor}
          periyotGun={periyotGun}
          ekGetiri={ekGetiri}
          ppkGunleri={ppkGunleri}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Dönem kuponu HMB&apos;nin &quot;TLREF&apos;e Endeksli DİBS Yatırımcı Kılavuzu&quot;ndaki
        resmi formülle kurulur: dönemin geçmiş kısmı gerçekleşen TLREF endeksinden kesin, dönem
        sonuna kalan günler güncel TLREF seviyesiyle ilerletilerek tahmini. Kesin bir YTM değildir —
        TLREF&apos;in gerçek patikası varsayılan sabit seviyeden sapabilir.
      </p>
    </div>
  );
}

// --------------------------------------------------------------------------
// Değişken Faizli (Geçmiş İhalelere Endeksli)
// --------------------------------------------------------------------------

export function FrnFiyatlama({
  referansIhaleler,
  ilkIhrac,
  vade,
  valor,
  periyotGun,
}: {
  referansIhaleler: ReferansIhale[];
  ilkIhrac: Date;
  vade: Date;
  valor: Date;
  periyotGun: number;
}) {
  const [fiyatStr, setFiyatStr] = useState("100.00");
  const temiz = Number(fiyatStr.replace(",", "."));

  const sonuc = useMemo(() => {
    if (!Number.isFinite(temiz)) return null;
    return gecmisIhalelereEndeksliGetiri(ilkIhrac, vade, valor, temiz, referansIhaleler, periyotGun);
  }, [ilkIhrac, vade, valor, temiz, referansIhaleler, periyotGun]);

  // Kalan nakit akışları: mevcut dönemin kuponu KESİN; henüz başlamamış
  // dönemler için mevcut AOF'nin sabit kaldığı varsayılıyor (getirinin
  // çözüldüğü varsayımla aynı).
  const kalanAkislar = useMemo(() => {
    if (!sonuc) return [];
    const donemler = kuponDonemleriGeriye(ilkIhrac, vade, periyotGun);
    const idx = donemler.findIndex((d) => d.getTime() === sonuc.donemBasi.getTime());
    if (idx < 0) return [];
    const dilim = donemler.slice(idx);
    const kuponlar = dilim.slice(0, -1).map((d, i) => {
      if (i === 0) return sonuc.donemKuponPct;
      return degiskenFaizliDonemKuponu(d, referansIhaleler, periyotGun)?.donemselKuponPct
        ?? sonuc.donemKuponPct;
    });
    return donemselKuponAkislari(dilim, kuponlar);
  }, [sonuc, ilkIhrac, vade, periyotGun, referansIhaleler]);

  return (
    <div className="space-y-5">
      <FiyatGirdisi deger={fiyatStr} onChange={setFiyatStr} id="frn-fiyat" />

      {!sonuc ? (
        <p className="text-sm text-muted-foreground">
          Bu kağıt/valör için kupon hesaplanamadı — bir kupon döneminin referans penceresinde
          nitelikli ihale bulunamadı (arşivde eksik veri ya da çok eski kağıt).
        </p>
      ) : (
        <OzetSerit
          alanlar={[
            {
              etiket: "Bileşik getiri",
              deger: pct(sonuc.getiriPct),
              yardim:
                "Mevcut ve tüm geçmiş dönemlerin kuponu KESİN (referans ihaleler gerçekleşti); gelecek dönemler için mevcut AOF'nin sabit kaldığı varsayılır.",
            },
            {
              etiket: "Dönem kuponu",
              deger: pct(sonuc.donemKuponPct),
              altBilgi: `${periyotGun} günlük dönem — KESİN`,
              yardim: `Resmi formül: ((1 + AOF/100)^(${periyotGun}/364) − 1) × 100.`,
            },
            {
              etiket: "Ağırlıklı ort. faiz (AOF)",
              deger: pct(sonuc.aofPct),
              yardim:
                "Dönem başından önceki 91 gün içinde valörü olan TL kuponsuz ve ≤728 gün vadeli sabit kuponlu ihalelerin, net satış tutarıyla ağırlıklandırılmış ortalama yıllık bileşik faizi.",
            },
            { etiket: "Birikmiş faiz", deger: sonuc.birikmisFaiz.toFixed(4) },
            { etiket: "Kirli fiyat", deger: sonuc.kirliFiyat.toFixed(4) },
            {
              etiket: "Kupon dönemi",
              deger: `${trTarih(sonuc.donemBasi)} → ${trTarih(sonuc.donemSonu)}`,
            },
          ]}
        />
      )}

      {sonuc && kalanAkislar.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold">Kupon ödeme takvimi (kalan nakit akışları)</h3>
          <p className="text-xs text-muted-foreground">
            Mevcut dönemin kuponu kesin; henüz başlamamış dönemler için referans ihaleler daha
            gerçekleşmediğinden mevcut AOF&apos;nin sabit kaldığı varsayıldı.
          </p>
          <KalanAkisTablosu akislar={kalanAkislar} valor={valor} />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        HMB bu kağıt tipi için ayrı bir kılavuz yayımlamıyor; formül gerçek bir ihraç duyurusundan
        (TRT110832T19, 18.02.2026 kuponu) birebir doğrulandı. Referans penceresi dönem
        başlangıcından önce kapandığı için mevcut dönemin kuponu ve birikmiş faiz kesindir; nihai
        getiri, gelecek dönem varsayımı nedeniyle kesin bir YTM değildir.
      </p>
    </div>
  );
}

// --------------------------------------------------------------------------
// TÜFE'ye Endeksli
// --------------------------------------------------------------------------

export function TufeFiyatlama({
  tufeSeri,
  vade,
  anchor,
  ihracTarihi,
  valor,
  reelKuponPct,
}: {
  tufeSeri: TufeSeri;
  vade: Date;
  anchor: Date;
  ihracTarihi: Date;
  valor: Date;
  reelKuponPct: number;
}) {
  const [mod, setMod] = useState<"getiri" | "fiyat">("getiri");
  const [girdi, setGirdi] = useState("3.00");

  const sonuc = useMemo(() => {
    const girdiSayi = Number(girdi.replace(",", "."));
    if (!Number.isFinite(girdiSayi)) return null;
    const kupon = reelKuponPct / 100;
    const akislar = nakitAkislariniOlustur(vade, anchor, kupon);
    if (akislar.length === 0) return null;

    const reelGetiri =
      mod === "getiri" ? girdiSayi / 100 : getiriBul(vade, anchor, valor, kupon, girdiSayi);
    const { kirli, birikmis, temiz } = temizFiyatHesapla(vade, anchor, valor, kupon, reelGetiri);
    const { modified } = modifiedDurationHesapla(akislar, valor, reelGetiri);
    const dv01 = dv01Hesapla(akislar, valor, reelGetiri);
    const endeksOrani = tufeEndeksOrani(valor, ihracTarihi, tufeSeri);
    const refEndeks = referansTufeEndeksi(valor, tufeSeri);
    return { reelGetiri, kirli, birikmis, temiz, modified, dv01, endeksOrani, refEndeks, akislar };
  }, [girdi, mod, reelKuponPct, vade, anchor, valor, ihracTarihi, tufeSeri]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-1 rounded-md border border-input p-1 text-sm">
          <button
            type="button"
            onClick={() => setMod("getiri")}
            className={`rounded px-3 py-1 ${mod === "getiri" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Reel getiriden fiyata
          </button>
          <button
            type="button"
            onClick={() => setMod("fiyat")}
            className={`rounded px-3 py-1 ${mod === "fiyat" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Fiyattan reel getiriye
          </button>
        </div>
        <FiyatGirdisi
          deger={girdi}
          onChange={setGirdi}
          id="tufe-girdi"
          etiket={mod === "getiri" ? "Reel bileşik getiri (%)" : "Kirli (reel) fiyat"}
        />
      </div>

      {!sonuc ? (
        <p className="text-sm text-muted-foreground">Geçerli bir değer gir.</p>
      ) : (
        <>
          <OzetSerit
            alanlar={[
              { etiket: "Reel kupon oranı", deger: pct(reelKuponPct) },
              { etiket: "Reel bileşik getiri", deger: pct(sonuc.reelGetiri * 100) },
              { etiket: "Temiz (reel) fiyat", deger: sonuc.temiz.toFixed(3) },
              { etiket: "Kirli (reel) fiyat", deger: sonuc.kirli.toFixed(3) },
              { etiket: "Birikmiş faiz", deger: sonuc.birikmis.toFixed(4) },
              { etiket: "Modified duration", deger: `${sonuc.modified.toFixed(3)} yıl` },
              { etiket: "DV01", deger: sonuc.dv01.toFixed(4) },
            ]}
          />

          <OzetSerit
            alanlar={[
              {
                etiket: "Referans TÜFE endeksi",
                deger: sonuc.refEndeks == null ? "—" : sonuc.refEndeks.toFixed(5),
                altBilgi: `Valör: ${trTarih(valor)}`,
                yardim:
                  "HMB resmi formülü: TÜFE_(a−3) + (g−1)/AG × (TÜFE_(a−2) − TÜFE_(a−3)). Sadece yayımlanmış TÜFE düzeylerinden kurulur.",
              },
              {
                etiket: "Endeks oranı",
                deger: sonuc.endeksOrani == null ? "—" : sonuc.endeksOrani.toFixed(6),
                altBilgi: `İhraç: ${trTarih(ihracTarihi)}`,
                yardim: "Referans Endeks(valör) / Referans Endeks(ihraç).",
              },
              {
                etiket: "Takas (nominal) fiyat",
                deger:
                  sonuc.endeksOrani == null ? "—" : (sonuc.kirli * sonuc.endeksOrani).toFixed(4),
                yardim: "Kılavuzdaki formül: (Ft + BFt) × Endeks Oranı.",
              },
            ]}
          />
        </>
      )}

      {sonuc && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold">Kupon ödeme takvimi (kalan nakit akışları)</h3>
          <p className="text-xs text-muted-foreground">
            &quot;Nominal (TL) tutar&quot; sütunu, ödeme tarihinin Referans TÜFE Endeksi henüz
            yayımlanmadığı için VALÖR günündeki endeks oranıyla çarpılmış hâlidir — gerçek TL
            tutarı ödeme tarihine kadarki enflasyonla birlikte daha yüksek olacaktır.
          </p>
          <KalanAkisTablosu
            akislar={sonuc.akislar}
            valor={valor}
            reelMi
            endeksOrani={sonuc.endeksOrani}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        TÜFE&apos;ye endeksli DİBS&apos;lerde temiz fiyat, sabit kuponlu bir kağıtla BİREBİR aynı
        formülle hesaplanır — tek fark nominal yerine REEL kupon ve REEL getirinin kullanılmasıdır
        (HMB Yatırımcı Kılavuzu, Temmuz 2024). Bu yüzden reel getiri hiçbir enflasyon tahmini
        gerektirmeden KESİN hesaplanır; nominal (TL) karşılığa geçiş için Endeks Oranı kullanılır.
      </p>
    </div>
  );
}
