import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { globalOlaylariAyIcinBul, trEnflasyonGunu } from "@/lib/global-takvim";

const AY_ADLARI = [
  "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const GUN_BASLIKLARI = ["Pzt", "Sal", "Çar", "Per", "Cum"];

// Grafiklerle aynı palet değişkenleri -- burada sabit oklch değerleri vardı ve
// Apple paletine (mavi) geçildiğinde takvim hâlâ eski mor tonunu gösteriyordu.
const RENK: Record<string, string> = {
  "PPK Toplantı Kararı": "bg-[var(--chart-1)]",
  "Enflasyon Raporu": "bg-[var(--chart-2)]",
  "Finansal İstikrar Raporu": "bg-[var(--chart-3)]",
  "İhale": "bg-[var(--chart-4)]",
  "Doğrudan Satış": "bg-[var(--chart-5)]",
  "Türkiye Enflasyonu": "bg-[oklch(0.62_0.2_15)]",
};

type Olay = { etiket: string; renk: string; detay: string };

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

  const [{ data: tcmb }, { data: ihrac }, { data: enflasyonSeriler }] = await Promise.all([
    supabase.from("tcmb_takvim").select("*").gte("tarih", ayBaslangic).lt("tarih", ayBitis),
    supabase.from("ihrac_takvimi").select("*").gte("tarih", ayBaslangic).lt("tarih", ayBitis),
    enflasyonTarihi.getTime() <= bugun.getTime()
      ? supabase
          .from("evds_seriler")
          .select("seri_adi, deger")
          .in("seri_adi", ["tufe_fe25_aylik_yuzde", "tufe_fe25_yillik_yuzde", "yiufe_aylik_yuzde", "yiufe_yillik_yuzde"])
          .eq("tarih", oncekiAyReferans)
      : Promise.resolve({ data: [] as { seri_adi: string; deger: number }[] }),
  ]);

  const gunler: Record<number, Olay[]> = {};
  for (const t of tcmb ?? []) {
    const gun = Number(t.tarih.slice(8, 10));
    (gunler[gun] ??= []).push({ etiket: t.tur, renk: RENK[t.tur] ?? "bg-muted-foreground", detay: "" });
  }
  for (const i of ihrac ?? []) {
    const gun = Number(i.tarih.slice(8, 10));
    const kisaYontem = i.yontem.startsWith("İhale") ? "İhale" : "Doğrudan Satış";
    (gunler[gun] ??= []).push({
      etiket: `${kisaYontem}: ${i.senet_turu}`,
      renk: RENK[kisaYontem] ?? "bg-muted-foreground",
      detay: `${i.vade}${i.itfa_tarihi ? ` — İtfa: ${i.itfa_tarihi}` : ""}`,
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
    <div className="mx-auto max-w-[1400px] space-y-6">
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
                      {(gunler[gun] ?? []).map((o, j) => (
                        <div
                          key={j}
                          title={o.detay}
                          className={`rounded px-1.5 py-1 text-xs leading-snug font-medium text-white ${o.renk}`}
                        >
                          {o.etiket}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {globalOlaylar.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">🌐 Global olaylar (bu ay)</p>
              <div className="space-y-1">
                {globalOlaylar.map((o, i) => (
                  <div key={i} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-figures font-semibold text-foreground">
                      {String(o.gun).padStart(2, "0")}.{String(ay).padStart(2, "0")}.{yil}
                    </span>
                    <span className="text-foreground">{o.etiket}</span>
                    <span className="text-muted-foreground">-- {o.detay}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
