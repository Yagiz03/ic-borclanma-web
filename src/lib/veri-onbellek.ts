import { unstable_cache } from "next/cache";

/**
 * Herkese açık verilerin sunucu tarafı önbelleği.
 *
 * Veri gece pipeline'ıyla (ve gün içinde ÖST butonuyla) güncelleniyor; iki
 * güncelleme arasında aynı sorgu her ziyaretçi için tekrar tekrar Supabase'e
 * gidiyordu. Bu, sayfa başına 0.5-0.75 saniyelik TTFB'nin büyük kısmıydı.
 *
 * ÖNBELLEK VERİYİ DEĞİŞTİRMEZ: yalnızca aynı sonucu bir süre yeniden
 * hesaplamadan sunar. En kötü durumda kullanıcı `saniye` kadar eski bir kopya
 * görür. Veri tazelendiğinde `VERI_ETIKETI` ile anında geçersiz kılınabilir
 * (bkz. /api/ost-guncelle).
 */
export const VERI_ETIKETI = "kamuya-acik-veri";

/** Varsayılan tazelik penceresi. Veri günde birkaç kez değiştiğinden
 *  10 dakika hem hızlı hem güvenli. */
const VARSAYILAN_SANIYE = 600;

export function onbellekle<T>(
  anahtar: string[],
  fn: () => Promise<T>,
  saniye: number = VARSAYILAN_SANIYE,
): () => Promise<T> {
  return unstable_cache(fn, anahtar, { revalidate: saniye, tags: [VERI_ETIKETI] });
}
