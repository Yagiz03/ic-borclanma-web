/**
 * Supabase/PostgREST tek sorguda 1000 satırdan fazlasını döndürmüyor
 * (.limit() ile de aşılamıyor -- proje ayarı). 1000+ satırlı tabloları
 * (tcmb_ihale_istatistikleri, tcmb_dibs_tip_wayback, tcmb_dogrudan_alim
 * vb.) tek `.select()` ile okumak sessizce eksik veri döndürür. Bu
 * yardımcı `.range()` ile sayfalayıp tüm satırları toplar.
 */
const SAYFA_BOYUTU = 1000;

export async function tumSatirlariGetir<T>(
  sorguOlustur: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: string | null }> {
  const tum: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sorguOlustur(from, from + SAYFA_BOYUTU - 1);
    if (error) return { data: tum, error: error.message };
    if (!data || data.length === 0) break;
    tum.push(...data);
    if (data.length < SAYFA_BOYUTU) break;
    from += SAYFA_BOYUTU;
  }
  return { data: tum, error: null };
}
