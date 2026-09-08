"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Satir = {
  tarih: string;
  vade_gun: string;
  min_oran: number | null;
  maks_oran: number | null;
  ort_oran: number | null;
  islem_hacmi_tl: number | null;
  islem_hacmi_usd: number | null;
  islem_sayisi: number | null;
};

const RENK = "var(--chart-1)";

function vadeGunSayi(vadeGun: string): number {
  return vadeGun === "O/N" ? 0 : Number(vadeGun);
}

function tarihFmt(v: string) {
  return new Date(v).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function yuzde(v: number | null): string {
  return v == null ? "–" : `%${v.toFixed(2)}`;
}

function sayi(v: number | null, ondalik = 0): string {
  return v == null ? "–" : v.toLocaleString("tr-TR", { maximumFractionDigits: ondalik });
}

export function TppClient({ veri }: { veri: Satir[] }) {
  const onSerisi = useMemo(
    () => veri.filter((r) => r.vade_gun === "O/N").sort((a, b) => a.tarih.localeCompare(b.tarih)),
    [veri],
  );
  const tarihler = useMemo(
    () => Array.from(new Set(veri.map((r) => r.tarih))).sort().reverse(),
    [veri],
  );
  const [seciliTarih, setSeciliTarih] = useState(tarihler[0] ?? "");
  const gunVerisi = useMemo(
    () => veri.filter((r) => r.tarih === seciliTarih).sort((a, b) => vadeGunSayi(a.vade_gun) - vadeGunSayi(b.vade_gun)),
    [veri, seciliTarih],
  );

  const tarihMin = tarihler[tarihler.length - 1] ?? "";
  const tarihMax = tarihler[0] ?? "";
  const [aralikBaslangic, setAralikBaslangic] = useState(tarihMin);
  const [aralikBitis, setAralikBitis] = useState(tarihMax);
  const aralikVerisi = useMemo(
    () =>
      veri
        .filter((r) => r.tarih >= aralikBaslangic && r.tarih <= aralikBitis)
        .sort((a, b) => (a.tarih === b.tarih ? vadeGunSayi(a.vade_gun) - vadeGunSayi(b.vade_gun) : a.tarih.localeCompare(b.tarih))),
    [veri, aralikBaslangic, aralikBitis],
  );

  const son = onSerisi[onSerisi.length - 1];

  return (
    <Tabs defaultValue="on">
      <TabsList className="mb-4 h-auto w-full justify-start overflow-x-auto">
        <TabsTrigger value="on" className="shrink-0">Gecelik (O/N)</TabsTrigger>
        <TabsTrigger value="egri" className="shrink-0">Vade Yapısı</TabsTrigger>
        <TabsTrigger value="tablo" className="shrink-0">Tüm Veri</TabsTrigger>
      </TabsList>

      <TabsContent value="on">
        {!son ? (
          <p className="text-sm text-muted-foreground">takasbank_tpp verisi henüz yüklenmedi.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-xs text-muted-foreground">Son Ortalama Oran (O/N)</div>
                  <div className="font-figures mt-1 text-xl font-semibold">{yuzde(son.ort_oran)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{tarihFmt(son.tarih)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-xs text-muted-foreground">Gün İçi Min-Maks</div>
                  <div className="font-figures mt-1 text-xl font-semibold">
                    {yuzde(son.min_oran)} - {yuzde(son.maks_oran)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-xs text-muted-foreground">İşlem Hacmi (Milyar TL)</div>
                  <div className="font-figures mt-1 text-xl font-semibold">
                    {son.islem_hacmi_tl != null ? sayi(son.islem_hacmi_tl / 1e9, 1) : "–"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-xs text-muted-foreground">İşlem Sayısı</div>
                  <div className="font-figures mt-1 text-xl font-semibold">{sayi(son.islem_sayisi)}</div>
                </CardContent>
              </Card>
            </div>

            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={onSerisi} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="tarih" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={tarihFmt} minTickGap={32} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={48} unit="%" domain={["dataMin - 0.3", "dataMax + 0.3"]} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => (typeof v === "string" ? tarihFmt(v) : "")}
                  formatter={(v, isim) => [`%${Number(v).toFixed(2)}`, isim]}
                />
                <Area type="monotone" dataKey="maks_oran" name="Maksimum" stroke="none" fill="none" legendType="none" />
                <Area
                  type="monotone" dataKey="min_oran" name="Min-Maks aralığı"
                  stroke="none" fill={RENK} fillOpacity={0.15}
                />
                <Line type="monotone" dataKey="ort_oran" name="Ortalama Oran" stroke={RENK} strokeWidth={2} dot={false} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </AreaChart>
            </ResponsiveContainer>

            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={onSerisi} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="tarih" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={tarihFmt} minTickGap={32} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={48} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => (typeof v === "string" ? tarihFmt(v) : "")}
                  formatter={(v) => [`${Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} Mlr TL`, "İşlem Hacmi"]}
                />
                <Area
                  type="monotone"
                  dataKey={(r: Satir) => (r.islem_hacmi_tl ?? 0) / 1e9}
                  name="İşlem Hacmi (Milyar TL)"
                  stroke={RENK} fill={RENK} fillOpacity={0.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </TabsContent>

      <TabsContent value="egri">
        {tarihler.length === 0 ? (
          <p className="text-sm text-muted-foreground">takasbank_tpp verisi henüz yüklenmedi.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground" htmlFor="tpp-tarih">İşlem tarihi</label>
              <select
                id="tpp-tarih"
                value={seciliTarih}
                onChange={(e) => setSeciliTarih(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1 text-sm font-figures"
              >
                {tarihler.map((t) => (
                  <option key={t} value={t}>{tarihFmt(t)}</option>
                ))}
              </select>
            </div>

            {gunVerisi.length === 0 ? (
              <p className="text-sm text-muted-foreground">Seçilen tarihte veri yok.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {tarihFmt(seciliTarih)} için O/N&apos;den {Math.max(...gunVerisi.map((r) => vadeGunSayi(r.vade_gun)))} güne
                  kadar tüm vadelerin gün içi ortalama oranı — TL fonlama piyasasının o günkü kısa vade faiz eğrisi.
                </p>
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart
                    data={gunVerisi.map((r) => ({ ...r, vadeGunSayi: vadeGunSayi(r.vade_gun) }))}
                    margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="vadeGunSayi" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} label={{ value: "Vade (gün, 0=O/N)", position: "insideBottom", offset: -5, fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={48} unit="%" domain={["dataMin - 0.3", "dataMax + 0.3"]} />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v, isim) => [`%${Number(v).toFixed(2)}`, isim]}
                    />
                    <Line type="monotone" dataKey="ort_oran" name="Ortalama Oran" stroke={RENK} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>

                <div className="max-h-[360px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vade (gün)</TableHead>
                        <TableHead className="text-right">Min Oran</TableHead>
                        <TableHead className="text-right">Maks Oran</TableHead>
                        <TableHead className="text-right">Ortalama Oran</TableHead>
                        <TableHead className="text-right">İşlem Hacmi (Mn TL)</TableHead>
                        <TableHead className="text-right">İşlem Sayısı</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gunVerisi.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-figures">{r.vade_gun}</TableCell>
                          <TableCell className="font-figures text-right">{yuzde(r.min_oran)}</TableCell>
                          <TableCell className="font-figures text-right">{yuzde(r.maks_oran)}</TableCell>
                          <TableCell className="font-figures text-right">{yuzde(r.ort_oran)}</TableCell>
                          <TableCell className="font-figures text-right">
                            {r.islem_hacmi_tl != null ? sayi(r.islem_hacmi_tl / 1e6, 1) : "–"}
                          </TableCell>
                          <TableCell className="font-figures text-right">{sayi(r.islem_sayisi)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        )}
      </TabsContent>

      <TabsContent value="tablo">
        {veri.length === 0 ? (
          <p className="text-sm text-muted-foreground">takasbank_tpp verisi henüz yüklenmedi.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground" htmlFor="tpp-baslangic">Başlangıç</label>
                <input
                  id="tpp-baslangic" type="date" value={aralikBaslangic} min={tarihMin} max={aralikBitis}
                  onChange={(e) => setAralikBaslangic(e.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm font-figures"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground" htmlFor="tpp-bitis">Bitiş</label>
                <input
                  id="tpp-bitis" type="date" value={aralikBitis} min={aralikBaslangic} max={tarihMax}
                  onChange={(e) => setAralikBitis(e.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm font-figures"
                />
              </div>
              <p className="text-xs text-muted-foreground">{aralikVerisi.length} satır</p>
            </div>

            <div className="max-h-[560px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>İşlem Tarihi</TableHead>
                    <TableHead>Vade (gün)</TableHead>
                    <TableHead className="text-right">Min Oran</TableHead>
                    <TableHead className="text-right">Maks Oran</TableHead>
                    <TableHead className="text-right">Ortalama Oran</TableHead>
                    <TableHead className="text-right">İşlem Hacmi (TL)</TableHead>
                    <TableHead className="text-right">İşlem Hacmi (USD)</TableHead>
                    <TableHead className="text-right">İşlem Sayısı</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aralikVerisi.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-figures whitespace-nowrap">{tarihFmt(r.tarih)}</TableCell>
                      <TableCell className="font-figures">{r.vade_gun}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(r.min_oran)}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(r.maks_oran)}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(r.ort_oran)}</TableCell>
                      <TableCell className="font-figures text-right">{sayi(r.islem_hacmi_tl)}</TableCell>
                      <TableCell className="font-figures text-right">{sayi(r.islem_hacmi_usd)}</TableCell>
                      <TableCell className="font-figures text-right">{sayi(r.islem_sayisi)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
