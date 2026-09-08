import { createClient } from "@/lib/supabase/server";
import { isinTipSozlugunuGetir } from "@/lib/isin-tip";
import { outstandingDefteriHesapla } from "@/lib/outstanding-ledger";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";
import { KagitTipiDagilimiClient } from "./kagit-tipi-dagilimi-client";

export async function KagitTipiDagilimiBolumu() {
  const supabase = await createClient();

  const [{ data: ihaleIst, error }, { data: stok }] = await Promise.all([
    tumSatirlariGetir((from, to) =>
      supabase
        .from("tcmb_ihale_istatistikleri")
        .select("isin, ihrac_tarihi, vade_tarihi, nominal_mn, doviz_kodu")
        .order("ihale_tarihi")
        .order("isin")
        .range(from, to),
    ),
    supabase.from("borc_stoku").select("yil, ay, ic_borc_toplam"),
  ]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!ihaleIst || ihaleIst.length === 0) {
    return null;
  }

  const tipSozluk = await isinTipSozlugunuGetir(supabase);
  const ledger = outstandingDefteriHesapla(ihaleIst, tipSozluk);
  if (ledger.length === 0) return null;

  let kapsamNotu = "";
  if (stok && stok.length > 0) {
    const stokAylari = new Map(
      stok
        .filter((s) => s.ic_borc_toplam != null && Number(s.ic_borc_toplam) > 0)
        .map((s) => [`${s.yil}-${String(s.ay).padStart(2, "0")}`, Number(s.ic_borc_toplam)]),
    );
    const ortakAylar = ledger.filter((r) => stokAylari.has(r.ay)).map((r) => r.ay);
    if (ortakAylar.length > 0) {
      const sonAy = ortakAylar[ortakAylar.length - 1];
      const sonSatir = ledger.find((r) => r.ay === sonAy)!;
      const icBorcToplam = stokAylari.get(sonAy)!;
      const kapsamOrani = (sonSatir.ayToplam / icBorcToplam) * 100;
      kapsamNotu = `Son ay için tahmini toplam, HMB'nin resmi İç Borç Stoku toplamının ~%${kapsamOrani.toFixed(0)}'ini kapsıyor — `;
    }
  }

  return <KagitTipiDagilimiClient ledger={ledger} kapsamNotu={kapsamNotu} />;
}
