import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { trTarihSirala, trTarihAyristir, utcTarihe } from "@/lib/tarih";
import { SenetBadge } from "@/components/senet-badge";
import {
  nakitAkislariniOlustur,
  birikmisFaizHesapla,
  getiriBul,
  modifiedDurationHesapla,
  dv01Hesapla,
} from "@/lib/bond-math/tahvil-fiyatlama";
import { PozisyonEkleFormu } from "./pozisyon-ekle-formu";
import { PozisyonSilButonu } from "./pozisyon-sil-butonu";
import { HeroBant } from "@/components/hero-bant";

const FIYATLANABILIR_TIPLER = new Set(["Sabit Kuponlu Devlet Tahvili", "Kuponsuz Devlet Tahvili"]);

function paraFmt(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export default async function PnlPage() {
  const supabase = await createClient();

  const [{ data: pozisyonlarHam, error }, { data: ozetHam }] = await Promise.all([
    supabase.from("positions").select("*").order("alis_tarihi", { ascending: false }),
    supabase.from("isin_ozet").select("*"),
  ]);

  const bugun = new Date();
  const ozetHarita = new Map((ozetHam ?? []).map((r) => [r.isin, r]));
  const secilebilirIsinler = trTarihSirala(
    (ozetHam ?? []).filter((r) => {
      const vade = trTarihAyristir(r.vade_tarihi);
      return vade && vade.getTime() > bugun.getTime();
    }),
    (r) => r.vade_tarihi,
  ).map((r) => ({ isin: r.isin, etiket: r.senet_tanimi ?? "" }));

  const bugunUtc = utcTarihe(bugun.toISOString().slice(0, 10))!;

  const satirlar = (pozisyonlarHam ?? []).map((p) => {
    const r = ozetHarita.get(p.isin);
    const guncelFiyat = r?.bist_son_temiz_fiyat != null ? Number(r.bist_son_temiz_fiyat) : null;
    const guncelTarih = r?.bist_son_tarih ?? null;
    const senet = r?.senet_tanimi ?? "–";
    const nominal = Number(p.nominal);
    const alisFiyati = Number(p.alis_fiyati);
    const alisTarihi = trTarihAyristir(p.alis_tarihi);
    const gun = alisTarihi ? Math.round((bugun.getTime() - alisTarihi.getTime()) / 86_400_000) : null;

    let fark: number | null = null;
    let kirliKullanildi = false;
    let alisKirli: number | null = null;
    let guncelKirli: number | null = null;
    let modifiedDur: number | null = null;
    let dv01Pozisyon: number | null = null;

    const vade = r ? utcTarihe(r.vade_tarihi) : null;
    const anchor = r ? utcTarihe(r.ilk_valor_tarihi ?? r.ilk_ihrac_tarihi) : null;
    const kuponPct = r?.tahmini_kupon_orani != null ? Number(r.tahmini_kupon_orani) : null;
    const alisTarihiUtc = p.alis_tarihi ? utcTarihe(p.alis_tarihi) : null;

    if (guncelFiyat != null && senet && FIYATLANABILIR_TIPLER.has(senet) && vade && anchor && kuponPct != null && alisTarihiUtc) {
      const kuponOrani = kuponPct / 100;
      const birikmisGuncel = birikmisFaizHesapla(vade, anchor, bugunUtc, kuponOrani);
      const birikmisAlis = birikmisFaizHesapla(vade, anchor, alisTarihiUtc, kuponOrani);
      guncelKirli = guncelFiyat + birikmisGuncel;
      alisKirli = alisFiyati + birikmisAlis;
      fark = guncelKirli - alisKirli;
      kirliKullanildi = true;

      const akislar = nakitAkislariniOlustur(vade, anchor, kuponOrani);
      const getiri = getiriBul(vade, anchor, bugunUtc, kuponOrani, guncelKirli);
      const { modified } = modifiedDurationHesapla(akislar, bugunUtc, getiri);
      modifiedDur = modified;
      dv01Pozisyon = dv01Hesapla(akislar, bugunUtc, getiri) * (nominal / 100);
    } else if (guncelFiyat != null) {
      fark = guncelFiyat - alisFiyati;
    }

    const kz = fark != null ? (fark / 100) * nominal : null;
    const pct = fark != null ? (fark / (kirliKullanildi ? alisKirli! : alisFiyati)) * 100 : null;

    return {
      id: p.id,
      isin: p.isin,
      senet,
      nominal,
      alisFiyati,
      alisTarihi: p.alis_tarihi,
      gun,
      guncelFiyat,
      guncelTarih,
      alisKirli,
      guncelKirli,
      kirliKullanildi,
      fark,
      kz,
      pct,
      modifiedDur,
      dv01Pozisyon,
      not_: p.not_,
    };
  });

  const toplamKz = satirlar.reduce((s, r) => s + (r.kz ?? 0), 0);
  const toplamMaliyet = satirlar.reduce((s, r) => s + (r.nominal * r.alisFiyati) / 100, 0);
  const toplamPct = toplamMaliyet ? (toplamKz / toplamMaliyet) * 100 : null;
  const dv01Hesaplanan = satirlar.filter((r) => r.dv01Pozisyon != null);
  const toplamDv01 = dv01Hesaplanan.reduce((s, r) => s + (r.dv01Pozisyon ?? 0), 0);
  const toplamPiyasaDegeri = dv01Hesaplanan.reduce((s, r) => s + ((r.guncelFiyat ?? 0) * r.nominal) / 100, 0);
  const agirlikliDuration = toplamPiyasaDegeri
    ? dv01Hesaplanan.reduce((s, r) => s + (r.modifiedDur ?? 0) * ((r.guncelFiyat ?? 0) * r.nominal) / 100, 0) / toplamPiyasaDegeri
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">P&L</h1>
        <p className="text-sm text-muted-foreground">
          Elle girdiğin pozisyonların güncel BIST fiyatına göre kâr/zararı -- mümkün olduğunda kirli fiyat
          (temiz + birikmiş faiz) farkı üzerinden, işlemiş faiz dahil.
        </p>
      </div>

      <PozisyonEkleFormu isinler={secilebilirIsinler} />

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {satirlar.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz pozisyon eklenmedi.</p>
      ) : (
        <>
          <HeroBant
            ustBaslik="PORTFÖY -- TOPLAM KÂR / ZARAR"
            deger={`${toplamKz >= 0 ? "+" : ""}${paraFmt(toplamKz)}`}
            birim="TL"
            aciklama={toplamPct != null ? `Maliyete göre %${toplamPct.toFixed(2)} -- ${satirlar.length} açık pozisyon` : `${satirlar.length} açık pozisyon`}
            yanKartlar={[
              { etiket: "Pozisyon sayısı", deger: String(satirlar.length) },
              { etiket: "Portföy DV01", deger: `${toplamDv01.toFixed(2)} TL/1bp` },
              { etiket: "Ağırlıklı Ort. Duration", deger: agirlikliDuration != null ? `${agirlikliDuration.toFixed(2)} yıl` : "–" },
            ]}
          />

          <div className="space-y-3">
            {satirlar.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{s.isin}</span>
                      <SenetBadge tanim={s.senet} />
                    </div>
                    <PozisyonSilButonu id={s.id} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>
                      <b className="text-foreground">Nominal:</b> {paraFmt(s.nominal)} TL
                    </span>
                    <span>
                      <b className="text-foreground">Alış ({s.kirliKullanildi ? "kirli" : "temiz"}):</b>{" "}
                      {(s.kirliKullanildi ? s.alisKirli! : s.alisFiyati).toFixed(3)}
                    </span>
                    <span>
                      <b className="text-foreground">Alış tarihi:</b> {s.alisTarihi}
                    </span>
                    <span>
                      <b className="text-foreground">Elde tutma:</b> {s.gun} gün
                    </span>
                  </div>
                  {s.guncelFiyat != null ? (
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        <b className="text-foreground">Güncel ({s.kirliKullanildi ? "kirli" : "temiz"}):</b>{" "}
                        {(s.kirliKullanildi ? s.guncelKirli! : s.guncelFiyat).toFixed(3)}
                      </span>
                      <span>
                        <b className="text-foreground">Fark:</b> {s.fark! >= 0 ? "+" : ""}
                        {s.fark!.toFixed(3)}
                      </span>
                      <span className={s.kz! >= 0 ? "text-emerald-600" : "text-destructive"}>
                        <b>K/Z:</b> {paraFmt(s.kz!)} TL (%{s.pct!.toFixed(2)})
                      </span>
                      {s.modifiedDur != null && (
                        <>
                          <span>
                            <b className="text-foreground">Duration:</b> {s.modifiedDur.toFixed(2)} yıl
                          </span>
                          <span>
                            <b className="text-foreground">DV01:</b> {s.dv01Pozisyon!.toFixed(1)} TL / 1bp
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-amber-600">Bu ISIN için güncel BIST fiyatı bulunamadı.</p>
                  )}
                  {!s.kirliKullanildi && s.guncelFiyat != null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Bu kağıt için resmi kupon oranı/birikmiş faiz formülü yok -- K/Z sadece temiz fiyat
                      farkından hesaplandı.
                    </p>
                  )}
                  {s.not_ && <p className="mt-1 text-xs text-muted-foreground">Not: {s.not_}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
