import { createClient } from "@/lib/supabase/server";
import { CokluCizgiGrafigi } from "./coklu-cizgi-grafigi";

const SERI_ADLARI = [
  "beklenti_tufe_yilsonu",
  "beklenti_tufe_12ay",
  "beklenti_politika_faizi_yilsonu",
  "beklenti_politika_faizi_ilk_toplanti",
  "tufe_fe25_yillik_yuzde",
  "enfbek_piyasa_12ay",
  "enfbek_reel_sektor_12ay",
  "enfbek_hanehalki_12ay",
];

function pct2(v: number | null | undefined): string {
  return v == null ? "–" : `%${v.toFixed(2)}`;
}

export async function PiyasaBeklentileriBolumu() {
  const supabase = await createClient();

  const [{ data: seriler }, { data: politika }] = await Promise.all([
    supabase.from("evds_seriler").select("seri_adi, tarih, deger").in("seri_adi", SERI_ADLARI).order("tarih"),
    supabase.from("tcmb_politika_faizi").select("tarih, politika_faizi").order("tarih"),
  ]);

  if (!seriler || seriler.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Piyasa beklentisi verisi bulunamadı.
      </p>
    );
  }

  const gunler = new Map<string, Record<string, string | number>>();
  for (const r of seriler) {
    if (r.deger == null) continue;
    const satir: Record<string, string | number> = gunler.get(r.tarih) ?? { tarih: r.tarih };
    satir[r.seri_adi] = r.deger;
    gunler.set(r.tarih, satir);
  }
  const df = Array.from(gunler.values()).sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));

  const tufeBeklenti = df.filter((r) => r.beklenti_tufe_yilsonu != null);
  const sonTufeBeklenti = tufeBeklenti.length > 0 ? tufeBeklenti[tufeBeklenti.length - 1] : null;

  const tufeGrafik = df
    .filter((r) => r.tufe_fe25_yillik_yuzde != null || r.beklenti_tufe_yilsonu != null || r.beklenti_tufe_12ay != null)
    .map((r) => ({
      tarih: r.tarih,
      Gerçekleşen: r.tufe_fe25_yillik_yuzde ?? undefined,
      "Beklenti — yıl sonu": r.beklenti_tufe_yilsonu ?? undefined,
      "Beklenti — 12 ay sonrası": r.beklenti_tufe_12ay ?? undefined,
    }));

  const enfbekGrafik = df
    .filter(
      (r) =>
        r.beklenti_tufe_12ay != null ||
        r.enfbek_piyasa_12ay != null ||
        r.enfbek_reel_sektor_12ay != null ||
        r.enfbek_hanehalki_12ay != null,
    )
    .map((r) => ({
      tarih: r.tarih,
      "Piyasa Katılımcıları Anketi": r.beklenti_tufe_12ay ?? undefined,
      "Sektörel — Piyasa katılımcıları": r.enfbek_piyasa_12ay ?? undefined,
      "Sektörel — Reel sektör": r.enfbek_reel_sektor_12ay ?? undefined,
      "Sektörel — Hanehalkı": r.enfbek_hanehalki_12ay ?? undefined,
    }));

  const faizBeklenti = df.filter((r) => r.beklenti_politika_faizi_yilsonu != null);
  const sonFaizBeklenti = faizBeklenti.length > 0 ? faizBeklenti[faizBeklenti.length - 1] : null;
  const ilkToplantiBeklenti = df.filter((r) => r.beklenti_politika_faizi_ilk_toplanti != null);
  const sonIlkToplanti = ilkToplantiBeklenti.length > 0 ? ilkToplantiBeklenti[ilkToplantiBeklenti.length - 1] : null;

  const politikaGrafik = [
    ...(politika ?? []).map((r) => ({ tarih: r.tarih, "Gerçekleşen (1 hafta repo)": Number(r.politika_faizi) })),
  ];
  const faizGrafikVeri = df
    .filter((r) => r.beklenti_politika_faizi_yilsonu != null || r.beklenti_politika_faizi_ilk_toplanti != null)
    .map((r) => ({
      tarih: r.tarih,
      "Beklenti — yıl sonu": r.beklenti_politika_faizi_yilsonu ?? undefined,
      "Beklenti — ilk PPK toplantısı": r.beklenti_politika_faizi_ilk_toplanti ?? undefined,
    }));
  const faizBirlesikMap = new Map<string, Record<string, string | number>>();
  for (const r of [...politikaGrafik, ...faizGrafikVeri]) {
    const satir = faizBirlesikMap.get(r.tarih) ?? { tarih: r.tarih };
    Object.assign(satir, r);
    faizBirlesikMap.set(r.tarih, satir);
  }
  const faizBirlesik = Array.from(faizBirlesikMap.values()).sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        TCMB&apos;nin &quot;Piyasa Katılımcıları Anketi&quot;nde (ayda iki kez, banka/aracı kurum ekonomistlerine
        sorularak) topladığı enflasyon ve politika faizi beklentileri — gerçekleşenle karşılaştırmak, piyasanın ne
        kadar &quot;sürprizlendiğini&quot; gösteriyor.
      </p>

      {sonTufeBeklenti && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Beklenti — cari yıl sonu TÜFE</p>
              <p className="font-figures font-semibold">{pct2(sonTufeBeklenti.beklenti_tufe_yilsonu as number)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Beklenti — 12 ay sonrası TÜFE</p>
              <p className="font-figures font-semibold">{pct2(sonTufeBeklenti.beklenti_tufe_12ay as number)}</p>
            </div>
          </div>
          <h3 className="text-base font-semibold">TÜFE — piyasa beklentisi vs. gerçekleşen (yıllık %)</h3>
          <CokluCizgiGrafigi
            veri={tufeGrafik}
            seriler={[
              { anahtar: "Gerçekleşen", etiket: "Gerçekleşen (yıllık %)" },
              { anahtar: "Beklenti — yıl sonu", etiket: "Beklenti — cari yıl sonu" },
              { anahtar: "Beklenti — 12 ay sonrası", etiket: "Beklenti — 12 ay sonrası" },
            ]}
            birim="%"
          />
        </div>
      )}

      {enfbekGrafik.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Sektörel Enflasyon Beklentileri vs. Piyasa Katılımcıları Anketi (12 ay sonrası, %)</h3>
          <p className="text-xs text-muted-foreground">
            TCMB&apos;nin Piyasa Katılımcıları Anketi&apos;nden AYRI bir anket — &quot;Sektörel Enflasyon
            Beklentileri&quot;, piyasa katılımcıları, reel sektör ve hanehalkı gruplarına ayrı ayrı soruyor.
          </p>
          <CokluCizgiGrafigi
            veri={enfbekGrafik}
            seriler={[
              { anahtar: "Piyasa Katılımcıları Anketi", etiket: "Piyasa Katılımcıları Anketi — 12 ay sonrası" },
              { anahtar: "Sektörel — Piyasa katılımcıları", etiket: "Sektörel — Piyasa katılımcıları" },
              { anahtar: "Sektörel — Reel sektör", etiket: "Sektörel — Reel sektör" },
              { anahtar: "Sektörel — Hanehalkı", etiket: "Sektörel — Hanehalkı" },
            ]}
            birim="%"
          />
        </div>
      )}

      {sonFaizBeklenti && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Beklenti — cari yıl sonu politika faizi</p>
              <p className="font-figures font-semibold">{pct2(sonFaizBeklenti.beklenti_politika_faizi_yilsonu as number)}</p>
            </div>
            {sonIlkToplanti && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Beklenti — ilk PPK toplantısı</p>
                <p className="font-figures font-semibold">{pct2(sonIlkToplanti.beklenti_politika_faizi_ilk_toplanti as number)}</p>
              </div>
            )}
          </div>
          <h3 className="text-base font-semibold">Politika faizi — piyasa beklentisi vs. gerçekleşen (%)</h3>
          <CokluCizgiGrafigi
            veri={faizBirlesik}
            seriler={[
              { anahtar: "Gerçekleşen (1 hafta repo)", etiket: "Gerçekleşen (1 hafta repo)" },
              { anahtar: "Beklenti — yıl sonu", etiket: "Beklenti — cari yıl sonu" },
              { anahtar: "Beklenti — ilk PPK toplantısı", etiket: "Beklenti — ilk PPK toplantısı" },
            ]}
            birim="%"
          />
        </div>
      )}
    </div>
  );
}
