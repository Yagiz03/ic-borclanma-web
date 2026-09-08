import { createClient } from "@/lib/supabase/server";
import { trTarihAyristir, trTarihSirala } from "@/lib/tarih";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";
import { KarsilastirIstemci, type KagitBilgi, type GetiriNoktasi } from "./karsilastir-istemci";

/** Aynı anda karşılaştırılabilecek kağıt sayısı (eski projedeki max_selections). */
const AZAMI_SECIM = 5;

export async function KarsilastirBolumu({ isinlerParam }: { isinlerParam?: string }) {
  const supabase = await createClient();

  const { data: ozetHam, error } = await supabase
    .from("isin_ozet")
    .select("isin, senet_tanimi, vade_tarihi, para_birimi, bist_son_tarih");

  if (error || !ozetHam) {
    return <p className="text-sm text-destructive">{error?.message ?? "Veri bulunamadı."}</p>;
  }

  // İtfa olmuş kağıtlar listeden düşer (eski projedeki itfa_olmamislari_filtrele).
  const bugun = new Date();
  const itfaOlmamis = ozetHam.filter((r) => {
    const v = trTarihAyristir(r.vade_tarihi);
    return v != null && v.getTime() > bugun.getTime();
  });

  const kagitlar: KagitBilgi[] = trTarihSirala(itfaOlmamis, (r) => r.vade_tarihi).map((r) => ({
    isin: r.isin,
    senetTanimi: r.senet_tanimi ?? "",
    vade: r.vade_tarihi ?? "",
    // TL kağıtlarda para_birimi NULL geliyor -- TRY kabul ediliyor (Python
    // tarafındaki "nan or 'TRY'" tuzağının notu: pd.notna ile aynı davranış).
    paraBirimi: r.para_birimi ?? "TRY",
    bistVeriVarMi: r.bist_son_tarih != null,
    bistSonTarih: r.bist_son_tarih ? String(r.bist_son_tarih).slice(0, 10) : null,
  }));

  // Varsayılan seçim, "en yakın vadeli + BIST verisi var"dan daha seçici:
  // o kural sayfayı çoğu zaman 1-8 günlük veriye sahip iki Kamu Kira
  // Sertifikasıyla açıyordu (neredeyse hiç işlem görmüyorlar) -- grafik tek
  // noktaya düşüyor, spread paneli "ortak gün yok" diyordu. Önce AKTİF
  // (son 10 gün içinde işlem görmüş) ve KIYASLANABİLİR (TL, sabit kuponlu/
  // kuponsuz) kağıtlar aranıyor, bulunamazsa kademeli olarak gevşetiliyor.
  const KIYASLANABILIR = ["Sabit Kuponlu Devlet Tahvili", "Kuponsuz Devlet Tahvili", "Hazine Bonosu"];
  const onGunOnce = new Date(bugun.getTime() - 10 * 86_400_000).toISOString().slice(0, 10);
  const aktifMi = (k: (typeof kagitlar)[number]) => k.bistSonTarih != null && k.bistSonTarih >= onGunOnce;

  const adayKumeleri = [
    kagitlar.filter((k) => aktifMi(k) && k.paraBirimi === "TRY" && KIYASLANABILIR.includes(k.senetTanimi)),
    kagitlar.filter((k) => aktifMi(k) && k.paraBirimi === "TRY"),
    kagitlar.filter((k) => aktifMi(k)),
    kagitlar.filter((k) => k.bistVeriVarMi),
  ];
  const varsayilanlar = (adayKumeleri.find((k) => k.length >= 2) ?? adayKumeleri[3])
    .slice(0, 2)
    .map((k) => k.isin);
  const gecerliIsinler = new Set(kagitlar.map((k) => k.isin));
  const secililer = (isinlerParam ? isinlerParam.split(",").filter(Boolean) : varsayilanlar)
    .filter((i) => gecerliIsinler.has(i))
    .slice(0, AZAMI_SECIM);

  // SADECE seçili kağıtların satırları çekiliyor. (Eskiden getirisi olan TÜM
  // satırlar -- 58 binden fazla -- her sayfa açılışında sayfalanarak
  // indiriliyordu; iki kağıtlık bir grafik için 58 ayrı sorgu demekti.)
  const { data: bistHam } = secililer.length
    ? await tumSatirlariGetir<{ isin: string; tarih: string; kapanis_bilesik_getiri_pct: number | null; temiz_fiyat: number | null }>(
        (from, to) =>
          supabase
            .from("bist_bap_fiyatlar")
            .select("isin, tarih, kapanis_bilesik_getiri_pct, temiz_fiyat")
            .in("isin", secililer)
            .order("isin")
            .order("tarih")
            .range(from, to),
      )
    : { data: [] };

  const seriler: GetiriNoktasi[] = (bistHam ?? []).map((r) => ({
    isin: r.isin,
    tarih: String(r.tarih).slice(0, 10),
    getiri: r.kapanis_bilesik_getiri_pct != null ? Number(r.kapanis_bilesik_getiri_pct) : null,
    temizFiyat: r.temiz_fiyat != null ? Number(r.temiz_fiyat) : null,
  }));

  return (
    <KarsilastirIstemci
      kagitlar={kagitlar}
      secililer={secililer}
      seriler={seriler}
      azamiSecim={AZAMI_SECIM}
    />
  );
}
