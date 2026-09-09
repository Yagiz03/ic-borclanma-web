"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IslemGunuSecici } from "@/components/islem-gunu-secici";
import { OzetSerit } from "@/components/ozet-serit";
import { BosDurum } from "@/components/bos-durum";
import { rvEkraniOlustur, tlrefBilesikFonlama, type RvSatiri } from "@/lib/rv-analiz";
import { bps, sayi, yuzde } from "@/lib/bicim";
import { CarryRollGrafigi } from "./carry-roll-grafigi";

type OzetSatiri = {
  isin: string;
  senet_tanimi: string | null;
  vade_tarihi: string | null;
  tahmini_kupon_orani: number | null;
  ilk_valor_tarihi: string | null;
  ilk_ihrac_tarihi: string | null;
};
type BistSatiri = {
  tarih: string;
  isin: string;
  kapanis_bilesik_getiri_pct: number | null;
  islem_hacmi_tl: number | null;
};

// veri_analiz/rv_backtest.py'deki Z_ESIK / UFUK_GUN ile AYNI -- tutarlılık için.
const TRADE_Z_ESIK = 1.0;
const TRADE_UFUK_GUN = 10;
/** Backtest'in likidite eşiği (deneysel.py::_MIN_HACIM_TL). */
const TRADE_MIN_HACIM_TL = 50_000_000;

const HACIM_SECENEKLERI: { etiket: string; deger: number }[] = [
  { etiket: "Tümü", deger: 0 },
  { etiket: "≥10 mn TL", deger: 10_000_000 },
  { etiket: "≥50 mn TL", deger: 50_000_000 },
  { etiket: "≥100 mn TL", deger: 100_000_000 },
  { etiket: "≥250 mn TL", deger: 250_000_000 },
];
const UFUK_SECENEKLERI = [1, 2, 3, 6, 9, 12];

