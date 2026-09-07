import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { globalOlaylariAyIcinBul } from "@/lib/global-takvim";

const AY_ADLARI = [
  "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const GUN_BASLIKLARI = ["Pzt", "Sal", "Çar", "Per", "Cum"];

const RENK: Record<string, string> = {
  "PPK Toplantı Kararı": "bg-[oklch(0.55_0.21_264)]",
  "Enflasyon Raporu": "bg-[oklch(0.6_0.19_35)]",
  "Finansal İstikrar Raporu": "bg-[oklch(0.6_0.18_155)]",
  "İhale": "bg-[oklch(0.55_0.2_300)]",
  "Doğrudan Satış": "bg-[oklch(0.72_0.18_85)]",
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

  const [{ data: tcmb }, { data: ihrac }] = await Promise.all([
    supabase.from("tcmb_takvim").select("*").gte("tarih", ayBaslangic).lt("tarih", ayBitis),
    supabase.from("ihrac_takvimi").select("*").gte("tarih", ayBaslangic).lt("tarih", ayBitis),
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
      detay: `${i.vade}${i.itfa_tarihi ? ` -- İtfa: ${i.itfa_tarihi}` : ""}`,
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
              <span key={etiket} className="flex items-center gap-1.5 text-xs text-muted-foreground">
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

          <div className="grid grid-cols-5 gap-1 overflow-x-auto">
            {GUN_BASLIKLARI.map((g) => (
              <div key={g} className="pb-1 text-center text-xs font-medium text-muted-foreground">
                {g}
              </div>
            ))}
            {hucreler.map((gun, i) => (
              <div
                key={i}
                className="min-h-24 rounded-lg border border-border bg-card p-1.5"
              >
                {gun && (
                  <>
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                        bugunMu(gun) ? "gradient-marka text-white" : "text-foreground"
                      }`}
                    >
                      {gun}
                    </span>
                    <div className="mt-1 space-y-1">
                      {(gunler[gun] ?? []).map((o, j) => (
                        <div
                          key={j}
                          title={o.detay}
                          className={`rounded px-1 py-0.5 text-[10px] leading-tight text-white ${o.renk}`}
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
