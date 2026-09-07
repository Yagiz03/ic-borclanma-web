import { createClient } from "@/lib/supabase/server";
import { netRezervHesapla } from "@/lib/net-rezerv";
import { CokluCizgiGrafigi, YiginliAlanGrafigi } from "./coklu-cizgi-grafigi";

const MLYR = 1e9;

function milyar(v: number): string {
  return (v / MLYR).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

export async function NetRezervBolumu() {
  const supabase = await createClient();

  // Supabase'in varsayılan 1000 satır sınırı tek .in() sorgusunda tüm
  // serileri (2020'den ~8000 satır) birlikte çekmeyi keserdi -- BASLANGIC
  // (2025-01-01) sonrası zaten tek ihtiyacımız olduğundan her günlük seri
  // ayrı ve tarih filtreli sorgulanıyor (~250-600 satır/seri, sınırın altında).
  const gunlukSeriler = [
    "bilanco_dis_varliklar",
    "bilanco_toplam_doviz_yukumluluk",
    "usdtry",
    "swap_stok_alim_yonlu",
    "swap_stok_satim_yonlu",
  ];

  const [gunlukSonuclari, { data: urdlHaftalik }, { data: aylikSonuclari }] = await Promise.all([
    Promise.all(
      gunlukSeriler.map((seriAdi) =>
        supabase
          .from("evds_seriler")
          .select("seri_adi, tarih, deger")
          .eq("seri_adi", seriAdi)
          .gte("tarih", "2025-01-01")
          .order("tarih"),
      ),
    ),
    supabase.from("urdl_haftalik").select("tarih, forward_future, diger").order("tarih"),
    supabase
      .from("evds_seriler")
      .select("seri_adi, tarih, deger")
      .in("seri_adi", ["urdl_forward_future_aylik", "urdl_diger_aylik"])
      .order("tarih"),
  ]);

  const seriGruplari = new Map<string, { tarih: string; deger: number | null }[]>();
  for (const res of gunlukSonuclari) {
    for (const r of res.data ?? []) {
      const liste = seriGruplari.get(r.seri_adi) ?? [];
      liste.push({ tarih: r.tarih, deger: r.deger });
      seriGruplari.set(r.seri_adi, liste);
    }
  }
  for (const r of aylikSonuclari ?? []) {
    const liste = seriGruplari.get(r.seri_adi) ?? [];
    liste.push({ tarih: r.tarih, deger: r.deger });
    seriGruplari.set(r.seri_adi, liste);
  }

  const df = netRezervHesapla(
    seriGruplari.get("bilanco_dis_varliklar") ?? [],
    seriGruplari.get("bilanco_toplam_doviz_yukumluluk") ?? [],
    seriGruplari.get("usdtry") ?? [],
    seriGruplari.get("swap_stok_alim_yonlu") ?? [],
    seriGruplari.get("swap_stok_satim_yonlu") ?? [],
    urdlHaftalik ?? [],
    seriGruplari.get("urdl_forward_future_aylik") ?? [],
    seriGruplari.get("urdl_diger_aylik") ?? [],
  );

  if (df.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Net rezerv için gerekli seriler bulunamadı.
      </p>
    );
  }

  const son = df[df.length - 1];

  // 3 seri x 348 satır = 1044, Supabase'in 1000 satır sınırını (ve son/en
  // güncel tarihleri kesmesini) aşmamak için bir tarih filtresiyle sınırlanıyor.
  const rezervSeriler = ["rezerv_toplam", "rezerv_doviz", "rezerv_altin"];
  const { data: rezervData } = await supabase
    .from("evds_seriler")
    .select("seri_adi, tarih, deger")
    .in("seri_adi", rezervSeriler)
    .gte("tarih", "2023-01-01")
    .order("tarih");

  const rezervGunler = new Map<string, Record<string, string | number>>();
  for (const r of rezervData ?? []) {
    if (r.deger == null) continue;
    const satir: Record<string, string | number> = rezervGunler.get(r.tarih) ?? { tarih: r.tarih };
    satir[r.seri_adi] = r.deger;
    rezervGunler.set(r.tarih, satir);
  }
  const rezervVeri = Array.from(rezervGunler.values())
    .filter((r) => r.rezerv_toplam != null)
    .sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
  const sonRezerv = rezervVeri.length > 0 ? rezervVeri[rezervVeri.length - 1] : null;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h3 className="text-base font-semibold">TCMB rezervleri (milyar USD)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Net Rezerv</p>
            <p className="font-figures font-semibold">{milyar(son.netRezerv)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Brüt Rezerv</p>
            <p className="font-figures font-semibold">{milyar(son.brutRezerv)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Toplam Swap Stok</p>
            <p className="font-figures font-semibold">{milyar(son.toplamSwap)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Lokal Swap</p>
            <p className="font-figures font-semibold">{milyar(son.lokalSwap)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Yabancı Swap</p>
            <p className="font-figures font-semibold">{milyar(son.yabanciSwap)}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Son veri: {son.tarih} -- swap çıpası: {son.cipaKaynak}. Brüt = (Dış Varlıklar − Döviz Yükümlülükleri) / kur;
          Net = Brüt − Toplam Swap Stok. Toplam swap, haftalık URDL tablosundan (II.2 + II.3); ara günlerde yabancı
          bacak sabit taşınıp günlük TCMB taraflı (lokal) swap stoku eklenir.
        </p>

        <div>
          <p className="mb-2 text-sm font-medium">Brüt ve Net Rezerv (milyar USD)</p>
          <CokluCizgiGrafigi
            veri={df.map((r) => ({ tarih: r.tarih, "Brüt Rezerv": r.brutRezerv / MLYR, "Net Rezerv": r.netRezerv / MLYR }))}
            seriler={[
              { anahtar: "Brüt Rezerv", etiket: "Brüt Rezerv" },
              { anahtar: "Net Rezerv", etiket: "Net Rezerv" },
            ]}
            birim=" Mlr $"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Swap stoku bileşenleri (milyar USD)</p>
          <CokluCizgiGrafigi
            veri={df.map((r) => ({
              tarih: r.tarih,
              "Toplam Swap Stok": r.toplamSwap / MLYR,
              "Lokal Swap": r.lokalSwap / MLYR,
              "Yabancı Swap": r.yabanciSwap / MLYR,
            }))}
            seriler={[
              { anahtar: "Toplam Swap Stok", etiket: "Toplam Swap Stok" },
              { anahtar: "Lokal Swap", etiket: "Lokal Swap (TCMB taraflı)" },
              { anahtar: "Yabancı Swap", etiket: "Yabancı Swap" },
            ]}
            birim=" Mlr $"
          />
        </div>
      </div>

      {sonRezerv && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Rezervler (Milyon USD)</h3>
          <p className="text-xs text-muted-foreground">TCMB&apos;nin haftalık açıkladığı resmi Toplam Rezerv/Altın/Döviz kompozisyonu.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Resmi Toplam Rezerv</p>
              <p className="font-figures font-semibold">{Number(sonRezerv.rezerv_toplam).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Altın</p>
              <p className="font-figures font-semibold">{sonRezerv.rezerv_altin != null ? Number(sonRezerv.rezerv_altin).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) : "–"}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Döviz</p>
              <p className="font-figures font-semibold">{sonRezerv.rezerv_doviz != null ? Number(sonRezerv.rezerv_doviz).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) : "–"}</p>
            </div>
          </div>
          <YiginliAlanGrafigi
            veri={rezervVeri}
            seriler={[
              { anahtar: "rezerv_altin", etiket: "Altın" },
              { anahtar: "rezerv_doviz", etiket: "Döviz" },
            ]}
            birim=" Mn USD"
          />
        </div>
      )}
    </div>
  );
}
