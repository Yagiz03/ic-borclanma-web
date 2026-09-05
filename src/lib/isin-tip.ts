import type { SupabaseClient } from "@supabase/supabase-js";
import { trTarihAyristir } from "@/lib/tarih";

/**
 * ISIN -> kağıt tipi eşlemesi (pages/tcmb_gostergeler.py::_isin_tip_sozlugu'nun
 * TS portu). ihale_sonuclari (2020+), hmb_ihale_sonuclari_eski_html (2018-2019),
 * hmb_ihale_sonuclari_eski_ocr (2017-2019), hazine_ihale_eski_ocr (2014-2016)
 * birleştirilip ihale_tarihi'ne göre EN ERKEN (orijinal ihraç) kayıt esas
 * alınır -- kağıdın gerçek tipi ihraç anında sabitlenir. isin_ozet ve
 * tcmb_dibs_tip_wayback (2001-2014 resmi sınıflandırma) son çare olarak eklenir.
 */

export const TIP_SIRASI = [
  "Hazine Bonosu",
  "Kuponsuz Devlet Tahvili",
  "Sabit Kuponlu Devlet Tahvili",
  "TÜFE'ye Endeksli Devlet Tahvili",
  "Değişken Faizli Devlet Tahvili",
  "TLREF'e Endeksli Devlet Tahvili",
  "Devlet Tahvili (tip detay yok)",
  "Diğer",
] as const;

export const TIP_KISA: Record<string, string> = {
  "Hazine Bonosu": "Bono",
  "Kuponsuz Devlet Tahvili": "Kuponsuz",
  "Sabit Kuponlu Devlet Tahvili": "Sabit Kuponlu",
  "TÜFE'ye Endeksli Devlet Tahvili": "TÜFE'ye Endeksli",
  "Değişken Faizli Devlet Tahvili": "Değişken Faizli",
  "TLREF'e Endeksli Devlet Tahvili": "TLREF'e Endeksli",
  "Devlet Tahvili (tip detay yok)": "Tahvil (tip yok)",
  Diğer: "Diğer",
};

export async function isinTipSozlugunuGetir(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const [ihale, eskiHtml, eskiOcr, hazineOcr, isinOzet, wayback] = await Promise.all([
    supabase.from("ihale_sonuclari").select("isin, senet_tanimi, ihale_tarihi"),
    supabase.from("hmb_ihale_sonuclari_eski_html").select("isin, senet_tanimi, ihale_tarihi"),
    supabase.from("hmb_ihale_sonuclari_eski_ocr").select("isin, senet_tanimi, ihale_tarihi"),
    supabase.from("hazine_ihale_eski_ocr").select("isin, senet_tanimi, ihale_tarihi"),
    supabase.from("isin_ozet").select("isin, senet_tanimi"),
    supabase.from("tcmb_dibs_tip_wayback").select("isin, senet_tanimi"),
  ]);

  type Row = { isin: string; senet_tanimi: string | null; ihale_tarihi: string };
  const tumu: Row[] = [
    ...((ihale.data ?? []) as Row[]),
    ...((eskiHtml.data ?? []) as Row[]),
    ...((eskiOcr.data ?? []) as Row[]),
    ...((hazineOcr.data ?? []) as Row[]),
  ].filter((r) => r.senet_tanimi);

  tumu.sort((a, b) => {
    const ta = trTarihAyristir(a.ihale_tarihi)?.getTime() ?? Infinity;
    const tb = trTarihAyristir(b.ihale_tarihi)?.getTime() ?? Infinity;
    return ta - tb;
  });

  const sozluk = new Map<string, string>();
  for (const r of tumu) {
    if (!sozluk.has(r.isin) && r.senet_tanimi) sozluk.set(r.isin, r.senet_tanimi);
  }
  for (const r of (isinOzet.data ?? []) as { isin: string; senet_tanimi: string | null }[]) {
    if (!sozluk.has(r.isin) && r.senet_tanimi) sozluk.set(r.isin, r.senet_tanimi);
  }
  for (const r of (wayback.data ?? []) as { isin: string; senet_tanimi: string | null }[]) {
    if (!sozluk.has(r.isin) && r.senet_tanimi) sozluk.set(r.isin, r.senet_tanimi);
  }
  return sozluk;
}

export function isinTipTahminEt(isin: string, sozluk: Map<string, string>): string {
  const tip = sozluk.get(isin);
  if (tip != null) {
    return (TIP_SIRASI as readonly string[]).includes(tip) ? tip : "Diğer";
  }
  if (isin.length < 3) return "Diğer";
  const harf = isin[2];
  if (harf === "B") return "Hazine Bonosu";
  if (harf === "T") return "Devlet Tahvili (tip detay yok)";
  return "Diğer";
}
