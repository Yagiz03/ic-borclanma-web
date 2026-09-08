import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
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
import { trTarihSirala, isoTarihGoster, utcTarihe } from "@/lib/tarih";
import { finansmanIlerlemeVerisiGetir } from "@/lib/finansman-ilerleme";
import { RenkliBarGrafik } from "@/app/dashboard/tcmb/coklu-cizgi-grafigi";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function yuzde(v: number | string | null | undefined): string {
  if (v == null) return "–";
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? `%${n.toFixed(2)}` : "–";
}

function milyarTl(v: number | null | undefined): string {
  return v == null ? "–" : v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

function bps1(v: number | null | undefined): string {
  return v == null ? "–" : v.toFixed(1);
}


async function FinansmanIlerlemeBolumu() {
  const supabase = await createClient();
  const veri = await finansmanIlerlemeVerisiGetir(supabase);
  if (!veri) return null;

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <h2 className="text-lg font-semibold">
          {veri.ayLabel} — Piyasadan İhale Yoluyla İç Borçlanma İlerlemesi (detay)
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
          <div className="min-w-0 md:col-span-3">
            <h3 className="mb-2 text-sm font-semibold">Bu ay hangi kağıttan ne kadar geldi</h3>
            {/* Ay içinde henüz ihale olmadığında da tablo (başlıklarıyla)
                gösteriliyor; sadece gövdesi boş kalıyor. Önce tablo tamamen
                gizlenip yerine tek satır yazı çıkıyordu. */}
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
                  {veri.kagitlar.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Bu ay henüz gerçekleşen ihale yok.
                      </TableCell>
                    </TableRow>
                  ) : (
                    veri.kagitlar.map((k, i) => (
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="min-w-0 md:col-span-2">
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
              Bazı aylar için strateji belgesi arşivlenmemiş — sadece son birkaç aylık duyuru yerelde saklı.
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
        "isin, ihale_tarihi, ihrac_tipi, ort_yillik_bilesik_gerceklesme, toplam_gerceklesme_mn, toplam_oran_pct, bid_to_cover, kamu_kurumlari_gerceklesme_mn, tail_bps, kaynak_url",
      ),
    supabase.from("isin_ozet").select("isin, senet_tanimi"),
  ]);

  const tipHaritasi = new Map((ozet ?? []).map((o) => [o.isin, o.senet_tanimi]));
  const siraliIhaleler = ihaleler
    ? trTarihSirala(ihaleler, (r) => r.ihale_tarihi).reverse()
    : [];

  const sonIhaleler = siraliIhaleler.slice(0, 25).map((h) => ({
    ...h,
    senet_tanimi: tipHaritasi.get(h.isin),
    piyasadan_ihale_mn:
      h.toplam_gerceklesme_mn != null
        ? Number(h.toplam_gerceklesme_mn) / 1000 - Number(h.kamu_kurumlari_gerceklesme_mn ?? 0) / 1000
        : null,
    kamu_kurumlari_mn: h.kamu_kurumlari_gerceklesme_mn != null ? Number(h.kamu_kurumlari_gerceklesme_mn) / 1000 : 0,
  }));

  return (
    <div className="space-y-6">
      <FinansmanIlerlemeBolumu />

      <details className="group rounded-xl bg-card ring-1 ring-foreground/10">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90">▶</span>
          Son ihaleler
        </summary>
        <div className="border-t border-border px-4 pb-4 pt-3">
          {sonIhaleler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz ihale kaydı yok.</p>
          ) : (
            <div className="max-h-[460px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>ISIN</TableHead>
                    <TableHead>Senet</TableHead>
                    <TableHead className="text-right">Faiz</TableHead>
                    <TableHead className="text-right">Piyasadan İhale (Mlr TL)</TableHead>
                    <TableHead className="text-right">Kamuya Satışlar (Mlr TL)</TableHead>
                    <TableHead className="text-right">Tail (bps)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sonIhaleler.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-figures whitespace-nowrap">{h.ihale_tarihi}</TableCell>
                      <TableCell className="font-figures">
                        {h.kaynak_url ? (
                          <a href={h.kaynak_url} target="_blank" rel="noreferrer" className="hover:underline">
                            {h.isin}
                          </a>
                        ) : (
                          h.isin
                        )}
                      </TableCell>
                      <TableCell><SenetBadge tanim={h.senet_tanimi} /></TableCell>
                      <TableCell className="font-figures text-right">{yuzde(h.ort_yillik_bilesik_gerceklesme)}</TableCell>
                      <TableCell className="font-figures text-right">{milyarTl(h.piyasadan_ihale_mn)}</TableCell>
                      <TableCell className="font-figures text-right">{milyarTl(h.kamu_kurumlari_mn)}</TableCell>
                      <TableCell className="font-figures text-right">{bps1(h.tail_bps)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </details>

      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error.message}</p>}
          {siraliIhaleler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz ihale kaydı yok.</p>
          ) : (
            <div className="max-h-[460px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
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

      <TcmbDogrudanAlimBolumu />
    </div>
  );
}

async function TcmbDogrudanAlimBolumu() {
  const supabase = await createClient();
  const [{ data: tcmb, error }, { data: ozet }] = await Promise.all([
    // 1152 satır -- tek sorguda Supabase'in 1000 satır sınırını aşıyor.
    tumSatirlariGetir<{ ihale_tarihi: string; isin: string; kazanan_tutar_nominal_bin_tl: number | null }>((from, to) =>
      supabase
        .from("tcmb_dogrudan_alim")
        .select("ihale_tarihi, isin, kazanan_tutar_nominal_bin_tl")
        .order("ihale_tarihi")
        .order("isin")
        .range(from, to),
    ),
    supabase.from("isin_ozet").select("isin, senet_tanimi"),
  ]);

  if (error || !tcmb || tcmb.length === 0) return null;

  const senetHaritasi = new Map((ozet ?? []).map((o) => [o.isin, o.senet_tanimi]));

  const aylikMap = new Map<string, number>();
  for (const r of tcmb) {
    if (r.kazanan_tutar_nominal_bin_tl == null) continue;
    const d = utcTarihe(r.ihale_tarihi);
    if (!d) continue;
    const anahtar = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    aylikMap.set(anahtar, (aylikMap.get(anahtar) ?? 0) + Number(r.kazanan_tutar_nominal_bin_tl));
  }
  const aylik = [...aylikMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([anahtar, tutar]) => {
      const [yil, ay] = anahtar.split("-").map(Number);
      return { etiket: `${yil} ${AY_ADLARI[ay - 1]}`, tutar };
    });

  const gunlukMap = new Map<string, number>();
  for (const r of tcmb) {
    if (r.kazanan_tutar_nominal_bin_tl == null) continue;
    gunlukMap.set(r.ihale_tarihi, (gunlukMap.get(r.ihale_tarihi) ?? 0) + Number(r.kazanan_tutar_nominal_bin_tl));
  }
  const guncelYil = new Date().getUTCFullYear();
  const yilBasi = `${guncelYil}-01-01`;
  const gunlukTum = [...gunlukMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  const gunlukYtd = gunlukTum.filter(([tarih]) => tarih >= yilBasi);
  const gunlukGosterilecek = (gunlukYtd.length > 0 ? gunlukYtd : gunlukTum).map(([tarih, tutar]) => ({
    etiket: isoTarihGoster(tarih),
    tutar,
  }));

  const ytdDetay = tcmb
    .filter((r) => r.ihale_tarihi >= yilBasi && r.kazanan_tutar_nominal_bin_tl != null)
    .map((r) => ({
      ihale_tarihi: r.ihale_tarihi,
      isin: r.isin,
      senet_tanimi: senetHaritasi.get(r.isin),
      tutar_mn: Number(r.kazanan_tutar_nominal_bin_tl) / 1000,
    }))
    .sort((a, b) => b.ihale_tarihi.localeCompare(a.ihale_tarihi));

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div>
          <h3 className="mb-2 text-base font-semibold">TCMB Doğrudan Alım İhalesi Aylık</h3>
          <RenkliBarGrafik veri={aylik} dataKey="tutar" etiket="Alım Tutarı" birim=" Bin TL" />
        </div>

        <div>
          <h3 className="mb-2 text-base font-semibold">TCMB Doğrudan Alım İhalesi Günlük</h3>
          <RenkliBarGrafik veri={gunlukGosterilecek} dataKey="tutar" etiket="Alım Tutarı" birim=" Bin TL" />
          <p className="mt-2 text-xs text-muted-foreground">{guncelYil} başından (YTD) itibaren gösteriliyor.</p>
        </div>

        {ytdDetay.length > 0 && (
          <div>
            <h3 className="mb-2 text-base font-semibold">Yukarıdaki grafikte hangi kağıttan ne kadar alındı</h3>
            <div className="max-h-[400px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>ISIN</TableHead>
                    <TableHead>Senet</TableHead>
                    <TableHead className="text-right">Alım Tutarı (Milyon TL)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ytdDetay.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-figures whitespace-nowrap">{isoTarihGoster(r.ihale_tarihi)}</TableCell>
                      <TableCell className="font-figures">{r.isin}</TableCell>
                      <TableCell><SenetBadge tanim={r.senet_tanimi} /></TableCell>
                      <TableCell className="font-figures text-right">
                        {r.tutar_mn.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function IhaleDetayPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">İhale Detay</h1>
        <p className="text-sm text-muted-foreground">
          Gerçekleşen tüm Hazine ihalelerinin sonuçları.
        </p>
      </div>

      <IhaleDetayTabIcerigi />
    </div>
  );
}
