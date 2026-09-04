import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
import { SenetBadge } from "@/components/senet-badge";
import { IlerlemeRozeti } from "@/components/ilerleme-rozeti";
import { trTarihSirala } from "@/lib/tarih";
import { finansmanIlerlemeVerisiGetir } from "@/lib/finansman-ilerleme";

function yuzde(v: number | string | null | undefined): string {
  if (v == null) return "–";
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? `%${n.toFixed(2)}` : "–";
}

function milyarTl(v: number | null | undefined): string {
  return v == null ? "–" : v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

function ay1(v: number | null | undefined): string {
  return v == null ? "–" : `${v.toFixed(1)} ay`;
}

function pct2(v: number | null | undefined): string {
  return v == null ? "–" : `%${v.toFixed(2)}`;
}

function delta1(simdi: number | null | undefined, once: number | null | undefined, birim: string): string | null {
  if (simdi == null || once == null) return null;
  const d = simdi - once;
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)} ${birim}`;
}

async function FinansmanIlerlemeBolumu() {
  const supabase = await createClient();
  const veri = await finansmanIlerlemeVerisiGetir(supabase);
  if (!veri) return null;

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <h2 className="text-lg font-semibold">
          {veri.ayLabel} — Piyasadan İhale Yoluyla İç Borçlanma İlerlemesi
        </h2>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kalem</TableHead>
                <TableHead className="text-right">Planlanan (Mlr TL)</TableHead>
                <TableHead className="text-right">Gerçekleşen (Mlr TL)</TableHead>
                <TableHead className="text-right">Kalan (Mlr TL)</TableHead>
                <TableHead className="text-right">İlerleme</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {veri.kalemler.map((k) => (
                <TableRow key={k.kalem}>
                  <TableCell>
                    <div className="font-medium">{k.kalem}</div>
                    {k.aciklama && <div className="mt-0.5 text-xs text-muted-foreground">{k.aciklama}</div>}
                  </TableCell>
                  <TableCell className="font-figures text-right">{milyarTl(k.plan)}</TableCell>
                  <TableCell className="font-figures text-right">{milyarTl(k.gerceklesen)}</TableCell>
                  <TableCell className="font-figures text-right">{milyarTl(k.kalan)}</TableCell>
                  <TableCell className="text-right">
                    <IlerlemeRozeti oran={k.oran} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-3">
            <h3 className="mb-2 text-sm font-semibold">Bu ay hangi kağıttan ne kadar geldi</h3>
            {veri.kagitlar.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu ay henüz gerçekleşen ihale yok.</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>ISIN</TableHead>
                      <TableHead>Senet</TableHead>
                      <TableHead className="text-right">Kamu Kurumları (Mlr TL)</TableHead>
                      <TableHead className="text-right">Piyasa Yapıcılar (Mlr TL)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {veri.kagitlar.map((k, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-figures whitespace-nowrap">{k.ihale_tarihi}</TableCell>
                        <TableCell className="font-figures">
                          {k.kaynak_url ? (
                            <a href={k.kaynak_url} target="_blank" rel="noreferrer" className="hover:underline">
                              {k.isin}
                            </a>
                          ) : (
                            k.isin
                          )}
                        </TableCell>
                        <TableCell><SenetBadge tanim={k.senet_tanimi} /></TableCell>
                        <TableCell className="font-figures text-right">{milyarTl(k.kamu_kurumlari_mn)}</TableCell>
                        <TableCell className="font-figures text-right">{milyarTl(k.piyasa_yapicilar_mn)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <h3 className="mb-2 text-sm font-semibold">{veri.kalanBaslik}</h3>
            {veri.kalanIhaleler.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu ay için planlanmış başka ihale kalmadı.</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>ISIN</TableHead>
                      <TableHead>Senet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {veri.kalanIhaleler.map((k, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-figures whitespace-nowrap">{k.ihale_tarihi}</TableCell>
                        <TableCell className="font-figures">{k.isin}</TableCell>
                        <TableCell>{k.senet_turu}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Yılbaşından bu yana aylık ilerleme</h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ay</TableHead>
                  <TableHead className="text-right">İhale Planlanan</TableHead>
                  <TableHead className="text-right">İhale Gerçekleşen</TableHead>
                  <TableHead className="text-right">İhale İlerleme</TableHead>
                  <TableHead className="text-right">Kamuya Satışlar Planlanan</TableHead>
                  <TableHead className="text-right">İhale İçi Kamu ROT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {veri.ytd.map((r) => (
                  <TableRow key={r.ay}>
                    <TableCell className="whitespace-nowrap">{r.ay}</TableCell>
                    {r.arsivdeYok ? (
                      <TableCell colSpan={5} className="text-muted-foreground">Arşivde yok</TableCell>
                    ) : (
                      <>
                        <TableCell className="font-figures text-right">{milyarTl(r.plan)}</TableCell>
                        <TableCell className="font-figures text-right">{milyarTl(r.gerceklesen)}</TableCell>
                        <TableCell className="text-right"><IlerlemeRozeti oran={r.oran} /></TableCell>
                        <TableCell className="font-figures text-right">{milyarTl(r.planKamu)}</TableCell>
                        <TableCell className="font-figures text-right">{milyarTl(r.kamuRot)}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {veri.bazıAylarArsivdeYok && (
            <p className="mt-2 text-xs text-muted-foreground">
              Bazı aylar için strateji belgesi arşivlenmemiş -- sadece son birkaç aylık duyuru yerelde saklı.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

async function IhaleDetayTabIcerigi() {
  const supabase = await createClient();

  const [{ data: ihaleler, error }, { data: ozet }] = await Promise.all([
    supabase
      .from("ihale_sonuclari")
      .select(
        "isin, ihale_tarihi, ihrac_tipi, ort_yillik_bilesik_gerceklesme, toplam_gerceklesme_mn, toplam_oran_pct, bid_to_cover",
      ),
    supabase.from("isin_ozet").select("isin, senet_tanimi"),
  ]);

  const tipHaritasi = new Map((ozet ?? []).map((o) => [o.isin, o.senet_tanimi]));
  const siraliIhaleler = ihaleler
    ? trTarihSirala(ihaleler, (r) => r.ihale_tarihi).reverse()
    : [];

  return (
    <div className="space-y-6">
      <FinansmanIlerlemeBolumu />

      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error.message}</p>}
          {siraliIhaleler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz ihale kaydı yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>ISIN</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>İhraç Tipi</TableHead>
                    <TableHead className="text-right">Ort. Faiz (Bileşik)</TableHead>
                    <TableHead className="text-right">Gerçekleşme (Mn TL)</TableHead>
                    <TableHead className="text-right">Talep Karşılama</TableHead>
                    <TableHead className="text-right">Bid-to-Cover</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siraliIhaleler.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-figures">{h.ihale_tarihi}</TableCell>
                      <TableCell className="font-figures">
                        <Link href={`/dashboard/dibs-detay?isin=${h.isin}`} className="hover:underline">
                          {h.isin}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <SenetBadge tanim={tipHaritasi.get(h.isin)} />
                      </TableCell>
                      <TableCell>{h.ihrac_tipi ?? "–"}</TableCell>
                      <TableCell className="font-figures text-right">
                        {yuzde(h.ort_yillik_bilesik_gerceklesme)}
                      </TableCell>
                      <TableCell className="font-figures text-right">
                        {h.toplam_gerceklesme_mn != null
                          ? Number(h.toplam_gerceklesme_mn).toLocaleString("tr-TR", { maximumFractionDigits: 0 })
                          : "–"}
                      </TableCell>
                      <TableCell className="font-figures text-right">{yuzde(h.toplam_oran_pct)}</TableCell>
                      <TableCell className="font-figures text-right">
                        {h.bid_to_cover != null ? Number(h.bid_to_cover).toFixed(2) : "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function OrtalamaVadeMaliyetTabIcerigi() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ortalama_vade_maliyet")
    .select("*")
    .order("yil")
    .order("ay");

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">ortalama_vade_maliyet tablosu boş.</p>;
  }

  const son = data[data.length - 1];
  const onceki = data.length > 1 ? data[data.length - 2] : null;
  const son12Ay = [...data].slice(-12).reverse();

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <h2 className="text-lg font-semibold">{son.ay_etiketi} — İç Borçlanmanın Ortalama Vadesi / Maliyeti</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Sabit Getirili -- Kümülatif Ort. Vade</p>
            <p className="font-figures text-xl font-semibold">{ay1(son.sabit_kumulatif_vade_ay)}</p>
            {onceki && (
              <p className="text-xs text-muted-foreground">
                {delta1(son.sabit_kumulatif_vade_ay, onceki.sabit_kumulatif_vade_ay, "ay")}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Sabit Getirili -- Kümülatif Ort. Maliyet</p>
            <p className="font-figures text-xl font-semibold">{pct2(son.sabit_kumulatif_maliyet_pct)}</p>
            {onceki && (
              <p className="text-xs text-muted-foreground">
                {delta1(son.sabit_kumulatif_maliyet_pct, onceki.sabit_kumulatif_maliyet_pct, "puan")}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Nakit Borçlanma (Toplam) -- Kümülatif Ort. Vade</p>
            <p className="font-figures text-xl font-semibold">{ay1(son.nakit_kumulatif_vade_ay)}</p>
            <p className="text-xs text-muted-foreground">Kuponsuz Senetler + Sabit Getirili&apos;nin toplamı</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Kaynak: HMB İç Borçlanmanın Ortalama Vadesi / Ortalama Maliyeti (aylık, Kuponsuz Senetler / Sabit Getirili /
          Nakit Borçlanma kırılımı, 2003&apos;ten günümüze).
        </p>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ay</TableHead>
                <TableHead className="text-right">Kuponsuz Vade</TableHead>
                <TableHead className="text-right">Sabit Getirili Vade</TableHead>
                <TableHead className="text-right">Nakit Borçlanma Vade</TableHead>
                <TableHead className="text-right">Kuponsuz Maliyet</TableHead>
                <TableHead className="text-right">Sabit Getirili Maliyet</TableHead>
                <TableHead className="text-right">Nakit Borçlanma Maliyet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {son12Ay.map((r) => (
                <TableRow key={`${r.yil}-${r.ay}`}>
                  <TableCell className="whitespace-nowrap">{r.ay_etiketi}</TableCell>
                  <TableCell className="font-figures text-right">{ay1(r.kuponsuz_kumulatif_vade_ay)}</TableCell>
                  <TableCell className="font-figures text-right">{ay1(r.sabit_kumulatif_vade_ay)}</TableCell>
                  <TableCell className="font-figures text-right">{ay1(r.nakit_kumulatif_vade_ay)}</TableCell>
                  <TableCell className="font-figures text-right">{pct2(r.kuponsuz_kumulatif_maliyet_pct)}</TableCell>
                  <TableCell className="font-figures text-right">{pct2(r.sabit_kumulatif_maliyet_pct)}</TableCell>
                  <TableCell className="font-figures text-right">{pct2(r.nakit_kumulatif_maliyet_pct)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Tüm değerler yıl içi KÜMÜLATİF ortalamadır (her Ocak&apos;ta sıfırlanır) -- son 12 ay gösteriliyor.
        </p>
      </CardContent>
    </Card>
  );
}

export default function IhaleDetayPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">İhale Detay</h1>
        <p className="text-sm text-muted-foreground">
          Gerçekleşen tüm Hazine ihalelerinin sonuçları -- en yeniden eskiye.
        </p>
      </div>

      <Tabs defaultValue="ihale">
        <TabsList className="mb-4 h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="ihale" className="shrink-0">İhale Detay</TabsTrigger>
          <TabsTrigger value="vade" className="shrink-0">Ortalama Vade / Maliyet</TabsTrigger>
        </TabsList>
        <TabsContent value="ihale">
          <IhaleDetayTabIcerigi />
        </TabsContent>
        <TabsContent value="vade">
          <OrtalamaVadeMaliyetTabIcerigi />
        </TabsContent>
      </Tabs>
    </div>
  );
}
