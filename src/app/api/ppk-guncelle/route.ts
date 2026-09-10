/**
 * PPK karar farkı raporunu ELLE üretir: dashboard reposundaki
 * ppk-karar-farki.yml workflow'unu tetikler. Workflow son iki karar
 * metnini indirip fark PDF'ini üretiyor ve "ppk-raporlari" Supabase
 * Storage kovasına yüklüyor; sayfa kovadaki en yeni dosyayı gösterdiği
 * için başka adım yok.
 *
 * Neden cron değil: PPK yılda 8 kez ve düzensiz aralıklarla toplanıyor --
 * karar günü tek tıkla tetiklemek günlük boş çalışmadan doğru.
 */
import { workflowTetikle } from "@/lib/workflow-tetikle";

export async function POST() {
  return workflowTetikle("ppk-karar-farki.yml", {
    calisiyor: "Rapor şu an zaten üretiliyor.",
    baslatildi: "Rapor üretiliyor, ~20 saniye.",
  });
}
