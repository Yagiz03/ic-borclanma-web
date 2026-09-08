import { BosDurum } from "@/components/bos-durum";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SenetBadge } from "@/components/senet-badge";
import { isoTarihGoster, utcTarihe } from "@/lib/tarih";
import { isinTipSozlugunuGetir, isinTipTahminEt, TIP_KISA } from "@/lib/isin-tip";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";
import { PastaGrafigi } from "./coklu-cizgi-grafigi";

const TCMB_450MR_KAYNAK_URL =
  "https://www.tcmb.gov.tr/wps/wcm/connect/50433504-d77c-472a-82d0-6ad1cc25c927/2026_Para_Politikas%C4%B1_Metni.pdf";

function milyon(v: number): string {
  return v.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

type Outstanding = {
  isin: string;
  nominalMn: number;
  vadeTarihi: string;
  sonAlimTarihi: string;
  alimSayisi: number;
  yuzde: number;
  tip: string;
  tipDetay: string;
  senetTanimi: string;
};

export async function TcmbApiPortfoyuBolumu() {
  const supabase = await createClient();

  const [{ data: alim, error }, { data: isinOzet }, { data: dibsTcmb }] = await Promise.all([
    // 1152 satır -- tek sorguda Supabase'in 1000 satır sınırını aşıyor.
    tumSatirlariGetir<{ isin: string; ihale_tarihi: string; vade_tarihi: string; kazanan_tutar_nominal_bin_tl: number | null }>(
      (from, to) =>
        supabase
          .from("tcmb_dogrudan_alim")
          .select("isin, ihale_tarihi, vade_tarihi, kazanan_tutar_nominal_bin_tl")
          .order("ihale_tarihi")
          .order("isin")
          .range(from, to),
    ),
    supabase.from("isin_ozet").select("isin, senet_tanimi"),
    supabase
      .from("evds_seriler")
      .select("tarih, deger")
      .eq("seri_adi", "dibs_piy_deg_tcmb")
      .order("tarih", { ascending: false })
      .limit(1),
  ]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!alim || alim.length === 0) {
    return <BosDurum baslik="TCMB doğrudan alım kaydı yok" aciklama="TCMB'nin ikincil piyasadan doğrudan DİBS alımları burada listelenir." />;
  }

  const adSozluk = new Map((isinOzet ?? []).map((o) => [o.isin, o.senet_tanimi]));

  const gruplar = new Map<
    string,
    { nominalBinToplam: number; vadeTarihi: string; sonAlimTarihi: string; alimSayisi: number }
  >();
  for (const r of alim) {
    if (r.kazanan_tutar_nominal_bin_tl == null) continue;
    const g = gruplar.get(r.isin) ?? {
      nominalBinToplam: 0,
      vadeTarihi: r.vade_tarihi,
      sonAlimTarihi: r.ihale_tarihi,
      alimSayisi: 0,
    };
    g.nominalBinToplam += Number(r.kazanan_tutar_nominal_bin_tl);
    if (r.vade_tarihi > g.vadeTarihi) g.vadeTarihi = r.vade_tarihi;
    if (r.ihale_tarihi > g.sonAlimTarihi) g.sonAlimTarihi = r.ihale_tarihi;
    g.alimSayisi += 1;
    gruplar.set(r.isin, g);
  }

  const bugun = new Date();
  const bugunUtc = Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth(), bugun.getUTCDate());

  const tipSozluk = await isinTipSozlugunuGetir(supabase);

  const outstandingHam = [...gruplar.entries()]
    .map(([isin, g]) => ({ isin, nominalMn: g.nominalBinToplam / 1000, ...g }))
    .filter((r) => (utcTarihe(r.vadeTarihi)?.getTime() ?? 0) > bugunUtc);

  if (outstandingHam.length === 0) {
    return <p className="text-sm text-muted-foreground">Vadesi gelmemiş TCMB doğrudan alımı bulunamadı.</p>;
  }

  const toplamNominal = outstandingHam.reduce((s, r) => s + r.nominalMn, 0);

  const outstanding: Outstanding[] = outstandingHam
    .map((r) => {
      const tip = isinTipTahminEt(r.isin, tipSozluk);
      const hamTip = tipSozluk.get(r.isin);
      const tipDetay = tip === "Diğer" ? (hamTip ?? "Diğer") : tip;
      return {
        isin: r.isin,
        nominalMn: r.nominalMn,
        vadeTarihi: r.vadeTarihi,
        sonAlimTarihi: r.sonAlimTarihi,
        alimSayisi: r.alimSayisi,
        yuzde: (r.nominalMn / toplamNominal) * 100,
        tip,
        tipDetay,
        senetTanimi: adSozluk.get(r.isin) ?? TIP_KISA[tip] ?? tip,
      };
    })
    .sort((a, b) => b.nominalMn - a.nominalMn);

  const sonDibsTcmb = dibsTcmb?.[0]?.deger != null ? Number(dibsTcmb[0].deger) : null;
  const kapsamOrani = sonDibsTcmb ? (toplamNominal / sonDibsTcmb) * 100 : null;

  const tipAgg = new Map<string, number>();
  for (const r of outstanding) {
    tipAgg.set(r.tipDetay, (tipAgg.get(r.tipDetay) ?? 0) + r.nominalMn);
  }
  const tipVeri = [...tipAgg.entries()]
    .map(([etiket, deger]) => ({ etiket: TIP_KISA[etiket] ?? etiket, deger }))
    .sort((a, b) => b.deger - a.deger);

  const ufuklar: { etiket: string; gunSayisi: number }[] = [
    { etiket: "1 ay", gunSayisi: 30 },
    { etiket: "3 ay", gunSayisi: 91 },
    { etiket: "6 ay", gunSayisi: 182 },
    { etiket: "1 yıl", gunSayisi: 365 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-base font-semibold">TCMB&apos;nin elindeki DİBS portföyü — kağıt kağıt</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sonDibsTcmb != null && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Toplam portföy (EVDS S.121, piyasa değeri)</p>
              <p className="font-figures text-lg font-semibold">{milyon(sonDibsTcmb)} Milyon TL</p>
            </div>
          )}
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Bu tablonun kapsadığı nominal</p>
            <p className="font-figures text-lg font-semibold">{milyon(toplamNominal)} Milyon TL</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">2026 APİ portföy hedefi</p>
            <p className="font-figures text-lg font-semibold">450.000 Milyon TL</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">2026&apos;da itfa olacak (APİ portföyünden)</p>
            <p className="font-figures text-lg font-semibold">67.700 Milyon TL</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          TCMB&apos;nin 2020&apos;den bugüne yaptığı GERÇEK doğrudan alım (APİ) ihalelerinden — her ihalede
          kazandığı nominal tutar ISIN bazında toplanıp, hâlâ vadesi gelmemiş olanlar gösteriliyor
          {kapsamOrani != null
            ? ` (EVDS S.121 piyasa değerinin ~%${kapsamOrani.toFixed(0)}'i — fark nominal/piyasa değeri farkından kaynaklanıyor)`
            : ""}
          . TCMB bu portföyü yeni doğrudan alımlarla büyütüyor, itfa olan kağıtlarla küçülüyor — bu tablo
          sadece ALIM tarafını gösteriyor. Kaynak: TCMB&apos;nin &quot;İhale ile Gerçekleştirilen Doğrudan Alım
          İşlemleri Verileri&quot; sayfası. 450 milyar TL hedefi ve itfa tutarı{" "}
          <a href={TCMB_450MR_KAYNAK_URL} target="_blank" rel="noreferrer" className="underline">
            2026 Para Politikası Metni
          </a>{" "}
          kaynaklı.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-base font-semibold">ISIN / vade / nominal dağılımı</h3>
        <div className="max-h-[420px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ISIN</TableHead>
                <TableHead>Senet Tanımı</TableHead>
                <TableHead>Vade Tarihi</TableHead>
                <TableHead className="text-right">Nominal (Milyon TL)</TableHead>
                <TableHead className="text-right">Pay (%)</TableHead>
                <TableHead className="text-right">Alım Sayısı</TableHead>
                <TableHead>Son Alım Tarihi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outstanding.map((r) => (
                <TableRow key={r.isin}>
                  <TableCell className="font-figures">{r.isin}</TableCell>
                  <TableCell><SenetBadge tanim={r.senetTanimi} /></TableCell>
                  <TableCell className="font-figures whitespace-nowrap">{isoTarihGoster(r.vadeTarihi)}</TableCell>
                  <TableCell className="font-figures text-right">{milyon(r.nominalMn)}</TableCell>
                  <TableCell className="font-figures text-right">{r.yuzde.toFixed(2)}</TableCell>
                  <TableCell className="font-figures text-right">{r.alimSayisi}</TableCell>
                  <TableCell className="font-figures whitespace-nowrap">{isoTarihGoster(r.sonAlimTarihi)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-base font-semibold">Kağıt tipine göre dağılım</h3>
        <PastaGrafigi veri={tipVeri} />
        <p className="mt-2 text-xs text-muted-foreground">
          Yukarıdaki ISIN bazlı gerçek portföyün kağıt tipine göre toplamı — TCMB&apos;nin doğrudan alım
          kanalıyla edindiği Kira Sertifikaları gibi standart DİBS kupon tiplerine girmeyen kağıtlar da kendi
          dilimleriyle görünüyor.
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold">TCMB APİ Portföyü — yaklaşan itfalar</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ufuklar.map(({ etiket, gunSayisi }) => {
            const esikMs = bugunUtc + gunSayisi * 86400000;
            const alt = outstanding
              .filter((r) => (utcTarihe(r.vadeTarihi)?.getTime() ?? Infinity) <= esikMs)
              .sort((a, b) => a.vadeTarihi.localeCompare(b.vadeTarihi));
            const toplam = alt.reduce((s, r) => s + r.nominalMn, 0);
            return (
              <div key={etiket} className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{etiket} içinde itfa</p>
                <p className="font-figures text-lg font-semibold">{milyon(toplam)} Milyon TL</p>
                {alt.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Bu ufukta itfa olacak kağıt yok.</p>
                ) : (
                  <div className="max-h-[220px] overflow-y-auto rounded border border-border/60">
                    <table className="w-full text-xs">
                      <tbody>
                        {alt.map((r) => (
                          <tr key={r.isin} className="border-b border-border/40 last:border-0">
                            <td className="px-2 py-1 font-figures">{r.isin}</td>
                            <td className="px-2 py-1 text-right font-figures">{milyon(r.nominalMn)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Her kartın içindeki liste, o kartın toplamını oluşturan kağıtlar — vade tarihine göre sıralı.
          Ufuklar KÜMÜLATİF: &quot;3 ay&quot; listesi &quot;1 ay&quot;dakileri de içerir, &quot;1 yıl&quot; listesi
          hepsini içerir — aynı kağıt birden fazla listede görünebilir.
        </p>
      </div>
    </div>
  );
}
