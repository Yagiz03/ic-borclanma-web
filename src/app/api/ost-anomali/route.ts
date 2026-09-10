/**
 * Panele girişte çıkan ÖST anomali uyarısının verisi.
 *
 * Neden ayrı bir uç: bu hesap bist_ost_fiyatlar + menkul_kiymet_bilgileri
 * istiyor. Panel düzeninde (layout) sunucuda çekilseydi HER sayfa açılışına
 * bu maliyet binerdi; pencere ise oturumda bir kez çıkıyor. Bu yüzden
 * pencere kendisi bağlandıktan sonra buradan çekiyor.
 */
import { createPublicClient } from "@/lib/supabase/public";
import { onbellekle } from "@/lib/veri-onbellek";
import { MAX_KARSILASTIRMA_GUN, ostAnomaliMesaji, ostAnomalileriBul } from "@/lib/ost-anomali";

/** Son işlem günü + kendisiyle karşılaştırılacak geçmiş pencere. */
const GUN_PENCERESI = MAX_KARSILASTIRMA_GUN + 5;

const anomalileriGetir = onbellekle(["ost-anomali"], async () => {
  const supabase = createPublicClient();
  const esik = new Date(Date.now() - GUN_PENCERESI * 86_400_000).toISOString().slice(0, 10);

  const [{ data: bist }, { data: mkb }] = await Promise.all([
    supabase
      .from("bist_ost_fiyatlar")
      .select("tarih, isin, temiz_fiyat, kapanis_bilesik_getiri_pct")
      .gte("tarih", esik),
    supabase
      .from("menkul_kiymet_bilgileri")
      .select("isin, ihracci_kurum, itfa_tarihi, kupon_sikligi, ilk_ihrac_tarihi")
      .eq("ozel_sektor_mu", true),
  ]);

  const satirlar = bist ?? [];
  if (satirlar.length === 0) return { tarih: null, mesajlar: [] as string[] };

  const sonTarih = satirlar.reduce((en, r) => (r.tarih > en ? r.tarih : en), satirlar[0].tarih);
  const anomaliler = ostAnomalileriBul(satirlar, mkb ?? [], sonTarih)
    // Kupon/kira resetiyle açıklanabilenler pencereyi AÇMIYOR -- beklenen
    // bir olay, alarma değmez (eski projedeki kural aynen).
    .filter((a) => !a.kuponResetiyleAciklanabilir);

  return { tarih: sonTarih, mesajlar: anomaliler.map(ostAnomaliMesaji) };
}, 900);

export async function GET() {
  return Response.json(await anomalileriGetir());
}
