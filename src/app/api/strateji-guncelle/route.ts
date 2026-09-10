/**
 * Borçlanma stratejisi fark raporunu ELLE üretir: dashboard reposundaki
 * update-strateji.yml workflow'unu tetikler (HMB'nin son iki aylık
 * strateji belgesini karşılaştırıp PDF üretir, Supabase'e yükler).
 *
 * Aynı adım günlük tam pipeline'ın (update-data.yml) içinde de var ama o
 * ~1 saat sürüyor; HMB belgeyi yayımladığı gün beklemeden almak için.
 */
import { workflowTetikle } from "@/lib/workflow-tetikle";

export async function POST() {
  return workflowTetikle("update-strateji.yml", {
    calisiyor: "Rapor şu an zaten üretiliyor.",
    baslatildi: "Rapor üretiliyor. 1-2 dakika sonra sayfayı yenile.",
  });
}
