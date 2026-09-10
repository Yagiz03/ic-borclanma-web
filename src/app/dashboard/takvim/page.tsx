import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { globalOlaylariAyIcinBul, kapsamNotu, trEnflasyonGunu } from "@/lib/global-takvim";
import { trTarihPadle } from "@/lib/tarih";
import { sayi } from "@/lib/bicim";

const AY_ADLARI = [
  "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const GUN_BASLIKLARI = ["Pzt", "Sal", "Çar", "Per", "Cum"];

// Grafiklerle aynı palet değişkenleri -- burada sabit oklch değerleri vardı ve
// Apple paletine (mavi) geçildiğinde takvim hâlâ eski mor tonunu gösteriyordu.
const RENK: Record<string, string> = {
  "PPK Toplantı Kararı": "var(--chart-1)",
  "Enflasyon Raporu": "var(--chart-2)",
  "Finansal İstikrar Raporu": "var(--chart-3)",
  "İhale": "var(--chart-4)",
  "Doğrudan Satış": "var(--chart-5)",
  "Türkiye Enflasyonu": "var(--chart-7)",
};

type Olay = {
  etiket: string;
  renk: string;
  detay: string;
  /** Hücrede etiketin altına yazılan tek satırlık öz (ISIN gibi). */
  oz?: string;
};

/**
 * Doğrudan satış adını kaba bir "tür imzası"na indirger.
 *
 * Plan ile gerçekleşen kayıt aynı kağıdı FARKLI yazıyor: strateji belgesi
 * "ABD Doları Cinsi Devlet Tahvili" derken fx_dibs_sonuc "Devlet Tahvili"
 * + doviz_cinsi "USD" tutuyor. Düz metin karşılaştırması yapılınca ikisi
 * de takvimde görünüyordu (3 Şubat 2026'da dört satır). İmza üzerinden
 * eşleştirince aynı ihraç bir kez çıkıyor.
 */
function satisImzasi(ad: string): string {
  const a = ad.toLocaleLowerCase("tr");
  const dovizli = /abd doları|euro|döviz|\(usd\)|\(eur\)/.test(a);
  const altinli = /altın|altına/.test(a);
  const kira = /kira sertifika/.test(a);
  return `${dovizli ? "fx" : altinli ? "altin" : "tl"}|${kira ? "kira" : "tahvil"}`;
}

function ayEkle(yil: number, ay: number, delta: number): { yil: number; ay: number } {
  let a = ay + delta;
  let y = yil;
  while (a > 12) { a -= 12; y += 1; }
  while (a < 1) { a += 12; y -= 1; }
  return { yil: y, ay: a };
}

export default async function TakvimPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string; ay?: string; global?: string }>;
}) {
  const params = await searchParams;
  const bugun = new Date();
  const yil = params.yil ? Number(params.yil) : bugun.getFullYear();
  const ay = params.ay ? Number(params.ay) : bugun.getMonth() + 1;
  const globalIzgarada = params.global === "1";
  const globalOlaylar = globalOlaylariAyIcinBul(yil, ay);

  const supabase = await createClient();
  const ayBaslangic = `${yil}-${String(ay).padStart(2, "0")}-01`;
  const ayBitisTarih = new Date(Date.UTC(yil, ay, 1));
  const ayBitis = ayBitisTarih.toISOString().slice(0, 10);

  const enflasyonTarihi = trEnflasyonGunu(yil, ay);
  const oncekiAy = ay === 1 ? 12 : ay - 1;
  const oncekiYil = ay === 1 ? yil - 1 : yil;
  const oncekiAyReferans = `${oncekiYil}-${String(oncekiAy).padStart(2, "0")}-01`;

  // ihrac_takvimi yalnizca strateji belgesinin kapsadigi 3 ayi tutuyor, yani
  // gecmis aylar bombostu. Gerceklesen ihaleler ihale_sonuclari'nda 2020'ye
  // kadar duruyor -- gecmis aylar oradan doluyor ve planlanandan daha
  // fazlasini gosteriyor (ISIN, gerceklesen faiz, satis tutari).
  // ihale_tarihi metin ve "gg.aa.yyyy" bicimli; gun basta sifirsiz
  // olabildigi icin ay+yil sonekiyle esleniyor.
  const ayEki = `%.${String(ay).padStart(2, "0")}.${yil}`;

  const [
    { data: tcmb }, { data: ihrac }, { data: isinOzet }, { data: enflasyonSeriler }, { data: gerceklesen },
    { data: kiraSatis }, { data: altinSatis }, { data: fxSatis }, { data: duyurular },
  ] = await Promise.all([
    supabase.from("tcmb_takvim").select("*").gte("tarih", ayBaslangic).lt("tarih", ayBitis),
    supabase.from("ihrac_takvimi").select("*").gte("tarih", ayBaslangic).lt("tarih", ayBitis),
    supabase.from("isin_ozet").select("isin, senet_tanimi, vade_tarihi"),
    enflasyonTarihi.getTime() <= bugun.getTime()
      ? supabase
          .from("evds_seriler")
          .select("seri_adi, deger")
          .in("seri_adi", ["tufe_fe25_aylik_yuzde", "tufe_fe25_yillik_yuzde", "yiufe_aylik_yuzde", "yiufe_yillik_yuzde"])
          .eq("tarih", oncekiAyReferans)
      : Promise.resolve({ data: [] as { seri_adi: string; deger: number }[] }),
    supabase
      .from("ihale_sonuclari")
      .select("isin, senet_tanimi, ihale_tarihi, ihrac_tipi, vade_tarihi, ort_yillik_bilesik_gerceklesme, toplam_gerceklesme_mn")
      .like("ihale_tarihi", ayEki),
    // Gerceklesen DOGRUDAN SATISLAR uc ayri tabloda: TL kira sertifikasi,
    // altin (tahvil + altina dayali kira sertifikasi) ve doviz cinsi DIBS.
    supabase.from("kira_sertifikasi_ihrac").select("isin, ihrac_tarihi, itfa_tarihi, tutar_tl").like("ihrac_tarihi", ayEki),
    supabase.from("altin_ihrac_sonuclari").select("isin, tur, ihrac_tarihi, itfa_tarihi, miktar_kg, yillik_oran_pct").like("ihrac_tarihi", ayEki),
    supabase.from("fx_dibs_sonuc").select("isin, tur, doviz_cinsi, ihrac_tarihi, itfa_tarihi, gerceklesen_tutar").like("ihrac_tarihi", ayEki),
    // HMB ihaleden en az bir gun once "ihale duyurusu" yayimliyor ve ISIN
    // ile resmi kupon orani orada belli oluyor. Takvim bunu okumuyordu,
    // bu yuzden ihaleye bir gun kala bile "Yeni kagit -- ISIN henuz belli
    // degil" yaziyordu.
    supabase
      .from("ihale_duyurulari")
      .select("isin, ihale_tarihi, senet_tanimi, ihrac_tipi, resmi_kupon_orani_pct, ek_getiri_bp")
      .like("ihale_tarihi", ayEki),
  ]);

  const isinHarita = new Map<string, string>();
  for (const r of isinOzet ?? []) {
    const anahtar = `${r.senet_tanimi}|${trTarihPadle(r.vade_tarihi) ?? ""}`;
    if (!isinHarita.has(anahtar)) isinHarita.set(anahtar, r.isin);
  }

  const gunler: Record<number, Olay[]> = {};
  for (const t of tcmb ?? []) {
    const gun = Number(t.tarih.slice(8, 10));
    (gunler[gun] ??= []).push({ etiket: t.tur, renk: RENK[t.tur] ?? "var(--muted-foreground)", detay: "" });
  }
  // Gerçekleşen ihaleler: gün + senet tipi eşleşen PLAN satırını bastırıyor
  // (ikisi aynı ihale; gerçekleşen daha çok şey biliyor).
  const gerceklesenAnahtarlari = new Set<string>();
  for (const r of gerceklesen ?? []) {
    const [g, a] = String(r.ihale_tarihi).split(".");
    const gun = Number(g);
    if (!Number.isFinite(gun)) continue;
    gerceklesenAnahtarlari.add(`${gun}|${r.senet_tanimi}`);
    const getiri = r.ort_yillik_bilesik_gerceklesme;
    const tutar = r.toplam_gerceklesme_mn;
    (gunler[gun] ??= []).push({
      etiket: `İhale: ${r.senet_tanimi}`,
      renk: RENK["İhale"],
      oz: r.isin ?? undefined,
      detay: [
        r.isin ? `ISIN: ${r.isin}` : null,
        r.ihrac_tipi,
        getiri != null ? `Ort. bileşik %${Number(getiri).toFixed(2)}` : null,
        tutar != null ? `${sayi(Number(tutar), 0)} Mn TL satış` : null,
        r.vade_tarihi ? `İtfa: ${r.vade_tarihi}` : null,
      ].filter(Boolean).join(" — "),
    });
    void a;
  }

  // Gerçekleşen doğrudan satışlar. Senet adı, plan satırındakiyle aynı
  // yazılıyor ki aşağıdaki bastırma eşleşsin.
  function dogrudanSatisEkle(
    ihracTarihi: unknown, senet: string, isin: unknown, itfa: unknown, detaylar: (string | null)[],
  ) {
    const gun = Number(String(ihracTarihi).split(".")[0]);
    if (!Number.isFinite(gun)) return;
    gerceklesenAnahtarlari.add(`${gun}|${satisImzasi(senet)}`);
    (gunler[gun] ??= []).push({
      etiket: `Doğrudan Satış: ${senet}`,
      renk: RENK["Doğrudan Satış"],
      oz: typeof isin === "string" ? isin : undefined,
      detay: [
        isin ? `ISIN: ${isin}` : null,
        ...detaylar,
        itfa ? `İtfa: ${itfa}` : null,
      ].filter(Boolean).join(" — "),
    });
  }

  for (const r of kiraSatis ?? []) {
    dogrudanSatisEkle(r.ihrac_tarihi, "Kira Sertifikası", r.isin, r.itfa_tarihi, [
      r.tutar_tl != null ? `${sayi(Number(r.tutar_tl) / 1e6, 0)} Mn TL` : null,
    ]);
  }
  for (const r of altinSatis ?? []) {
    dogrudanSatisEkle(r.ihrac_tarihi, String(r.tur), r.isin, r.itfa_tarihi, [
      r.miktar_kg != null ? `${sayi(Number(r.miktar_kg), 0)} kg altın` : null,
      r.yillik_oran_pct != null ? `Yıllık %${Number(r.yillik_oran_pct).toFixed(2)}` : null,
    ]);
  }
  for (const r of fxSatis ?? []) {
    // "Devlet Tahvili" / "Kira Sertifikası" -- doviz cinsi eklenmezse TL
    // ihraclariyla karisiyor.
    dogrudanSatisEkle(r.ihrac_tarihi, `${r.tur} (${r.doviz_cinsi})`, r.isin, r.itfa_tarihi, [
      r.gerceklesen_tutar != null ? `${sayi(Number(r.gerceklesen_tutar), 0)} ${r.doviz_cinsi}` : null,
    ]);
  }

  // Duyuru haritası: gün + senet adı -> ilan edilen ISIN/kupon.
  const duyuruHarita = new Map<
    string,
    { isin: string; resmi_kupon_orani_pct: number | null; ek_getiri_bp: number | null }
  >();
  for (const d of duyurular ?? []) {
    const gun = Number(String(d.ihale_tarihi).split(".")[0]);
    if (!Number.isFinite(gun)) continue;
    duyuruHarita.set(`${gun}|${d.senet_tanimi}`, {
      isin: d.isin,
      resmi_kupon_orani_pct: d.resmi_kupon_orani_pct,
      ek_getiri_bp: d.ek_getiri_bp,
    });
  }

  // Aynı ihraç birden çok strateji belgesinden gelebiliyor -- ızgarada iki
  // kez görünmesin diye tekilleştiriliyor.
  const gorulenIhrac = new Set<string>();
  for (const i of ihrac ?? []) {
    const anahtar = `${i.tarih}|${i.yontem}|${i.senet_turu}|${i.vade}|${i.itfa_tarihi ?? ""}`;
    if (gorulenIhrac.has(anahtar)) continue;
    gorulenIhrac.add(anahtar);
    const gun = Number(i.tarih.slice(8, 10));
    const kisaYontem = i.yontem.startsWith("İhale") ? "İhale" : "Doğrudan Satış";
    // Bu ihraç gerçekleşmişse planı tekrar yazma. İhalelerde senet adı iki
    // tarafta da aynı; doğrudan satışlarda değil (bkz. satisImzasi).
    const bastirmaAnahtari =
      kisaYontem === "İhale" ? `${gun}|${i.senet_turu}` : `${gun}|${satisImzasi(i.senet_turu)}`;
    if (gerceklesenAnahtarlari.has(bastirmaAnahtari)) continue;
    // ISIN doğrudan ihraç takviminde yok: kağıt tipi + itfa tarihinden
    // isin_ozet'e eşleniyor (İhale Detay'daki aynı eşleme). Yeni ihraçlarda
    // henüz ISIN yok -- o zaman bunu açıkça yazıyoruz.
    const duyuru = duyuruHarita.get(`${gun}|${i.senet_turu}`);
    // Duyuru varsa o kesin: ISIN'i HMB ilan etmis demektir.
    const isin = duyuru?.isin ?? isinHarita.get(`${i.senet_turu}|${trTarihPadle(i.itfa_tarihi) ?? ""}`);
    const ilkIhracMi = String(i.yontem).includes("İlk ihraç");
    (gunler[gun] ??= []).push({
      etiket: `${kisaYontem}: ${i.senet_turu}`,
      renk: RENK[kisaYontem] ?? "var(--muted-foreground)",
      oz: isin ?? (ilkIhracMi ? "Yeni kağıt — ISIN henüz belli değil" : undefined),
      detay: [
        isin ? `ISIN: ${isin}` : null,
        i.vade,
        i.itfa_tarihi ? `İtfa: ${i.itfa_tarihi}` : null,
        duyuru?.resmi_kupon_orani_pct != null ? `Kupon %${Number(duyuru.resmi_kupon_orani_pct).toFixed(2)}` : null,
        duyuru?.ek_getiri_bp != null ? `Ek getiri ${Number(duyuru.ek_getiri_bp).toFixed(0)} bp` : null,
        duyuru ? "İhale duyurusu yayımlandı" : null,
      ]
        .filter(Boolean)
        .join(" — "),
    });
  }

  {
    const veri = new Map((enflasyonSeriler ?? []).map((r) => [r.seri_adi, Number(r.deger)]));
    const tufeAylik = veri.get("tufe_fe25_aylik_yuzde");
    const tufeYillik = veri.get("tufe_fe25_yillik_yuzde");
    const yiufeAylik = veri.get("yiufe_aylik_yuzde");
    const yiufeYillik = veri.get("yiufe_yillik_yuzde");
    const parcalar: string[] = [];
    if (tufeAylik != null && tufeYillik != null) parcalar.push(`TÜFE aylık %${tufeAylik.toFixed(2)}, yıllık %${tufeYillik.toFixed(2)}`);
    if (yiufeAylik != null && yiufeYillik != null) parcalar.push(`Yİ-ÜFE aylık %${yiufeAylik.toFixed(2)}, yıllık %${yiufeYillik.toFixed(2)}`);
    const detay = parcalar.length > 0 ? `${AY_ADLARI[oncekiAy]} verisi: ${parcalar.join(" | ")}` : `${AY_ADLARI[oncekiAy]} verisi — 10:00 (TÜİK)`;
    (gunler[enflasyonTarihi.getUTCDate()] ??= []).push({
      etiket: "Türkiye Enflasyonu (TÜFE + Yİ-ÜFE)",
      renk: RENK["Türkiye Enflasyonu"],
      detay,
    });
  }

  if (globalIzgarada) {
    for (const o of globalOlaylar) {
      (gunler[o.gun] ??= []).push({ etiket: `🌐 ${o.etiket}`, renk: "bg-slate-500", detay: o.detay });
    }
  }

  // "Bu ayın olayları" listesi: ızgaradaki yerli olaylar + globaller,
  // gün sırasına göre düz bir liste hâlinde.
  const listeSatirlari: { tarih: string; etiket: string; detay: string }[] = [];
  const gunEtiketi = (g: number) =>
    `${String(g).padStart(2, "0")}.${String(ay).padStart(2, "0")}.${yil}`;
  const listeGunleri = new Map<number, { etiket: string; detay: string }[]>();
  for (const [g, olaylar] of Object.entries(gunler)) {
    for (const o of olaylar) {
      const gun = Number(g);
      listeGunleri.set(gun, [
        ...(listeGunleri.get(gun) ?? []),
        { etiket: o.etiket, detay: o.detay ?? "" },
      ]);
    }
  }
  for (const o of globalOlaylar) {
    // Izgaraya zaten işlendiyse iki kez yazma.
    if (globalIzgarada) continue;
    listeGunleri.set(o.gun, [
      ...(listeGunleri.get(o.gun) ?? []),
      { etiket: `🌐 ${o.etiket}`, detay: o.detay },
    ]);
  }
  for (const gun of [...listeGunleri.keys()].sort((a, b) => a - b)) {
    for (const o of listeGunleri.get(gun)!) {
      listeSatirlari.push({ tarih: gunEtiketi(gun), etiket: o.etiket, detay: o.detay });
    }
  }
  const kapsamUyarisi = kapsamNotu(yil);

  const ilkGun = new Date(Date.UTC(yil, ay - 1, 1));
  const ilkGunHaftaIcinde = (ilkGun.getUTCDay() + 6) % 7; // 0=Pzt
  const ayinGunSayisi = new Date(Date.UTC(yil, ay, 0)).getUTCDate();

  const hucreler: (number | null)[] = [];
  for (let i = 0; i < ilkGunHaftaIcinde; i++) hucreler.push(null);
  for (let g = 1; g <= ayinGunSayisi; g++) {
    const haftaGunu = (ilkGunHaftaIcinde + g - 1) % 7;
    if (haftaGunu < 5) hucreler.push(g);
  }
  while (hucreler.length % 5 !== 0) hucreler.push(null);

  const onceki = ayEkle(yil, ay, -1);
  const sonraki = ayEkle(yil, ay, 1);
  const bugunMu = (g: number) => yil === bugun.getFullYear() && ay === bugun.getMonth() + 1 && g === bugun.getDate();

  const lejant = Object.keys(RENK).filter((k) =>
    k === "Türkiye Enflasyonu" ||
    [...(tcmb ?? []).map((t) => t.tur), ...(ihrac ?? []).map((i) => (i.yontem.startsWith("İhale") ? "İhale" : "Doğrudan Satış"))].includes(k),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Takvim</h1>
        <p className="text-sm text-muted-foreground">
          TCMB&apos;nin PPK toplantı/rapor takvimi ve HMB&apos;nin ihraç (ihale + doğrudan satış) takvimi.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-center gap-4">
            <Link
              href={`/dashboard/takvim?yil=${onceki.yil}&ay=${onceki.ay}`}
              className="flex size-8 items-center justify-center rounded-full hover:bg-accent"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <h2 className="w-40 text-center text-lg font-semibold">
              {AY_ADLARI[ay]} {yil}
            </h2>
            <Link
              href={`/dashboard/takvim?yil=${sonraki.yil}&ay=${sonraki.ay}`}
              className="flex size-8 items-center justify-center rounded-full hover:bg-accent"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
            {lejant.map((etiket) => (
              <span key={etiket} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className={`size-2 rounded-full ${RENK[etiket]}`} />
                {etiket}
              </span>
            ))}
            {globalIzgarada && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-slate-500" />
                🌐 Global olay
              </span>
            )}
            <Link
              href={`/dashboard/takvim?yil=${yil}&ay=${ay}${globalIzgarada ? "" : "&global=1"}`}
              title="Fed/ECB/BOJ/BOE faiz kararı ve ABD CPI-PPI günlerini takvim ızgarasına da işler. Aşağıdaki listede her zaman görünürler."
              className={`ml-2 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                globalIzgarada ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              🌐 Takvimde göster
            </Link>
          </div>

          <div className="grid grid-cols-5 gap-1.5 overflow-x-auto">
            {GUN_BASLIKLARI.map((g) => (
              <div key={g} className="pb-1 text-center text-sm font-medium text-muted-foreground">
                {g}
              </div>
            ))}
            {hucreler.map((gun, i) => (
              <div
                key={i}
                className="min-h-28 rounded-lg border border-border bg-card p-2"
              >
                {gun && (
                  <>
                    <span
                      className={`flex size-7 items-center justify-center rounded-full text-sm font-semibold ${
                        bugunMu(gun) ? "gradient-marka text-white" : "text-foreground"
                      }`}
                    >
                      {gun}
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {/* Olay kutucuğu: dolu/koyu renk yerine SOLUK zemin +
                          renkli sol çizgi ve normal metin rengi. Doygun zemin
                          üstüne beyaz yazı hücreleri okunmaz kılıyordu (eski
                          Streamlit takviminde de bu biçim kullanılıyordu).
                          Metin sarmalanıyor, kırpılmıyor. */}
                      {(gunler[gun] ?? []).map((o, j) => (
                        <div
                          key={j}
                          title={o.detay}
                          style={{
                            backgroundColor: `color-mix(in oklch, ${o.renk} 14%, transparent)`,
                            borderLeftColor: o.renk,
                          }}
                          className="rounded-sm border-l-[3px] px-1.5 py-1 text-xs leading-snug text-foreground"
                        >
                          <span className="font-medium">{o.etiket}</span>
                          {o.oz && (
                            <span className="font-figures mt-0.5 block text-[11px] text-muted-foreground">
                              {o.oz}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Bu ayın olayları (liste): ızgaradaki YERLİ olaylar (ihale, PPK,
              doğrudan satış, TR enflasyonu) + global olaylar. Globaller,
              "🌐 Takvimde göster" düğmesinden BAĞIMSIZ olarak her zaman
              listede -- ızgaraya işlenmeseler bile. */}
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-semibold">Bu ayın olayları (liste)</h3>
            {listeSatirlari.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Bu ay için bilinen bir olay yok — ihraç takvimi genelde sadece HMB&apos;nin güncel
                İç Borçlanma Stratejisi belgesinin kapsadığı ~3 aylık dönem için mevcut.
              </p>
            ) : (
              <div className="space-y-1">
                {listeSatirlari.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-figures font-semibold text-foreground">{r.tarih}</span>
                    <span className="text-foreground">{r.etiket}</span>
                    {r.detay && <span className="text-muted-foreground">— {r.detay}</span>}
                  </div>
                ))}
              </div>
            )}
            {kapsamUyarisi && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">⚠️ {kapsamUyarisi}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
