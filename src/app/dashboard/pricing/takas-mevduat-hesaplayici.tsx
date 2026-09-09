"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { takasHesapla, mevduatHesapla, takasPatikasi, mevduatPatikasi, onRepoPatikasi, type OranDonemi } from "@/lib/takas-repo";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function pct(x: number): string {
  return `%${(x * 100).toFixed(4)}`;
}

function tarihFmt(v: string) {
  return new Date(v).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
}

function patikaVerisi(urunPatika: Map<string, number>, onPatika: Map<string, number>) {
  const tarihler = Array.from(new Set([...urunPatika.keys(), ...onPatika.keys()])).sort();
  return tarihler.map((t) => ({ tarih: t, urun: urunPatika.get(t) ?? null, on: onPatika.get(t) ?? null }));
}

function MetrikKart({ etiket, deger, yardim }: { etiket: string; deger: string; yardim?: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{etiket}</p>
      <p className="font-figures text-lg font-semibold">{deger}</p>
      {yardim && <p className="mt-1 text-xs text-muted-foreground">{yardim}</p>}
    </div>
  );
}

export function TakasMevduatHesaplayici({
  koridor, politikaFaizi, ppkGunleri,
}: {
  koridor: { altBant: number; ustBant: number } | null;
  politikaFaizi: number | null;
  ppkGunleri: string[];
}) {
  const [gunTakas, setGunTakas] = useState(8);
  const [oranTakas, setOranTakas] = useState(40.4);
  const [gunMevduat, setGunMevduat] = useState(8);
  const [oranMevduat, setOranMevduat] = useState(40.4);

  const bugun = useMemo(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }, []);

  // --- Senaryo analizi: Takas / Mevduat vs O/N repo rulo ---
  const [onBaslangic, setOnBaslangic] = useState(koridor?.ustBant ?? 40.0);
  const ufuk = Math.max(gunTakas, gunMevduat);
  const ufukBitis = useMemo(() => {
    const d = new Date(bugun.getTime());
    d.setUTCDate(d.getUTCDate() + ufuk);
    return d;
  }, [bugun, ufuk]);
  const ppkPencerede = useMemo(
    () => ppkGunleri.filter((t) => new Date(t).getTime() > bugun.getTime() && new Date(t).getTime() <= ufukBitis.getTime()),
    [ppkGunleri, bugun, ufukBitis],
  );
  const [ppkOranlari, setPpkOranlari] = useState<Record<string, number>>({});

  const oranDonemleri: OranDonemi[] = useMemo(() => {
    const donemler: OranDonemi[] = [{ baslangic: bugun, oran: onBaslangic / 100 }];
    for (const t of ppkPencerede) {
      const ertesi = new Date(t);
      ertesi.setUTCDate(ertesi.getUTCDate() + 1);
      donemler.push({ baslangic: ertesi, oran: (ppkOranlari[t] ?? onBaslangic) / 100 });
    }
    return donemler;
  }, [bugun, ppkPencerede, ppkOranlari, onBaslangic]);

  const takasSenaryo = useMemo(
    () => patikaVerisi(takasPatikasi(gunTakas, oranTakas / 100, bugun), onRepoPatikasi(gunTakas, oranDonemleri, bugun)),
    [gunTakas, oranTakas, bugun, oranDonemleri],
  );
  const mevduatSenaryo = useMemo(
    () => patikaVerisi(mevduatPatikasi(gunMevduat, oranMevduat / 100, bugun), onRepoPatikasi(gunMevduat, oranDonemleri, bugun)),
    [gunMevduat, oranMevduat, bugun, oranDonemleri],
  );

  const takasSonuc = useMemo(() => {
    if (!Number.isFinite(gunTakas) || gunTakas < 1) return null;
    return takasHesapla(gunTakas, oranTakas / 100, bugun);
  }, [gunTakas, oranTakas, bugun]);

  const mevduatSonuc = useMemo(() => {
    if (!Number.isFinite(gunMevduat) || gunMevduat < 1) return null;
    return mevduatHesapla(gunMevduat, oranMevduat / 100, bugun);
  }, [gunMevduat, oranMevduat, bugun]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Gün ve oran girerek O/N repo eşleniğini hesaplar. İş günü sayısı, hafta sonlarının yanında Türkiye
        resmi tatillerini (dini bayramlar dahil) de eler. Takas komisyonu: ≤8 gün için sabit 3,4776/100bin,
        üzerinde gün başına 0,40572/100bin. O/N eşleniğe günlük repo komisyonu (6,825×10⁻⁶) dahildir.
        Oranlar yıllık yüzde olarak girilir (ör. 40,4 = %40,4).
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h3 className="text-base font-semibold">Takas → O/N</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="gun-takas">Gün</Label>
                <Input
                  id="gun-takas"
                  type="number"
                  min={1}
                  max={3650}
                  value={gunTakas}
                  onChange={(e) => setGunTakas(Number(e.target.value))}
                  className="font-figures"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oran-takas">Takas oranı (%)</Label>
                <Input
                  id="oran-takas"
                  inputMode="decimal"
                  value={oranTakas}
                  onChange={(e) => setOranTakas(Number(e.target.value.replace(",", ".")))}
                  className="font-figures"
                />
              </div>
            </div>
            {takasSonuc && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <MetrikKart etiket="Repo eşleniği" deger={pct(takasSonuc.onEslenik)} />
                  <MetrikKart
                    etiket="Net O/N eşlenik"
                    deger={pct(takasSonuc.netOnEslenik)}
                    yardim="Her gün O/N mevduat yapılıyormuş gibi — komisyonsuz."
                  />
                  <MetrikKart etiket="Mevduat eşleniği" deger={pct(takasSonuc.mevduatEslenigi!)} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Getiri (100 üzerinden): {takasSonuc.getiri.toFixed(6)} — iş günü: {takasSonuc.isGunu} /{" "}
                  {gunTakas} takvim günü
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <h3 className="text-base font-semibold">Mevduat → O/N</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="gun-mevduat">Gün</Label>
                <Input
                  id="gun-mevduat"
                  type="number"
                  min={1}
                  max={3650}
                  value={gunMevduat}
                  onChange={(e) => setGunMevduat(Number(e.target.value))}
                  className="font-figures"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oran-mevduat">Mevduat oranı (%)</Label>
                <Input
                  id="oran-mevduat"
                  inputMode="decimal"
                  value={oranMevduat}
                  onChange={(e) => setOranMevduat(Number(e.target.value.replace(",", ".")))}
                  className="font-figures"
                />
              </div>
            </div>
            {mevduatSonuc && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <MetrikKart etiket="Repo eşleniği" deger={pct(mevduatSonuc.onEslenik)} />
                  <MetrikKart
                    etiket="Net O/N eşlenik"
                    deger={pct(mevduatSonuc.netOnEslenik)}
                    yardim="Her gün O/N mevduat yapılıyormuş gibi — komisyonsuz."
                  />
                  <MetrikKart etiket="Takas eşleniği" deger={pct(mevduatSonuc.takasEslenigi!)} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Getiri (100 üzerinden): {mevduatSonuc.getiri.toFixed(6)} — iş günü: {mevduatSonuc.isGunu} /{" "}
                  {gunMevduat} takvim günü
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <h3 className="text-base font-semibold">Senaryo analizi: Takas / Mevduat vs O/N repo</h3>
          {koridor && (
            <p className="text-sm text-muted-foreground">
              Güncel TCMB koridoru — Alt bant: %{koridor.altBant.toFixed(2)}
              {politikaFaizi != null && ` · Politika faizi: %${politikaFaizi.toFixed(2)}`} · Üst bant (tavan): %
              {koridor.ustBant.toFixed(2)} — O/N repo pratikte tavana yakın seyrettiği için başlangıç değeri üst
              banttır, istersen değiştirebilirsin.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="on-baslangic">O/N repo başlangıç oranı (%)</Label>
            <Input
              id="on-baslangic"
              inputMode="decimal"
              value={onBaslangic}
              onChange={(e) => setOnBaslangic(Number(e.target.value.replace(",", ".")))}
              className="w-40 font-figures"
            />
          </div>

          {ppkPencerede.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ppkPencerede.map((t) => (
                <div key={t} className="space-y-2">
                  <Label htmlFor={`ppk-${t}`}>{tarihFmt(t)} PPK sonrası O/N (%)</Label>
                  <Input
                    id={`ppk-${t}`}
                    inputMode="decimal"
                    value={ppkOranlari[t] ?? onBaslangic}
                    onChange={(e) => setPpkOranlari((o) => ({ ...o, [t]: Number(e.target.value.replace(",", ".")) }))}
                    className="w-32 font-figures"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Seçilen pencerede PPK toplantısı yok — O/N oranı sabit ilerletilir.</p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">
                Takas (%{oranTakas.toFixed(2)}, {gunTakas} gün) vs O/N
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={takasSenaryo} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="tarih" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={tarihFmt} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={52} domain={["dataMin - 0.2", "dataMax + 0.2"]} tickFormatter={(v) => Number(v).toFixed(2)} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v) => (typeof v === "string" ? tarihFmt(v) : "")}
                    formatter={(v, isim) => [Number(v).toFixed(4), isim]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {ppkPencerede.map((t) => (
                    <ReferenceLine key={t} x={t} stroke="var(--muted-foreground)" strokeDasharray="2 2" />
                  ))}
                  <Line type="monotone" dataKey="urun" name="Takas" stroke="var(--chart-1)" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="on" name="O/N repo rulo" stroke="var(--chart-5)" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">
                Mevduat (%{oranMevduat.toFixed(2)}, {gunMevduat} gün) vs O/N
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mevduatSenaryo} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="tarih" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={tarihFmt} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={52} domain={["dataMin - 0.2", "dataMax + 0.2"]} tickFormatter={(v) => Number(v).toFixed(2)} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v) => (typeof v === "string" ? tarihFmt(v) : "")}
                    formatter={(v, isim) => [Number(v).toFixed(4), isim]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {ppkPencerede.map((t) => (
                    <ReferenceLine key={t} x={t} stroke="var(--muted-foreground)" strokeDasharray="2 2" />
                  ))}
                  <Line type="monotone" dataKey="urun" name="Mevduat" stroke="var(--pozitif)" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="on" name="O/N repo rulo" stroke="var(--chart-5)" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            O/N çizgisi her iş günü çevrilen (rollover) repoyu izler: hafta sonu ve resmi tatil bloklarının
            başında komisyon peşin düştüğü için küçük bir yavaşlama görünür. Noktalı dikey çizgiler PPK karar
            günleri; O/N oranı karar ertesi günden itibaren senaryo oranına geçer. Takas çizgisinde komisyon 1.
            gün, mevduatta komisyon yok.
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Hesap tarayıcıda anlık çalışır.</p>
    </div>
  );
}
