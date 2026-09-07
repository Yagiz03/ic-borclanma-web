import { createClient } from "@/lib/supabase/server";
import { TufeM2KfeBonoClient, type AylikSatir } from "./tufe-m2-kfe-bono-client";

const SERI_ADLARI = [
  "tufe_fe25_yillik_yuzde",
  "tufe_fe25_aylik_yuzde",
  "c_cekirdek_yillik_yuzde",
  "c_cekirdek_aylik_yuzde",
  "m2_para_arzi",
  "konut_fiyat_endeksi",
  "dibs_piy_deg_toplam",
] as const;

const ALAN_ADI: Record<(typeof SERI_ADLARI)[number], string> = {
  tufe_fe25_yillik_yuzde: "tufeYillik",
  tufe_fe25_aylik_yuzde: "tufeAylik",
  c_cekirdek_yillik_yuzde: "cYillik",
  c_cekirdek_aylik_yuzde: "cAylik",
  m2_para_arzi: "m2",
  konut_fiyat_endeksi: "kfe",
  dibs_piy_deg_toplam: "bonoToplam",
};

function ayAnahtari(tarihStr: string): string {
  const d = new Date(tarihStr);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Bir serinin her ay-döneminde en son (son gözlemlenen) değerini döner --
 * pandas'ın hem aylık serilerdeki pivot 'last' hem haftalık serilerdeki
 * `resample('ME').last()` davranışıyla aynı. */
function aylikSonDegerler(rows: { tarih: string; deger: number | null }[]): Map<string, number> {
  const sirali = [...rows]
    .filter((r) => r.deger != null)
    .sort((a, b) => a.tarih.localeCompare(b.tarih));
  const harita = new Map<string, number>();
  for (const r of sirali) harita.set(ayAnahtari(r.tarih), r.deger as number);
  return harita;
}

function tumAyAraligi(anahtarlar: string[]): string[] {
  if (anahtarlar.length === 0) return [];
  const sirali = [...anahtarlar].sort();
  const [ilkYil, ilkAy] = sirali[0].split("-").map(Number);
  const [sonYil, sonAy] = sirali[sirali.length - 1].split("-").map(Number);
  const sonuc: string[] = [];
  for (let y = ilkYil, a = ilkAy; y < sonYil || (y === sonYil && a <= sonAy); ) {
    sonuc.push(`${y}-${String(a).padStart(2, "0")}`);
    a += 1;
    if (a > 12) {
      a = 1;
      y += 1;
    }
  }
  return sonuc;
}

function pctDegisim(simdi: number | null, once: number | null): number | null {
  if (simdi == null || once == null || once === 0) return null;
  return ((simdi - once) / once) * 100;
}

function reelGetiri(nominalPct: number | null, tufePct: number | null): number | null {
  if (nominalPct == null || tufePct == null) return null;
  return ((1 + nominalPct / 100) / (1 + tufePct / 100) - 1) * 100;
}

export async function TufeM2KfeBonoBolumu() {
  const supabase = await createClient();
  // 7 seri birlikte ~1050 satır, Supabase'in 1000 satır sınırını hafifçe
  // aşıp en yeni tarihleri kesiyordu -- her seri ayrı sorgulanıyor.
  const sonuclar = await Promise.all(
    SERI_ADLARI.map((seriAdi) =>
      supabase.from("evds_seriler").select("seri_adi, tarih, deger").eq("seri_adi", seriAdi).order("tarih"),
    ),
  );
  const error = sonuclar.find((r) => r.error)?.error;
  const data = sonuclar.flatMap((r) => r.data ?? []);

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        TÜFE/M2/KFE verisi bulunamadı -- evds_seriler tablosu boş.
      </p>
    );
  }

  const seriGruplari = new Map<string, { tarih: string; deger: number | null }[]>();
  for (const r of data) {
    const liste = seriGruplari.get(r.seri_adi) ?? [];
    liste.push({ tarih: r.tarih, deger: r.deger });
    seriGruplari.set(r.seri_adi, liste);
  }

  const aylikHaritalar: Record<string, Map<string, number>> = {};
  for (const seriAdi of SERI_ADLARI) {
    aylikHaritalar[ALAN_ADI[seriAdi]] = aylikSonDegerler(seriGruplari.get(seriAdi) ?? []);
  }

  const tumAnahtarlar = Object.values(aylikHaritalar).flatMap((h) => [...h.keys()]);
  const ayAralik = tumAyAraligi(tumAnahtarlar);

  const ham = ayAralik.map((ay) => ({
    ay,
    tufeYillik: aylikHaritalar.tufeYillik.get(ay) ?? null,
    tufeAylik: aylikHaritalar.tufeAylik.get(ay) ?? null,
    cYillik: aylikHaritalar.cYillik.get(ay) ?? null,
    cAylik: aylikHaritalar.cAylik.get(ay) ?? null,
    m2: aylikHaritalar.m2.get(ay) ?? null,
    kfe: aylikHaritalar.kfe.get(ay) ?? null,
    bonoToplam: aylikHaritalar.bonoToplam.get(ay) ?? null,
  }));

  const satirlar: AylikSatir[] = ham.map((satir, i) => {
    const once1 = ham[i - 1];
    const once12 = ham[i - 12];
    const m2AylikPct = once1 ? pctDegisim(satir.m2, once1.m2) : null;
    const m2YillikPct = once12 ? pctDegisim(satir.m2, once12.m2) : null;
    const kfeAylikPct = once1 ? pctDegisim(satir.kfe, once1.kfe) : null;
    const kfeYillikPct = once12 ? pctDegisim(satir.kfe, once12.kfe) : null;
    const bonoAylikPct = once1 ? pctDegisim(satir.bonoToplam, once1.bonoToplam) : null;
    const bonoYillikPct = once12 ? pctDegisim(satir.bonoToplam, once12.bonoToplam) : null;

    return {
      ay: satir.ay,
      tufeYillikPct: satir.tufeYillik,
      tufeAylikPct: satir.tufeAylik,
      cYillikPct: satir.cYillik,
      cAylikPct: satir.cAylik,
      m2: satir.m2,
      kfe: satir.kfe,
      bonoToplam: satir.bonoToplam,
      m2AylikPct,
      m2YillikPct,
      kfeAylikPct,
      kfeYillikPct,
      bonoAylikPct,
      bonoYillikPct,
      m2ReelAylikPct: reelGetiri(m2AylikPct, satir.tufeAylik),
      m2ReelYillikPct: reelGetiri(m2YillikPct, satir.tufeYillik),
      kfeReelAylikPct: reelGetiri(kfeAylikPct, satir.tufeAylik),
      kfeReelYillikPct: reelGetiri(kfeYillikPct, satir.tufeYillik),
      bonoReelAylikPct: reelGetiri(bonoAylikPct, satir.tufeAylik),
      bonoReelYillikPct: reelGetiri(bonoYillikPct, satir.tufeYillik),
    };
  });

  const sonTufeSatiri = [...satirlar].reverse().find((s) => s.tufeYillikPct != null);
  if (!sonTufeSatiri) {
    return <p className="text-sm text-muted-foreground">TÜFE verisi bulunamadı.</p>;
  }

  return <TufeM2KfeBonoClient satirlar={satirlar} son={sonTufeSatiri} />;
}
