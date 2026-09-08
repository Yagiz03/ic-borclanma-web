import { createClient } from "@/lib/supabase/server";
import { CokluCizgiGrafigi, BarCizgiGrafigi } from "./coklu-cizgi-grafigi";

type SeriRow = { seri_adi: string; tarih: string; deger: number | null };

function pivotla(rows: SeriRow[]): Record<string, string | number>[] {
  const gunler = new Map<string, Record<string, string | number>>();
  for (const r of rows) {
    if (r.deger == null) continue;
    const satir = gunler.get(r.tarih) ?? { tarih: r.tarih };
    satir[r.seri_adi] = r.deger;
    gunler.set(r.tarih, satir);
  }
  return Array.from(gunler.values()).sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
}

function milyon(v: number | null | undefined): string {
  return v == null ? "–" : v.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export async function DisDengeBolumu() {
  const supabase = await createClient();

  // Bilanço/swap serileri (5 seri x ~1400-1700 satır/2020'den) tek .in()
  // sorgusunda Supabase'in 1000 satır sınırını fazlasıyla aşardı -- her
  // seri ayrı ve tarih filtreli sorgulanıyor (bkz. net-rezerv.tsx'teki
  // aynı düzeltme).
  const bilancoSeriler = [
    "bilanco_dis_varliklar",
    "bilanco_toplam_doviz_yukumluluk",
    "bilanco_kamu_diger_doviz_mevduat",
    "swap_stok_alim_yonlu",
    "swap_stok_satim_yonlu",
  ];
  const [{ data: cariData }, { data: krediData }, bilancoSonuclari] = await Promise.all([
    supabase.from("evds_seriler").select("seri_adi, tarih, deger").eq("seri_adi", "cari_islemler_dengesi").order("tarih"),
    supabase.from("evds_seriler").select("seri_adi, tarih, deger").eq("seri_adi", "kredi_tuketici_toplam").order("tarih"),
    Promise.all(
      bilancoSeriler.map((seriAdi) =>
        supabase
          .from("evds_seriler")
          .select("seri_adi, tarih, deger")
          .eq("seri_adi", seriAdi)
          .gte("tarih", "2023-01-01")
          .order("tarih"),
      ),
    ),
  ]);
  const bilancoData = bilancoSonuclari.flatMap((r) => r.data ?? []);

  const cari = (cariData ?? []).filter((r) => r.deger != null).sort((a, b) => a.tarih.localeCompare(b.tarih));
  const kredi = (krediData ?? []).filter((r) => r.deger != null).sort((a, b) => a.tarih.localeCompare(b.tarih));
  const bilanco = pivotla(bilancoData ?? []);

  // cari işlemler dengesi: aylık + son 12 ay kümülatif (rolling sum, min 6 dolu ay)
  const cariGrafik = cari.map((r, i) => {
    const pencere = cari.slice(Math.max(0, i - 11), i + 1);
    const kum = pencere.length >= 6 ? pencere.reduce((s, x) => s + (x.deger ?? 0), 0) : null;
    return { tarih: r.tarih, aylik: r.deger as number, kumulatif12ay: kum };
  });
  const sonCari = cari.length > 0 ? cari[cari.length - 1] : null;
  const sonKumulatif = cariGrafik.length > 0 ? cariGrafik[cariGrafik.length - 1].kumulatif12ay : null;

  // tüketici kredileri yıllık değişim (haftalık seri, 52 hafta önceki değere göre)
  const krediYillik = kredi.map((r, i) => {
    const once = kredi[i - 52];
    const yillikPct = once && once.deger ? ((r.deger! - once.deger) / once.deger) * 100 : null;
    return { tarih: r.tarih, "Yıllık değişim": yillikPct };
  }).filter((r) => r["Yıllık değişim"] != null);

  const sonBilanco = bilancoData
    ?.filter((r) => r.seri_adi === "bilanco_dis_varliklar" && r.deger != null)
    .sort((a, b) => a.tarih.localeCompare(b.tarih))
    .at(-1);
  const sonYukumluluk = bilancoData
    ?.filter((r) => r.seri_adi === "bilanco_toplam_doviz_yukumluluk" && r.deger != null)
    .sort((a, b) => a.tarih.localeCompare(b.tarih))
    .at(-1);
  const sonKamuMevduat = bilancoData
    ?.filter((r) => r.seri_adi === "bilanco_kamu_diger_doviz_mevduat" && r.deger != null)
    .sort((a, b) => a.tarih.localeCompare(b.tarih))
    .at(-1);

  const swap = pivotla((bilancoData ?? []).filter((r) => r.seri_adi.startsWith("swap_stok_")));
  const sonSwapAlim = bilancoData
    ?.filter((r) => r.seri_adi === "swap_stok_alim_yonlu" && r.deger != null)
    .sort((a, b) => a.tarih.localeCompare(b.tarih))
    .at(-1);
  const sonSwapSatim = bilancoData
    ?.filter((r) => r.seri_adi === "swap_stok_satim_yonlu" && r.deger != null)
    .sort((a, b) => a.tarih.localeCompare(b.tarih))
    .at(-1);

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        TCMB&apos;nin haftalık açıkladığı brüt uluslararası rezervleri (altın + döviz), aylık cari işlemler dengesi
        ve tüketici kredileri (BDDK&apos;nin haftalık banka bilanço verisinin bir parçası — ticari krediler dahil
        değil, sadece konut/taşıt/ihtiyaç kredileri).
      </p>

      {sonCari && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Cari işlemler dengesi ({sonCari.tarih})</p>
              <p className="font-figures text-xl font-semibold">{milyon(sonCari.deger)} Milyon USD</p>
            </div>
            {sonKumulatif != null && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Son 12 ay kümülatif</p>
                <p className="font-figures text-xl font-semibold">{milyon(sonKumulatif)} Milyon USD</p>
              </div>
            )}
          </div>
          <h3 className="text-base font-semibold">Cari işlemler dengesi (Milyon USD)</h3>
          <BarCizgiGrafigi
            veri={cariGrafik.map((r) => ({ tarih: r.tarih, aylik: r.aylik, kumulatif12ay: r.kumulatif12ay ?? "" }))}
            barDataKey="aylik"
            cizgiDataKey="kumulatif12ay"
            barEtiket="Aylık"
            cizgiEtiket="Son 12 ay kümülatif"
            birim=" Mn USD"
          />
        </div>
      )}

      {krediYillik.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Tüketici kredileri toplamı — yıllık değişim (%)</h3>
          <p className="text-xs text-muted-foreground">
            Konut + taşıt + ihtiyaç kredilerinin toplamı (yurt içi yerleşikler) — ticari krediler dahil değil,
            EVDS&apos;de haftalık frekansta temiz bir &quot;toplam banka kredisi&quot; serisi yok.
          </p>
          <CokluCizgiGrafigi veri={krediYillik as Record<string, string | number>[]} seriler={[{ anahtar: "Yıllık değişim", etiket: "Yıllık değişim" }]} birim="%" />
        </div>
      )}

      {sonBilanco && sonYukumluluk && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">TCMB Analitik Bilanço — döviz varlık/yükümlülükleri (bin TL)</h3>
          <p className="text-xs text-muted-foreground">
            A.1 Dış Varlıklar, brüt rezervin bilanço karşılığı; P.1 Toplam Döviz Yükümlülükleri ve onun bir alt
            kalemi olan P.1ba Kamu ve Diğer Döviz Mevduatı ise TCMB&apos;nin döviz cinsi borçlarını gösteriyor.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">A.1 Dış Varlıklar (bin TL)</p>
              <p className="font-figures font-semibold">{milyon(sonBilanco.deger)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">P.1 Toplam Döviz Yükümlülükleri (bin TL)</p>
              <p className="font-figures font-semibold">{milyon(sonYukumluluk.deger)}</p>
            </div>
            {sonKamuMevduat && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">P.1ba Kamu ve Diğer Döviz Mevduatı (bin TL)</p>
                <p className="font-figures font-semibold">{milyon(sonKamuMevduat.deger)}</p>
              </div>
            )}
          </div>
          <CokluCizgiGrafigi
            veri={bilanco}
            seriler={[
              { anahtar: "bilanco_dis_varliklar", etiket: "A.1 Dış Varlıklar" },
              { anahtar: "bilanco_toplam_doviz_yukumluluk", etiket: "P.1 Toplam Döviz Yükümlülükleri" },
              { anahtar: "bilanco_kamu_diger_doviz_mevduat", etiket: "P.1ba Kamu ve Diğer Döviz Mevduatı" },
            ]}
            ondalik={0}
          />
        </div>
      )}

      {sonSwapAlim && sonSwapSatim && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">TCMB taraflı swap işlemleri — stok (Milyon ABD Doları)</h3>
          <p className="text-xs text-muted-foreground">
            Döviz karşılığı TL swap + altın swap + BIST swap işlemlerinin toplam stoku — brüt rezervin bir kısmı
            bu swap&apos;lar yoluyla geri ödenmesi gereken (borç niteliğinde) döviz olabildiğinden, rezervin
            &quot;kalitesini&quot; değerlendirirken referans olarak bakılıyor.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Toplam Stok — Alım Yönlü (Milyon USD)</p>
              <p className="font-figures font-semibold">{milyon(sonSwapAlim.deger)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Toplam Stok — Satım Yönlü (Milyon USD)</p>
              <p className="font-figures font-semibold">{milyon(sonSwapSatim.deger)}</p>
            </div>
          </div>
          <CokluCizgiGrafigi
            veri={swap}
            seriler={[
              { anahtar: "swap_stok_alim_yonlu", etiket: "Alım Yönlü" },
              { anahtar: "swap_stok_satim_yonlu", etiket: "Satım Yönlü" },
            ]}
            ondalik={0}
          />
        </div>
      )}
    </div>
  );
}
