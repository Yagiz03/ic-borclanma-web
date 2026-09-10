/**
 * Borçlanma stratejisi fark raporunu ELLE üretir: dashboard reposundaki
 * update-strateji.yml workflow'unu tetikler (HMB'nin son iki aylık
 * strateji belgesini karşılaştırıp PDF üretir, Supabase'e yükler).
 *
 * Aynı adım günlük tam pipeline'ın (update-data.yml) içinde de var ama o
 * ~1 saat sürüyor; HMB belgeyi yayımladığı gün beklemeden almak için.
 */
import { workflowDurumu, workflowTetikle } from "@/lib/workflow-tetikle";

export async function POST() {
  return workflowTetikle("update-strateji.yml", {
    calisiyor: "Rapor şu an zaten üretiliyor.",
    baslatildi: "Rapor üretiliyor, ~35 saniye.",
  });
}

/** Tusun yoklamasi: ?oncekiKosuId= ile "yeni calisma basladi mi, bitti mi". */
export async function GET(istek: Request) {
  const ham = new URL(istek.url).searchParams.get("oncekiKosuId");
  const onceki = ham && /^\d+$/.test(ham) ? Number(ham) : null;
  return workflowDurumu("update-strateji.yml", onceki);
}
