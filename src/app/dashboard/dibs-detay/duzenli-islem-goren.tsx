import { BosDurum } from "@/components/bos-durum";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";
import { isoTarihGoster, utcTarihe } from "@/lib/tarih";
import {
  nakitAkislariniOlustur,
  birikmisFaizHesapla,
  getiriBul,
  modifiedDurationHesapla,
  dv01Hesapla,
} from "@/lib/bond-math/tahvil-fiyatlama";

const VARSAYILAN_GUN_ESIGI = 40;
const VARSAYILAN_PENCERE_GUN = 90;
const DV01_HESAPLANABILEN_TIPLER = new Set(["Sabit Kuponlu Devlet Tahvili", "Kuponsuz Devlet Tahvili", "Hazine Bonosu"]);

const TUR_RENKLERI = [
  "bg-blue-500/10", "bg-emerald-500/10", "bg-amber-500/10", "bg-violet-500/10",
  "bg-rose-500/10", "bg-cyan-500/10", "bg-lime-500/10", "bg-fuchsia-500/10",
];

function yuzde(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "–" : `%${v.toFixed(2)}`;
}

export async function DuzenliIslemGorenBolumu() {
  const supabase = await createClient();
  const pencereBaslangic = new Date();
  pencereBaslangic.setDate(pencereBaslangic.getDate() - VARSAYILAN_PENCERE_GUN);
  const baslangicStr = pencereBaslangic.toISOString().slice(0, 10);

  const [{ data: bist }, { data: ozetHam }] = await Promise.all([
    tumSatirlariGetir((from, to) =>
      supabase
        .from("bist_bap_fiyatlar")
        .select("isin, tarih, temiz_fiyat, kapanis_bilesik_getiri_pct")
        .gte("tarih", baslangicStr)
        .order("isin")
        .order("tarih")
        .range(from, to),
    ),
    supabase.from("isin_ozet").select("isin, senet_tanimi, vade_tarihi, ilk_valor_tarihi, ilk_ihrac_tarihi, tahmini_kupon_orani"),
  ]);

  if (!bist || bist.length === 0) {
    return <BosDurum baslik="Bu dönemde işlem verisi yok" aciklama={`Son ${VARSAYILAN_PENCERE_GUN} günde BIST ikincil piyasa işlemi kaydedilmemiş.`} />;
  }

  const ozetHarita = new Map((ozetHam ?? []).map((r) => [r.isin, r]));
  const bugun = new Date();
  const bugunUtc = utcTarihe(bugun.toISOString().slice(0, 10))!;

  const isinGruplari = new Map<string, typeof bist>();
  for (const r of bist) {
    const liste = isinGruplari.get(r.isin) ?? [];
    liste.push(r);
    isinGruplari.set(r.isin, liste);
  }

  const satirlar = Array.from(isinGruplari.entries()).map(([isin, kayitlar]) => {
    const ozet = ozetHarita.get(isin);
    const gunSayisi = new Set(kayitlar.map((k) => k.tarih)).size;
    const sonKayit = [...kayitlar].sort((a, b) => (a.tarih < b.tarih ? -1 : 1)).at(-1)!;
    const fiyat = sonKayit.temiz_fiyat != null ? Number(sonKayit.temiz_fiyat) : null;

    let duration: number | null = null;
    let dv01: number | null = null;
    const vade = ozet ? utcTarihe(ozet.vade_tarihi) : null;
    const anchor = ozet ? utcTarihe(ozet.ilk_valor_tarihi ?? ozet.ilk_ihrac_tarihi) : null;
    const kuponPct = ozet?.tahmini_kupon_orani != null ? Number(ozet.tahmini_kupon_orani) : null;

    if (
      ozet && ozet.senet_tanimi && DV01_HESAPLANABILEN_TIPLER.has(ozet.senet_tanimi) &&
      vade && anchor && kuponPct != null && fiyat != null && vade.getTime() > bugunUtc.getTime()
    ) {
      try {
        const kuponOrani = kuponPct / 100;
        const akislar = nakitAkislariniOlustur(vade, anchor, kuponOrani);
        const birikmis = birikmisFaizHesapla(vade, anchor, bugunUtc, kuponOrani);
        const kirli = fiyat + birikmis;
        const getiri = getiriBul(vade, anchor, bugunUtc, kuponOrani, kirli);
        duration = modifiedDurationHesapla(akislar, bugunUtc, getiri).modified;
        dv01 = dv01Hesapla(akislar, bugunUtc, getiri);
      } catch {
        duration = null;
        dv01 = null;
      }
    }

    return {
      isin, tur: ozet?.senet_tanimi ?? "–", vade: ozet?.vade_tarihi ?? "–",
      fiyat, getiri: sonKayit.kapanis_bilesik_getiri_pct != null ? Number(sonKayit.kapanis_bilesik_getiri_pct) : null,
      sonIslem: sonKayit.tarih, duration, dv01, gun: gunSayisi, duzenliMi: gunSayisi >= VARSAYILAN_GUN_ESIGI,
    };
  }).sort((a, b) => b.gun - a.gun);

  const duzenliSayi = satirlar.filter((s) => s.duzenliMi).length;
  const turler = Array.from(new Set(satirlar.map((s) => s.tur))).sort();
  const renkHarita = new Map(turler.map((t, i) => [t, TUR_RENKLERI[i % TUR_RENKLERI.length]]));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        DİBS piyasası hisse gibi her gün fiyatlanmıyor — çoğu ISIN son 3 ayda birkaç günde bir işlem
        görüyor. Bu tablo her kağıdın son {VARSAYILAN_PENCERE_GUN} günde fiilen kaç iş günü BIST BAP&apos;ta
        fiyatlandığını gösterir.
      </p>
      <p className="text-sm text-muted-foreground">
        Toplam {satirlar.length} ISIN&apos;de işlem kaydı var, bunlardan <b className="text-foreground">{duzenliSayi}</b>{" "}
        tanesi son {VARSAYILAN_PENCERE_GUN} günde en az {VARSAYILAN_GUN_ESIGI} gün işlem görmüş (&quot;düzenli&quot;).
      </p>
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[560px] overflow-y-auto overflow-x-auto rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>ISIN</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Vade</TableHead>
                  <TableHead className="text-right">Son Fiyat</TableHead>
                  <TableHead className="text-right">Getiri (%)</TableHead>
                  <TableHead>Son İşlem</TableHead>
                  <TableHead className="text-right">Duration (yıl)</TableHead>
                  <TableHead className="text-right">DV01</TableHead>
                  <TableHead className="text-right">İşlem Günü</TableHead>
                  <TableHead>Düzenli mi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {satirlar.map((s) => (
                  <TableRow key={s.isin} className={renkHarita.get(s.tur)}>
                    <TableCell className="font-figures">{s.isin}</TableCell>
                    <TableCell className="text-xs">{s.tur}</TableCell>
                    <TableCell className="font-figures text-xs">{s.vade}</TableCell>
                    <TableCell className="font-figures text-right">{s.fiyat != null ? s.fiyat.toFixed(3) : "–"}</TableCell>
                    <TableCell className="font-figures text-right">{yuzde(s.getiri)}</TableCell>
                    <TableCell className="font-figures text-xs">{isoTarihGoster(s.sonIslem)}</TableCell>
                    <TableCell className="font-figures text-right">{s.duration != null ? s.duration.toFixed(2) : "–"}</TableCell>
                    <TableCell className="font-figures text-right">{s.dv01 != null ? s.dv01.toFixed(4) : "–"}</TableCell>
                    <TableCell className="font-figures text-right">{s.gun}</TableCell>
                    <TableCell className="text-xs">{s.duzenliMi ? "✓ Düzenli" : "— Seyrek"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
