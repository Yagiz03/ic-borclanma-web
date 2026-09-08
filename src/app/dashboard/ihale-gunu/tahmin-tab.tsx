"use client";

import { BosDurum } from "@/components/bos-durum";
import { Fragment, useCallback, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  aylikDagilimTahminiOlustur,
  ayKalanPlanHesapla,
  benzerIhaleleriBul,
  ihaleVerisiHazirla,
  medyan,
  ortalama,
  ozetPenceresiSec,
  vadeYilCikar,
  yaklasanIhaleleriBul,
  type DagilimSatiri,
  type IhaleHam,
  type IhalePrep,
  type TakvimSatiri,
} from "@/lib/ihale-gunu";

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function milyonFmt(v: number | null): string {
  return v == null ? "–" : v.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

function KagitGecmisi({ isin, ihale }: { isin: string; ihale: IhalePrep[] }) {
  const gecmis = useMemo(
    () =>
      ihale
        .filter((r) => r.isin === isin)
        .sort((a, b) => b.ihaleTarihiD.getTime() - a.ihaleTarihiD.getTime())
        .slice(0, 8),
    [ihale, isin],
  );
  if (gecmis.length === 0) return <p className="p-3 text-xs text-muted-foreground">Bu ISIN için geçmiş ihale sonucu yok.</p>;
  return (
    <div className="overflow-x-auto p-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="px-2 py-1 font-medium text-xs uppercase tracking-wide text-muted-foreground">Tarih</th>
            <th className="px-2 py-1 font-medium text-xs uppercase tracking-wide text-muted-foreground">En Düşük</th>
            <th className="px-2 py-1 font-medium text-xs uppercase tracking-wide text-muted-foreground">Ortalama</th>
            <th className="px-2 py-1 font-medium text-xs uppercase tracking-wide text-muted-foreground">En Yüksek</th>
            <th className="px-2 py-1 font-medium text-xs uppercase tracking-wide text-muted-foreground">Tail (bps)</th>
            <th className="px-2 py-1 font-medium text-xs uppercase tracking-wide text-muted-foreground">Piyasadan İhale (Mn TL)</th>
          </tr>
        </thead>
        <tbody>
          {gecmis.map((r, i) => (
            <tr key={i} className="border-t border-border/60">
              <td className="font-figures px-2 py-1">{r.ihaleTarihiD.toLocaleDateString("tr-TR")}</td>
              <td className="font-figures px-2 py-1">{r.en_dusuk_bilesik_gerceklesme?.toFixed(2) ?? "–"}</td>
              <td className="font-figures px-2 py-1">{r.ort_yillik_bilesik_gerceklesme?.toFixed(2) ?? "–"}</td>
              <td className="font-figures px-2 py-1">{r.en_yuksek_bilesik_gerceklesme?.toFixed(2) ?? "–"}</td>
              <td className="font-figures px-2 py-1">{r.tail_bps ?? "–"}</td>
              <td className="font-figures px-2 py-1">{milyonFmt(r.piyasadanIhaleMn)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DagilimTablosu({ dagilim, ihale }: { dagilim: DagilimSatiri[]; ihale: IhalePrep[] }) {
  const [acikIsin, setAcikIsin] = useState<string | null>(null);
  return (
    <div className="max-h-[480px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wide text-muted-foreground">İhale tarihi</th>
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wide text-muted-foreground">ISIN</th>
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wide text-muted-foreground">Senet</th>
            <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wide text-muted-foreground">Miktar (Mn TL)</th>
            <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wide text-muted-foreground">Yüzdelik</th>
            <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wide text-muted-foreground">Tail (bps)</th>
          </tr>
        </thead>
        <tbody>
          {dagilim.map((r, i) => {
            const tiklanabilir = r.isin !== "–";
            const acik = acikIsin === r.isin;
            return (
              <Fragment key={i}>
                <tr
                  onClick={() => tiklanabilir && setAcikIsin(acik ? null : r.isin)}
                  className={`border-b border-border/60 ${tiklanabilir ? "cursor-pointer hover:bg-accent/40" : ""}`}
                >
                  <td className="font-figures px-3 py-2 whitespace-nowrap">{r.ihaleTarihi}</td>
                  <td className="font-figures px-3 py-2">
                    {r.isin} {tiklanabilir && <span className="opacity-50">▾</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.senet}</td>
                  <td className="px-3 py-2 text-right">
                    {r.gerceklesti ? (
                      <>
                        <span className="text-destructive/70 line-through opacity-65">{milyonFmt(r.tahminMiktar)}</span>{" "}
                        <strong className="font-figures">{milyonFmt(r.miktar)}</strong>
                      </>
                    ) : (
                      <span className="font-figures">{milyonFmt(r.miktar)}</span>
                    )}
                  </td>
                  <td className="font-figures px-3 py-2 text-right">{r.yuzde != null ? `%${r.yuzde.toFixed(1)}` : "–"}</td>
                  <td className="px-3 py-2 text-right">
                    {r.gerceklesti ? (
                      <>
                        <span className="text-destructive/70 line-through opacity-65">
                          {r.tahminTail != null ? r.tahminTail.toFixed(0) : "–"}
                        </span>{" "}
                        <strong className="font-figures">{r.tailBps != null ? r.tailBps.toFixed(0) : "–"}</strong>
                      </>
                    ) : (
                      <span className="font-figures">{r.tailBps != null ? r.tailBps.toFixed(0) : "–"}</span>
                    )}
                  </td>
                </tr>
                {tiklanabilir && acik && (
                  <tr>
                    <td colSpan={6} className="bg-accent/20 p-0">
                      <KagitGecmisi isin={r.isin} ihale={ihale} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TahminTab({
  ihaleHam, takvim, planlar,
}: {
  ihaleHam: IhaleHam[];
  takvim: TakvimSatiri[];
  planlar: { yil: number; ay: number; piyasadan_ihale: number | null }[];
}) {
  const ihale = useMemo(() => ihaleVerisiHazirla(ihaleHam), [ihaleHam]);
  const bugun = useMemo(() => new Date(), []);
  const yil = bugun.getFullYear();
  const ayNo = bugun.getMonth() + 1;

  // aylikDagilimTahminiOlustur "O AYIN takvimi"ni bekliyor; tüm ihrac_takvimi
  // tablosu verilince Ekim/Kasım ihaleleri de "Bu ayın ihale dağılımı
  // tahmini" tablosuna sızıyordu (Python tarafı ay_label ile o ayın
  // satırlarını alıyor).
  //
  // TEKİLLEŞTİRME de burada: Python tarafı TEK bir strateji belgesinin
  // ihraç takvimini okuyor, bizim ihrac_takvimi tablosu ise arka arkaya
  // yayımlanan belgelerin hepsini biriktiriyor -- aynı ihale birden çok
  // satır oluyordu. Bu sadece tabloyu tekrarlamıyor, AĞIRLIKLARI da
  // bozuyordu (aynı ihale iki kez sayılınca yüzdelikler kayıyor).
  const ayinTakvimi = useCallback(
    (hedefYil: number, hedefAy: number) => {
      const onEk = `${hedefYil}-${String(hedefAy).padStart(2, "0")}`;
      const gorulen = new Set<string>();
      return takvim.filter((r) => {
        const t = String(r.tarih).slice(0, 10);
        if (!t.startsWith(onEk)) return false;
        const anahtar = `${t}|${r.yontem}|${r.senet_turu}|${r.vade}|${r.itfa_tarihi ?? ""}`;
        if (gorulen.has(anahtar)) return false;
        gorulen.add(anahtar);
        return true;
      });
    },
    [takvim],
  );

  const planBu = planlar.find((p) => p.yil === yil && p.ay === ayNo);
  const kalanBu = ayKalanPlanHesapla(ihale, planBu?.piyasadan_ihale ?? null, yil, ayNo);
  const dagilimBu = useMemo(
    () =>
      aylikDagilimTahminiOlustur(
        ihale, ayinTakvimi(yil, ayNo), planBu?.piyasadan_ihale ?? null, kalanBu, bugun,
      ),
    [ihale, ayinTakvimi, yil, ayNo, planBu, kalanBu, bugun],
  );

  const gelecekAyNo = ayNo < 12 ? ayNo + 1 : 1;
  const gelecekYil = ayNo < 12 ? yil : yil + 1;
  const planGelecek = planlar.find((p) => p.yil === gelecekYil && p.ay === gelecekAyNo);
  // Her render'da yeni bir Date üretmek aşağıdaki useMemo'yu geçersiz kılıyor
  // (React Compiler da bu yüzden bileşeni optimize etmeden geçiyordu) --
  // kimliği yıl/ay ilkelleri üzerinden sabitleniyor.
  const gelecekAyIlkGunu = useMemo(
    () => new Date(gelecekYil, gelecekAyNo - 1, 1),
    [gelecekYil, gelecekAyNo],
  );
  const kalanGelecek = ayKalanPlanHesapla(ihale, planGelecek?.piyasadan_ihale ?? null, gelecekYil, gelecekAyNo);
  const dagilimGelecek = useMemo(
    () =>
      aylikDagilimTahminiOlustur(
        ihale, ayinTakvimi(gelecekYil, gelecekAyNo),
        planGelecek?.piyasadan_ihale ?? null, kalanGelecek, gelecekAyIlkGunu,
      ),
    [ihale, ayinTakvimi, gelecekYil, gelecekAyNo, planGelecek, kalanGelecek, gelecekAyIlkGunu],
  );
  const [gelecekAcik, setGelecekAcik] = useState(false);

  const senetTipleri = useMemo(
    () => Array.from(new Set(ihale.map((r) => r.senet_tanimi).filter((s): s is string => !!s))).sort(),
    [ihale],
  );

  const yaklasan = useMemo(() => yaklasanIhaleleriBul(takvim, bugun), [takvim, bugun]);
  const [yaklasanIdx, setYaklasanIdx] = useState(0);
  const secilenYaklasan = yaklasan[yaklasanIdx];

  const varsayilanSenetTipi =
    secilenYaklasan && senetTipleri.includes(secilenYaklasan.senet_turu)
      ? secilenYaklasan.senet_turu
      : senetTipleri.includes("Sabit Kuponlu Devlet Tahvili")
        ? "Sabit Kuponlu Devlet Tahvili"
        : (senetTipleri[0] ?? "");
  const varsayilanVadeYil = (secilenYaklasan ? vadeYilCikar(secilenYaklasan.vade) : null) ?? 5.0;

  const [senetTipi, setSenetTipi] = useState(varsayilanSenetTipi);
  const [hedefVadeYil, setHedefVadeYil] = useState(varsayilanVadeYil);
  const [manuelDegistirildi, setManuelDegistirildi] = useState(false);

  // Yaklaşan ihale seçimi değişince, kullanıcı henüz elle bir şey değiştirmediyse
  // senet tipi/vade alanlarını o ihaleye göre güncelle (Python'daki varsayılan
  // değer davranışıyla tutarlı).
  const sonSecilenIsin = secilenYaklasan ? `${secilenYaklasan.tarih}-${secilenYaklasan.senet_turu}` : null;
  const [izlenenSecim, setIzlenenSecim] = useState(sonSecilenIsin);
  if (sonSecilenIsin !== izlenenSecim && !manuelDegistirildi) {
    setIzlenenSecim(sonSecilenIsin);
    setSenetTipi(varsayilanSenetTipi);
    setHedefVadeYil(varsayilanVadeYil);
  }

  const benzer = useMemo(
    () => (senetTipi ? benzerIhaleleriBul(ihale, senetTipi, hedefVadeYil) : []),
    [ihale, senetTipi, hedefVadeYil],
  );
  const yeterli = benzer.length >= 3;
  const sonBenzer = useMemo(() => (yeterli ? ozetPenceresiSec(benzer) : []), [benzer, yeterli]);

  if (ihale.length === 0) {
    return <BosDurum baslik="İhale sonucu bulunamadı" aciklama="Tahmin için geçmiş ihale sonuçları gerekiyor; veri aktarımı tamamlandığında burada görünecek." />;
  }

  return (
    <div className="space-y-6">
      {dagilimBu.length > 0 && (
        <div>
          <h3 className="text-base font-semibold">Bu ayın ihale dağılımı tahmini</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Bir satıra tıklayınca o kağıdın geçmiş piyasadan ihale sonuçları/tail&apos;leri hemen altında açılır.
          </p>
          <DagilimTablosu dagilim={dagilimBu} ihale={ihale} />
        </div>
      )}

      <div className="rounded-lg border border-border">
        <button
          onClick={() => setGelecekAcik((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
        >
          Gelecek ay ({gelecekYil} {AY_ADLARI[gelecekAyNo - 1]}) ihale dağılım tahmini
          <span className="text-muted-foreground">{gelecekAcik ? "▲" : "▼"}</span>
        </button>
        {gelecekAcik && (
          <div className="border-t border-border p-4">
            {dagilimGelecek.length === 0 ? (
              <p className="text-sm text-muted-foreground">Gelecek ay için henüz arşivlenmiş bir strateji planı/ihraç takvimi yok.</p>
            ) : (
              <DagilimTablosu dagilim={dagilimGelecek} ihale={ihale} />
            )}
          </div>
        )}
      </div>

      {yaklasan.length > 0 ? (
        <div className="rounded-lg border border-border p-4">
          <h3 className="mb-3 text-sm font-semibold">Bu ayki ihaleler</h3>
          {yaklasan.length === 1 ? (
            <p className="text-sm">
              {yaklasan[0].tarihD.toLocaleDateString("tr-TR")} — {yaklasan[0].senet_turu} ({yaklasan[0].vade})
            </p>
          ) : (
            <select
              value={yaklasanIdx}
              onChange={(e) => setYaklasanIdx(Number(e.target.value))}
              className="block w-full max-w-md rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {yaklasan.map((y, i) => (
                <option key={i} value={i}>
                  {y.tarihD.toLocaleDateString("tr-TR")} — {y.senet_turu} ({y.vade})
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Bu ay planlanmış bir ihale bulunamadı — aşağıdaki &quot;Manuel senet tipi / vade seçimi&quot; bölümünden
          istediğin senet tipi/vadeyi analiz edebilirsin.
        </p>
      )}

      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-3 text-sm font-semibold">Manuel senet tipi / vade seçimi</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground" htmlFor="senet-tipi">Senet tipi</label>
            <select
              id="senet-tipi" value={senetTipi}
              onChange={(e) => { setManuelDegistirildi(true); setSenetTipi(e.target.value); }}
              className="block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {senetTipleri.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground" htmlFor="hedef-vade">Hedef vade (yıl)</label>
            <input
              id="hedef-vade" type="number" min={0.1} max={15} step={0.5} value={hedefVadeYil}
              onChange={(e) => { setManuelDegistirildi(true); setHedefVadeYil(Number(e.target.value)); }}
              className="block w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm font-figures"
            />
          </div>
        </div>
      </div>

      {!yeterli ? (
        <p className="text-sm text-muted-foreground">
          &apos;{senetTipi}&apos; için {hedefVadeYil.toFixed(1)} yıl vadeye yakın (±1,5 yıl) yeterli sayıda geçmiş
          ihale bulunamadı (bulunan: {benzer.length}, gereken: en az 3). Vadeyi veya senet tipini değiştirmeyi dene.
        </p>
      ) : (
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Detaylı analiz — {sonBenzer.length} benzer ihale (toplam {benzer.length} bulundu)</h3>
          <p className="text-sm text-muted-foreground">
            Aşağıdaki özet, yılbaşından bugüne gerçekleşen {sonBenzer.length} ihaleye dayanıyor (bu yıl içinde yeterli
            örnek yoksa son 6 ihaleye düşülür) — faiz seviyesi yıllar içinde çok değiştiğinden, tüm tarihçenin
            ortalaması güncel koşulları yansıtmaz.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Medyan tail</p>
              <p className="font-figures font-semibold">{medyan(sonBenzer.map((r) => r.tail_bps ?? NaN))?.toFixed(0) ?? "–"} bps</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Ort. talep karşılanma</p>
              <p className="font-figures font-semibold">
                %{ortalama(sonBenzer.map((r) => r.toplam_oran_pct))?.toFixed(1) ?? "–"}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Kabul edilen aralık (ort.)</p>
              <p className="font-figures font-semibold">
                %{ortalama(sonBenzer.map((r) => r.en_dusuk_bilesik_gerceklesme))?.toFixed(2) ?? "–"} —{" "}
                %{ortalama(sonBenzer.map((r) => r.en_yuksek_bilesik_gerceklesme))?.toFixed(2) ?? "–"}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium text-xs uppercase tracking-wide text-muted-foreground">Tarih</th>
                  <th className="px-3 py-2 font-medium text-xs uppercase tracking-wide text-muted-foreground">ISIN</th>
                  <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wide text-muted-foreground">Vade (yıl)</th>
                  <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wide text-muted-foreground">En Düşük Kabul</th>
                  <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wide text-muted-foreground">Ortalama Kabul</th>
                  <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wide text-muted-foreground">En Yüksek Kabul</th>
                  <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wide text-muted-foreground">Tail (bps)</th>
                  <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wide text-muted-foreground">Piyasadan İhale (Mn TL)</th>
                </tr>
              </thead>
              <tbody>
                {[...sonBenzer].sort((a, b) => a.ihaleTarihiD.getTime() - b.ihaleTarihiD.getTime()).map((r, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="font-figures px-3 py-2 whitespace-nowrap">{r.ihaleTarihiD.toLocaleDateString("tr-TR")}</td>
                    <td className="font-figures px-3 py-2">{r.isin}</td>
                    <td className="font-figures px-3 py-2 text-right">{r.vadeYil.toFixed(2)}</td>
                    <td className="font-figures px-3 py-2 text-right">{r.en_dusuk_bilesik_gerceklesme?.toFixed(2) ?? "–"}</td>
                    <td className="font-figures px-3 py-2 text-right">{r.ort_yillik_bilesik_gerceklesme?.toFixed(2) ?? "–"}</td>
                    <td className="font-figures px-3 py-2 text-right">{r.en_yuksek_bilesik_gerceklesme?.toFixed(2) ?? "–"}</td>
                    <td className="font-figures px-3 py-2 text-right">{r.tail_bps ?? "–"}</td>
                    <td className="font-figures px-3 py-2 text-right">{milyonFmt(r.piyasadanIhaleMn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold">Her ihalede kabul edilen getiri aralığı ve ortalama</h4>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart
                data={[...sonBenzer]
                  .sort((a, b) => a.ihaleTarihiD.getTime() - b.ihaleTarihiD.getTime())
                  .map((r) => ({
                    // ISIN etikete sığmıyordu (döndürülmüş uzun yazılar);
                    // eksende sadece tarih var, ISIN tooltip'te.
                    etiket: r.ihaleTarihiD.toLocaleDateString("tr-TR"),
                    isin: r.isin,
                    // Recharts'ın DİZİ değerli (floating) çubuğu: [alt, üst].
                    // Önce "görünmez taban + fark" yığını vardı; yığılmış çubuk
                    // Y eksenini zorla 0'dan başlattığı için domain ayarı yok
                    // sayılıyor, %33-40'lık veri tepeye eziliyordu.
                    aralik:
                      r.en_dusuk_bilesik_gerceklesme != null && r.en_yuksek_bilesik_gerceklesme != null
                        ? [r.en_dusuk_bilesik_gerceklesme, r.en_yuksek_bilesik_gerceklesme]
                        : null,
                    ortalama: r.ort_yillik_bilesik_gerceklesme,
                    enDusuk: r.en_dusuk_bilesik_gerceklesme,
                    enYuksek: r.en_yuksek_bilesik_gerceklesme,
                  }))}
                margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="etiket" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={0} height={28} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  width={56}
                  domain={["dataMin - 0.3", "dataMax + 0.3"]}
                  tickFormatter={(v) => `%${Number(v).toFixed(1)}`}
                />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(etiket, yuk) => {
                    const p = yuk?.[0]?.payload as { isin?: string } | undefined;
                    return p?.isin ? `${etiket} — ${p.isin}` : String(etiket);
                  }}
                  formatter={(v, name, item) => {
                    if (name === "aralik") {
                      const p = item.payload as { enDusuk: number | null; enYuksek: number | null };
                      return [`%${p.enDusuk?.toFixed(2)} — %${p.enYuksek?.toFixed(2)}`, "Kabul aralığı"];
                    }
                    if (name === "ortalama") return [`%${Number(v).toFixed(2)}`, "Ortalama kabul"];
                    return [v, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" height={28} />
                <Bar dataKey="aralik" fill="var(--chart-1)" fillOpacity={0.35} radius={[3, 3, 3, 3]} name="Kabul aralığı (en düşük — en yüksek)" />
                <Scatter dataKey="ortalama" fill="var(--chart-1)" name="Ortalama kabul" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