/** "01.02.2026" ya da "2026-02-01" → UTC gece yarısı Date. */
function utcTarihe(s: string | null | undefined): Date | null {
  if (!s) return null;
  const tr = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (tr) return new Date(Date.UTC(+tr[3], +tr[2] - 1, +tr[1]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  return null;
}

function isoGoster(iso: string): string {
  const d = utcTarihe(iso);
  if (!d) return iso;
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

export function DeneyselClient({
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

  const tarihler = useMemo(
    () => Array.from(new Set(bist.map((r) => r.tarih))).sort().reverse(),
    [bist],
  );

  const fonlama = tlrefSonPct != null ? tlrefBilesikFonlama(tlrefSonPct) : null;

  /** Bir günün eğri kesiti -- Getiri eğrisi sayfasındaki hazırlıkla aynı. */
  const gunlukKesit = useCallback(
    (tarih: string, minHacimTl: number) => {
      const referans = utcTarihe(tarih);
      if (!referans) return [];
      return bist
        .filter((r) => r.tarih === tarih && (minHacimTl <= 0 || (r.islem_hacmi_tl ?? 0) >= minHacimTl))
        .map((r) => {
          const v = vadeBilgi.get(r.isin);
          if (!v?.vade || r.kapanis_bilesik_getiri_pct == null) return null;
          const kalanVadeYil = (v.vade.getTime() - referans.getTime()) / (365 * 86_400_000);
          if (kalanVadeYil <= 0) return null;
          return {
            isin: r.isin, senetTanimi: v.senetTanimi, vade: v.vade,
            kalanVadeYil, getiri: Number(r.kapanis_bilesik_getiri_pct),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r != null)
        .sort((a, b) => a.kalanVadeYil - b.kalanVadeYil);
    },
    [bist, vadeBilgi],
  );

  const [tradeTarih, setTradeTarih] = useState(tarihler[0] ?? "");
  const [crTarih, setCrTarih] = useState(tarihler[0] ?? "");
  const [crHacim, setCrHacim] = useState(50_000_000);
  const [crUfukAy, setCrUfukAy] = useState(3);

  // ~10 işlem günü (2 hafta) ≈ 0,5 ay -- rv_backtest.py'nin ufkunu Carry/Roll
  // hesabına yansıtmak için.
  const tradeRv = useMemo(
    () =>
      tradeTarih && fonlama != null
        ? rvEkraniOlustur(gunlukKesit(tradeTarih, TRADE_MIN_HACIM_TL), kuponMap, anchorMap, fonlama, utcTarihe(tradeTarih)!, 0.5)
        : null,
    [tradeTarih, fonlama, gunlukKesit, kuponMap, anchorMap],
  );

  const crRv = useMemo(
    () =>
      crTarih && fonlama != null
        ? rvEkraniOlustur(gunlukKesit(crTarih, crHacim), kuponMap, anchorMap, fonlama, utcTarihe(crTarih)!, crUfukAy)
        : null,
    [crTarih, crHacim, crUfukAy, fonlama, gunlukKesit, kuponMap, anchorMap],
  );

  if (tarihler.length === 0) {
    return <BosDurum baslik="BIST fiyat verisi bulunamadı." />;
  }

  return (
    <Tabs defaultValue="trade">
      <TabsList variant="line" className="mb-5 overflow-x-auto">
        <TabsTrigger value="trade" className="shrink-0">Trade Ekranı</TabsTrigger>
        <TabsTrigger value="carry" className="shrink-0">Carry/Roll Hesaplayıcı</TabsTrigger>
      </TabsList>

      <TabsContent value="trade" className="space-y-5">
        <TradeEkrani
          tarihler={tarihler}
          tarih={tradeTarih}
          setTarih={setTradeTarih}
          rv={tradeRv}
          tlrefSonPct={tlrefSonPct}
          fonlama={fonlama}
        />
      </TabsContent>

      <TabsContent value="carry" className="space-y-5">
        <CarryRoll
          tarihler={tarihler}
          tarih={crTarih}
          setTarih={setCrTarih}
          hacim={crHacim}
          setHacim={setCrHacim}
          ufukAy={crUfukAy}
          setUfukAy={setCrUfukAy}
          rv={crRv}
          tlrefSonPct={tlrefSonPct}
          fonlama={fonlama}
        />
      </TabsContent>
    </Tabs>
  );
}

// --------------------------------------------------------------------------
// Trade Ekranı -- "bugün ne yapmalıyım"
// --------------------------------------------------------------------------

function TradeEkrani({
  tarihler, tarih, setTarih, rv, tlrefSonPct, fonlama,
}: {
  tarihler: string[]; tarih: string; setTarih: (t: string) => void;
  rv: RvSatiri[] | null; tlrefSonPct: number | null; fonlama: number | null;
}) {
  const longAday = rv?.reduce((a, b) => (b.zSkoru > a.zSkoru ? b : a)) ?? null;
  const shortAday = rv?.reduce((a, b) => (b.zSkoru < a.zSkoru ? b : a)) ?? null;
  const sinyalVar =
    longAday != null && shortAday != null &&
    longAday.zSkoru >= TRADE_Z_ESIK && shortAday.zSkoru <= -TRADE_Z_ESIK &&
    longAday.isin !== shortAday.isin;

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">Bugün ne yapmalıyım</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          veri_analiz/rv_backtest.py&apos;deki AYNI kural: o günün Nelson-Siegel spread z-skoruna
          göre EN UCUZ kağıt (z ≥ +{sayi(TRADE_Z_ESIK, 1)}) LONG, EN PAHALI kağıt
          (z ≤ −{sayi(TRADE_Z_ESIK, 1)}) SHORT önerilir, ~{TRADE_UFUK_GUN} işlem günü
          (yaklaşık 2 hafta) taşınır. Likidite eşiği backtest ile aynı: günlük hacim ≥ 50 mn TL.
        </p>
      </div>

      <div className="max-w-xs">
        <IslemGunuSecici
          id="dny-trade-tarih"
          tarihler={tarihler}
          deger={tarih}
          onChange={setTarih}
          etiket="Tarih (varsayılan: en son işlem günü)"
        />
      </div>

      {fonlama == null ? (
        <BosDurum
          baslik="TLREF verisi yok"
          aciklama="Fonlama maliyeti bilinmediğinden Carry hesaplanamıyor."
        />
      ) : rv == null ? (
        <BosDurum
          baslik="Bu tarihte yeterli ISIN yok"
          aciklama="Nelson-Siegel uyarlaması için en az 5 kağıt gerekiyor."
        />
      ) : !sinyalVar ? (
        <BosDurum
          baslik={`${isoGoster(tarih)} — strateji sinyal VERMİYOR`}
          aciklama={
            `z-eşiğini (±${sayi(TRADE_Z_ESIK, 1)}) geçen bir çift yok. En yakın aday: ` +
            `LONG için z=${longAday ? sayi(longAday.zSkoru) : "–"} (${longAday?.isin ?? "–"}), ` +
            `SHORT için z=${shortAday ? sayi(shortAday.zSkoru) : "–"} (${shortAday?.isin ?? "–"}).`
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <AdayKarti aday={longAday!} yon="LONG (al)" olumlu />
            <AdayKarti aday={shortAday!} yon="SHORT (sat/fonla)" olumlu={false} />
          </div>

          <p className="text-sm text-muted-foreground">
            Fonlama: TLREF {yuzde(tlrefSonPct)} → {yuzde(fonlama)} efektif bileşik. Çiftin spread
            farkı {bps(longAday!.spreadBps - shortAday!.spreadBps)} — eğer TAMAMEN kapanırsa
            (iyimser varsayım) bu kadar konverjans kazancı demektir.
          </p>

          <div className="flex gap-3 rounded-lg border border-[var(--negatif)]/40 bg-[color-mix(in_oklch,var(--negatif)_8%,transparent)] px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--negatif)]" />
            <p className="text-sm">
              <b>Bu bir öneri değil, kuralın mekanik çıktısıdır.</b> Geçmiş backtest&apos;in dürüst
              sonucu: gerçekçi 30bp/bacak maliyetle bu kuralın ortalama getirisi NEGATİF
              (Sharpe −0,60) ve bazı çiftler (ör. TRT120929T12/TRT190728T18) hiç yakınsamadan
              tekrar tekrar açılıp kaybettirdi. Kendi kararını ver.
            </p>
          </div>
        </>
      )}
    </>
  );
}

function AdayKarti({ aday, yon, olumlu }: { aday: RvSatiri; yon: string; olumlu: boolean }) {
  const renk = olumlu ? "var(--pozitif)" : "var(--negatif)";
  return (
    <Card>
      <CardContent
        className="space-y-2 border-l-[3px] pt-5"
        style={{ borderLeftColor: renk }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: renk }}>
          {yon}
        </p>
        <p className="font-figures text-xl font-semibold">{aday.isin}</p>
        <p className="text-xs text-muted-foreground">{aday.senetTanimi ?? ""}</p>

        <div>
          <p className="text-xs text-muted-foreground">Z-skoru</p>
          <p className="font-figures text-2xl font-semibold">{sayi(aday.zSkoru)}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Vade {sayi(aday.kalanVadeYil)} yıl · Getiri {yuzde(aday.getiri)} · Spread{" "}
          {bps(aday.spreadBps)}
          {aday.modDur != null && ` · ModDur ${sayi(aday.modDur)}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {aday.carryBp != null && aday.rollBp != null
            ? `Carry ${bps(aday.carryBp)} · Roll ${bps(aday.rollBp)} (~${TRADE_UFUK_GUN} işlem günü ufkunda)`
            : "Carry/Roll: kupon/duration verisi eksik"}
        </p>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------------------
// Carry/Roll Hesaplayıcı
// --------------------------------------------------------------------------

function CarryRoll({
  tarihler, tarih, setTarih, hacim, setHacim, ufukAy, setUfukAy, rv, tlrefSonPct, fonlama,
}: {
  tarihler: string[]; tarih: string; setTarih: (t: string) => void;
  hacim: number; setHacim: (v: number) => void;
  ufukAy: number; setUfukAy: (v: number) => void;
  rv: RvSatiri[] | null; tlrefSonPct: number | null; fonlama: number | null;
}) {
  const cr = (rv ?? [])
    .filter((r) => r.modDur != null && r.carryBp != null && r.rollBp != null)
    .map((r) => ({ ...r, carryRollBp: r.carryBp! + r.rollBp! }))
    .sort((a, b) => b.carryRollBp - a.carryRollBp);

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Bir kağıdı seçilen ufuk boyunca fonlayıp elde tutmanın (taşımanın) beklenen kazancı —
        eğrinin ucuz/pahalı olduğuna dair HİÇBİR bahis içermez, sadece bugünkü getiri, bugünkü
        fonlama maliyeti ve eğrinin bugünkü şeklinden mekanik olarak hesaplanır.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <IslemGunuSecici
          id="dny-cr-tarih"
          tarihler={tarihler}
          deger={tarih}
          onChange={setTarih}
        />
        <div className="space-y-1.5">
          <label htmlFor="dny-cr-hacim" className="text-sm font-medium">Min. günlük hacim</label>
          <select
            id="dny-cr-hacim"
            value={hacim}
            onChange={(e) => setHacim(Number(e.target.value))}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            {HACIM_SECENEKLERI.map((s) => (
              <option key={s.deger} value={s.deger}>{s.etiket}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="dny-cr-ufuk" className="text-sm font-medium">Taşıma ufku (ay)</label>
          <select
            id="dny-cr-ufuk"
            value={ufukAy}
            onChange={(e) => setUfukAy(Number(e.target.value))}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            {UFUK_SECENEKLERI.map((a) => (
              <option key={a} value={a}>{a} ay</option>
            ))}
          </select>
        </div>
      </div>

      {fonlama == null ? (
        <BosDurum
          baslik="TLREF verisi yok"
          aciklama="Fonlama maliyeti bilinmediğinden Carry hesaplanamıyor."
        />
      ) : rv == null ? (
        <BosDurum
          baslik="Bu tarihte yeterli ISIN yok"
          aciklama="Nelson-Siegel uyarlaması için en az 5 kağıt gerekiyor."
        />
      ) : cr.length === 0 ? (
        <BosDurum
          baslik="Carry/Roll hesaplanamadı"
          aciklama="Bu tarihte kupon/duration bilgisi eksik."
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Fonlama (repo/TLREF maliyeti): {yuzde(tlrefSonPct)} (basit O/N) → {yuzde(fonlama)}{" "}
            efektif bileşik.
          </p>

          <div className="flex gap-3 rounded-lg border border-[var(--pozitif)]/40 bg-[color-mix(in_oklch,var(--pozitif)_8%,transparent)] px-4 py-3">
            <TrendingUp className="mt-0.5 size-4 shrink-0 text-[var(--pozitif)]" />
            <p className="text-sm">
              <b>En çok taşınmaya değer: {cr[0].isin}</b> ({sayi(cr[0].kalanVadeYil, 1)} yıl) —{" "}
              {ufukAy} ayda beklenen {bps(cr[0].carryRollBp)} (Carry {bps(cr[0].carryBp!)} + Roll{" "}
              {bps(cr[0].rollBp!)}).
            </p>
          </div>

          <OzetSerit
            alanlar={[
              { etiket: "En iyi Carry+Roll", deger: bps(cr[0].carryRollBp) },
              { etiket: "En kötü Carry+Roll", deger: bps(cr[cr.length - 1].carryRollBp) },
              { etiket: "Kağıt sayısı", deger: String(cr.length) },
            ]}
          />

          <Card>
            <CardContent className="space-y-3 pt-5">
              <h3 className="text-base font-semibold">
                {ufukAy} ayda beklenen Carry+Roll (bp)
              </h3>
              <CarryRollGrafigi
                veri={cr.map((r) => ({
                  isin: r.isin,
                  carryRollBp: r.carryRollBp,
                  kalanVadeYil: r.kalanVadeYil,
                }))}
              />
            </CardContent>
          </Card>

          <div className="max-h-[460px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ISIN</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead className="text-right">Vade (yıl)</TableHead>
                  <TableHead className="text-right">Getiri</TableHead>
                  <TableHead className="text-right">ModDur</TableHead>
                  <TableHead className="text-right">DV01</TableHead>
                  <TableHead className="text-right">Carry</TableHead>
                  <TableHead className="text-right">Roll</TableHead>
                  <TableHead className="text-right">Carry+Roll</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cr.map((r) => (
                  <TableRow key={r.isin}>
                    <TableCell className="font-figures whitespace-nowrap">{r.isin}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.senetTanimi ?? "–"}</TableCell>
                    <TableCell className="font-figures text-right">{sayi(r.kalanVadeYil)}</TableCell>
                    <TableCell className="font-figures text-right">{yuzde(r.getiri)}</TableCell>
                    <TableCell className="font-figures text-right">{sayi(r.modDur)}</TableCell>
                    <TableCell className="font-figures text-right">{sayi(r.dv01, 4)}</TableCell>
                    <TableCell className="font-figures text-right">{bps(r.carryBp)}</TableCell>
                    <TableCell className="font-figures text-right">{bps(r.rollBp)}</TableCell>
                    <TableCell className="font-figures text-right font-semibold">
                      {bps(r.carryRollBp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Muhasebe (modelleme değil):</p>
            <p>
              <b className="text-foreground">Carry (bp)</b> = (kağıdın bileşik getirisi − fonlama
              maliyeti) × ({ufukAy}/12) × 100 — kağıdı elde tutup fonlamanın net kazancı/kaybı,
              eğri hiç kıpırdamasa BİLE gerçekleşir.
            </p>
            <p>
              <b className="text-foreground">Roll-down (bp)</b> = eğri BUGÜNKÜ haliyle sabit
              kalırsa, kağıt vade kısaldıkça eğri üzerinde daha kısa vadeye &quot;kayar&quot; —
              eğri normal (pozitif eğimli) durduğunda bu genelde kazanç getirir. Nelson-Siegel
              burada SADECE bugünün eğri şeklini yakalamak için kullanılıyor, gelecek tahmini
              için DEĞİL.
            </p>
            <p>
              <b className="text-foreground">Konverjans/z-skoru bilerek YOK</b> — &quot;bu kağıt
              ucuz, zenginleşecek&quot; gibi bir bahis içermiyor (o, Getiri eğrisi sayfasının en
              altındaki Nelson-Siegel RV bölümünde ayrı gösteriliyor); burada sadece zamanın
              geçmesinin mekanik muhasebesi var.
            </p>
          </div>
        </>
      )}
    </>
  );
}
