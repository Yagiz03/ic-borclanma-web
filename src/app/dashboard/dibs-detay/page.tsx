import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trTarihAyristir, trTarihSirala, trTarihPadle, isoTarihGoster } from "@/lib/tarih";
import { milyonTl as milyon, sayi, yuzde } from "@/lib/bicim";
import { SenetBadge } from "@/components/senet-badge";
import { IsinSecici } from "./isin-secici";
import { FiyatGrafigi } from "./fiyat-grafigi";
import { IzlemeButonu } from "./izleme-butonu";
import { OzetSerit } from "@/components/ozet-serit";
import { KarsilastirBolumu } from "@/app/dashboard/karsilastir/karsilastir-bolumu";
import { DuzenliIslemGorenBolumu } from "./duzenli-islem-goren";
import { KaynakSatiri } from "@/components/kaynak-satiri";
import { KolonBasligi } from "@/components/kolon-basligi";
import { BosDurum } from "@/components/bos-durum";
import { IhaleSeyriGrafigi } from "./ihale-seyri-grafigi";



export default async function DibsDetayPage({
  searchParams,
}: {
  searchParams: Promise<{ isin?: string; isinler?: string; tab?: string; bos?: string }>;
}) {
  const { isin: secilenParam, isinler: isinlerParam, tab, bos } = await searchParams;
  const bosKagitlariGoster = bos === "1";
  const supabase = await createClient();

  const { data: ozetHam, error: ozetHata } = await supabase
    .from("isin_ozet")
    .select("*");

  if (ozetHata || !ozetHam || ozetHam.length === 0) {
    return (
      <div className="w-full">
        <h1 className="text-2xl font-semibold">DİBS Detay</h1>
        <p className="mt-4 text-sm text-destructive">
          {ozetHata?.message ?? "Kağıt listesi yüklenemedi."}
        </p>
      </div>
    );
  }

  // İkincil piyasada HİÇ işlem görmemiş Kamu Kira Sertifikaları varsayılan
  // olarak listede yok: seçilince İhale geçmişi, BIST fiyatı ve TCMB verisinin
  // hiçbiri olmadığından sayfa neredeyse bomboş kalıyor. İsteyen kutucukla
  // açabiliyor (eski projedeki aynı davranış).
  const veriYokMu = (r: (typeof ozetHam)[number]) =>
    (r.senet_tanimi ?? "").includes("Kira Sertifikas") && r.bist_son_tarih == null;

  // İtfa olmuş (vadesi geçmiş) kağıtlar listede yok -- artık işlem görmüyorlar,
  // seçilebilir olmaları listeyi gereksiz uzatıyordu.
  const bugunMs = new Date().getTime();
  const itfaOlmusMu = (r: (typeof ozetHam)[number]) => {
    const v = trTarihAyristir(r.vade_tarihi);
    return v != null && v.getTime() <= bugunMs;
  };

  const aktifler = ozetHam.filter((r) => !itfaOlmusMu(r));
  const bosKagitSayisi = aktifler.filter(veriYokMu).length;
  const listelenenler = bosKagitlariGoster ? aktifler : aktifler.filter((r) => !veriYokMu(r));

  const siraliOzet = trTarihSirala(listelenenler, (r) => r.vade_tarihi);

  // Varsayılan kağıt: en yakın vadeli olan çoğu zaman hiç işlem görmemiş bir
  // Kamu Kira Sertifikası oluyordu -- sayfa iki boş grafik ve "ihale kaydı
  // bulunamadı" ile açılıyordu. Bunun yerine AKTİF ve KIYASLANABİLİR bir
  // benchmark kağıt seçiliyor: son 10 günde işlem görmüş, TL, sabit
  // kuponlu/kuponsuz olanların en yakın vadelisi. Bulunamazsa kademeli gevşer.
  const onGunOnce = new Date(bugunMs - 10 * 86_400_000).toISOString().slice(0, 10);
  const aktifMi = (r: (typeof siraliOzet)[number]) =>
    r.bist_son_tarih != null && String(r.bist_son_tarih).slice(0, 10) >= onGunOnce;
  const KIYASLANABILIR = ["Sabit Kuponlu Devlet Tahvili", "Kuponsuz Devlet Tahvili", "Hazine Bonosu"];
  const varsayilan =
    siraliOzet.find((r) => aktifMi(r) && KIYASLANABILIR.includes(r.senet_tanimi ?? "")) ??
    siraliOzet.find((r) => aktifMi(r)) ??
    siraliOzet.find((r) => r.bist_son_tarih != null) ??
    siraliOzet[0];
  // URL'de gizlenmiş bir kağıt istenmişse (ör. aramadan gelen bağlantı) yine
  // de gösteriliyor -- filtre listeyi kısaltmak için, erişimi kapatmak için değil.
  const secilen = ozetHam.find((r) => r.isin === secilenParam) ?? varsayilan ?? ozetHam[0];

  const [
    { data: ihaleler },
    { data: bistFiyatlar },
    { data: duyurular },
    { data: tcmbAlimlar },
    { data: eskiHtml },
    { data: eskiOcr },
    { data: hazineOcr },
  ] = await Promise.all([
    supabase.from("ihale_sonuclari").select("*").eq("isin", secilen.isin),
    supabase
      .from("bist_bap_fiyatlar")
      .select("tarih, temiz_fiyat, kapanis_bilesik_getiri_pct, islem_hacmi_tl")
      .eq("isin", secilen.isin)
      .order("tarih", { ascending: true }),
    // HMB'nin ihale ÖNCESİ duyurusu -- resmi kupon oranı/ek getiri burada
    // ilan edilir, ihale sonrası sonuç duyurusundan farklı bir belgedir.
    supabase
      .from("ihale_duyurulari")
      .select("ihale_tarihi, valor_tarihi, itfa_tarihi, vade_aciklama, ihrac_tipi, resmi_kupon_orani_pct, ek_getiri_bp, kaynak_url")
      .eq("isin", secilen.isin),
    supabase
      .from("tcmb_dogrudan_alim")
      .select("ihale_tarihi, kazanan_tutar_nominal_bin_tl")
      .eq("isin", secilen.isin),
    // ESKİ İHALE ARŞİVLERİ: ihale_sonuclari yalnızca HMB'nin makine
    // okunabilir duyurularını kapsıyor (2019 sonrası). Daha eski ihraçlar
    // (ör. TRT181023T19'un 1. ve 2. ihracı) sadece bu HTML/OCR arşivlerinde
    // var -- oran/tutar kolonları yok ama ihale TARİHİ ve kaynak duyurusu var.
    supabase
      .from("hmb_ihale_sonuclari_eski_html")
      .select("ihale_tarihi, ihrac_tipi, ort_yillik_bilesik_gerceklesme, toplam_gerceklesme_mn, kaynak_url")
      .eq("isin", secilen.isin),
    supabase
      .from("hmb_ihale_sonuclari_eski_ocr")
      .select("ihale_tarihi, kaynak_url")
      .eq("isin", secilen.isin),
    supabase.from("hazine_ihale_eski_ocr").select("ihale_tarihi").eq("isin", secilen.isin),
  ]);

  const { data: izlemeSatiri } = await supabase
    .from("watchlist")
    .select("id")
    .eq("isin", secilen.isin)
    .maybeSingle();

  // İhale geçmişi = ana tablo + eski arşivler. Aynı ihale tarihi birden çok
  // kaynakta olabiliyor; ana tablo (tam detaylı) önceliklidir.
  type Sayi = number | string | null | undefined;
  type IhaleSatiri = {
    ihale_tarihi: string;
    ihrac_tipi?: string | null;
    toplam_teklif_mn?: Sayi;
    toplam_gerceklesme_mn?: Sayi;
    ihrac_sonrasi_stok_mn?: Sayi;
    ort_yillik_bilesik_gerceklesme?: Sayi;
    en_dusuk_bilesik_gerceklesme?: Sayi;
    en_yuksek_bilesik_gerceklesme?: Sayi;
    ort_fiyat_gerceklesme?: Sayi;
    toplam_oran_pct?: Sayi;
    tail_bps?: Sayi;
    rot_pay_toplam_pct?: Sayi;
    top3_katilimci_pay_pct?: Sayi;
    top5_katilimci_pay_pct?: Sayi;
    kaynak_url?: string | null;
    /** Satır eski HTML/OCR arşivinden geldi -- detay kolonları yok. */
    arsivMi?: boolean;
  };
  const ihaleHarita = new Map<string, IhaleSatiri>();
  for (const r of ihaleler ?? []) {
    ihaleHarita.set(trTarihPadle(r.ihale_tarihi) ?? r.ihale_tarihi, r as unknown as IhaleSatiri);
  }
  const arsivEkle = (satirlar: Record<string, unknown>[] | null) => {
    for (const r of satirlar ?? []) {
      const anahtar = trTarihPadle(r.ihale_tarihi as string) ?? (r.ihale_tarihi as string);
      if (!anahtar || ihaleHarita.has(anahtar)) continue;
      ihaleHarita.set(anahtar, { ...r, ihale_tarihi: anahtar, arsivMi: true } as unknown as IhaleSatiri);
    }
  };
  arsivEkle(eskiHtml);
  arsivEkle(eskiOcr);
  arsivEkle(hazineOcr);

  const siraliIhale = trTarihSirala([...ihaleHarita.values()], (r) => r.ihale_tarihi);
  const arsivSayisi = siraliIhale.filter((r) => r.arsivMi).length;
  const siraliDuyuru = duyurular ? trTarihSirala(duyurular, (r) => r.ihale_tarihi) : [];

  // İhale geçmişinin iki grafiği: gerçekleşen faizin seyri ve yeniden
  // ihraçlarla büyüyen toplam stok.
  const ihaleSeyri = siraliIhale
    .filter((h) => h.ort_yillik_bilesik_gerceklesme != null)
    .map((h) => ({
      tarih: h.ihale_tarihi as string,
      faiz: Number(h.ort_yillik_bilesik_gerceklesme),
      stokMlr: h.ihrac_sonrasi_stok_mn != null ? Number(h.ihrac_sonrasi_stok_mn) / 1000 : null,
    }));

  // TCMB doğrudan alımları: tarihe göre artan sırada kümülatif toplam
  // çıkarılıp tabloda tersten (en yeni üstte) gösteriliyor.
  const alimlarArtan = tcmbAlimlar ? trTarihSirala(tcmbAlimlar, (r) => r.ihale_tarihi) : [];
  const tcmbAlimSatirlari = alimlarArtan.reduce<{ tarih: string; tutar: number; kumulatif: number }[]>(
    (birikim, r) => {
      const tutar = r.kazanan_tutar_nominal_bin_tl != null ? Number(r.kazanan_tutar_nominal_bin_tl) : 0;
      const oncekiKumulatif = birikim.length ? birikim[birikim.length - 1].kumulatif : 0;
      return [...birikim, { tarih: r.ihale_tarihi as string, tutar, kumulatif: oncekiKumulatif + tutar }];
    },
    [],
  );
  const tcmbToplamAlim = tcmbAlimSatirlari.length
    ? tcmbAlimSatirlari[tcmbAlimSatirlari.length - 1].kumulatif
    : 0;
  const sonBist = bistFiyatlar && bistFiyatlar.length > 0 ? bistFiyatlar[bistFiyatlar.length - 1] : null;

  const alanlar: { etiket: string; deger: string; yardim?: string }[] = [
    { etiket: "İlk ihraç", deger: isoTarihGoster(secilen.ilk_ihrac_tarihi) },
    { etiket: "Vade", deger: secilen.vade_tarihi ?? "–" },
  ];
  if (secilen.ihrac_sayisi) alanlar.push({ etiket: "İhraç sayısı", deger: String(secilen.ihrac_sayisi) });
  if (secilen.son_ihrac_faizi != null) {
    alanlar.push({
      etiket: "Son gerçekleşen faiz (Bileşik)",
      deger: yuzde(secilen.son_ihrac_faizi),
      yardim: "HMB'nin ihale sonucu duyurusundaki 'Ortalama Yıllık Bileşik' alanı.",
    });
  }
  const floaterMi =
    secilen.senet_tanimi === "TLREF'e Endeksli Devlet Tahvili" ||
    secilen.senet_tanimi === "Değişken Faizli Devlet Tahvili";
  if (secilen.tahmini_kupon_orani != null) {
    alanlar.push({
      etiket: floaterMi ? "İlk ihraç faizi (kupon DEĞİL)" : "Kupon oranı",
      deger: yuzde(secilen.tahmini_kupon_orani),
      yardim: floaterMi
        ? "Bu kağıdın sabit bir kupon oranı yok — gösterilen, ilk ihracın gerçekleşen getirisi."
        : undefined,
    });
  }
  // Bazı Kamu Kira Sertifikalarında BIST referans verisinde ihraç tutarı
  // eksik/sıfır geliyor; o durumda stok/TCMB/serbest dolaşım rakamlarının hepsi
  // anlamsız "0" çıkar. Gerçek veri yoksa satırı hiç göstermemek yanıltıcı "0"
  // yazmaktan daha doğru (pages/isin_detay.py ile aynı kural).
  if (secilen.son_ihrac_sonrasi_stok_mn && Number(secilen.son_ihrac_sonrasi_stok_mn) > 0) {
    const binToMilyon = (v: unknown) =>
      v == null ? null : Number(v) / 1000;
    const tcmbMn = binToMilyon(secilen.tcmb_toplam_alim_bin_tl);
    const serbestMn = binToMilyon(secilen.serbest_dolasim_bin_tl);

    alanlar.push({ etiket: "Toplam ihraç stoku", deger: milyon(secilen.son_ihrac_sonrasi_stok_mn) });
    alanlar.push({
      etiket: "TCMB'nin geri aldığı",
      deger: tcmbMn != null ? `${tcmbMn.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Milyon` : "0",
    });
    alanlar.push({
      etiket: "Serbest dolaşım (tahmini)",
      deger: serbestMn != null ? `${serbestMn.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Milyon` : "–",
    });
    alanlar.push({
      etiket: "TCMB payı",
      deger: secilen.tcmb_pay_pct != null ? yuzde(secilen.tcmb_pay_pct, 1) : "%0",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">DİBS Detay</h1>
      </div>

      <Tabs
        defaultValue={
          tab === "karsilastir" ? "karsilastir" : tab === "duzenli" ? "duzenli" : "detay"
        }
      >
        <TabsList variant="line" className="mb-5 overflow-x-auto">
          <TabsTrigger value="detay" className="shrink-0">DİBS Detay</TabsTrigger>
          <TabsTrigger value="duzenli" className="shrink-0">Düzenli İşlem Gören</TabsTrigger>
          <TabsTrigger value="karsilastir" className="shrink-0">Karşılaştır</TabsTrigger>
        </TabsList>

        <TabsContent value="detay" className="space-y-6">
      <IsinSecici
        bosKagitlariGoster={bosKagitlariGoster}
        bosKagitSayisi={bosKagitSayisi}
        secili={secilen.isin}
        secenekler={siraliOzet.map((r) => ({ isin: r.isin, etiket: `${r.isin} — ${r.senet_tanimi ?? ""}` }))}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{secilen.isin}</h2>
          <SenetBadge tanim={secilen.senet_tanimi} />
        </div>
        <IzlemeButonu isin={secilen.isin} baslangicIzlemede={!!izlemeSatiri} />
      </div>

      <OzetSerit alanlar={alanlar} />

      {sonBist && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>BIST ikincil piyasa fiyatı (Kesin Alım Satım Pazarı)</CardTitle>
            </CardHeader>
            <CardContent>
              <OzetSerit
                alanlar={[
                  { etiket: "Son temiz fiyat", deger: Number(sonBist.temiz_fiyat).toFixed(3) },
                  { etiket: "Son bileşik getiri", deger: yuzde(sonBist.kapanis_bilesik_getiri_pct) },
                  { etiket: "Tarih", deger: isoTarihGoster(sonBist.tarih) },
                  {
                    etiket: "O günkü işlem hacmi",
                    deger:
                      sonBist.islem_hacmi_tl != null
                        ? `${Number(sonBist.islem_hacmi_tl).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`
                        : "–",
                  },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Temiz fiyatın zaman içindeki seyri (kapanış)</CardTitle>
            </CardHeader>
            <CardContent>
              <FiyatGrafigi
                birim=""
                veri={(bistFiyatlar ?? [])
                  .filter((r) => r.temiz_fiyat != null)
                  .map((r) => ({ tarih: r.tarih, deger: Number(r.temiz_fiyat) }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>İkincil piyasa bileşik getirisinin zaman içindeki seyri</CardTitle>
            </CardHeader>
            <CardContent>
              <FiyatGrafigi
                birim="%"
                renk="var(--chart-2)"
                ondalik={2}
                veri={(bistFiyatlar ?? [])
                  .filter((r) => r.kapanis_bilesik_getiri_pct != null)
                  .map((r) => ({ tarih: r.tarih, deger: Number(r.kapanis_bilesik_getiri_pct) }))}
              />
            </CardContent>
          </Card>
        </>
      )}

      {siraliDuyuru.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gerçekleştirilecek İhalelere İlişkin Basın Duyurusu</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              HMB&apos;nin ihale ÖNCESİ (genelde bir gün önce) yayımladığı duyuru — resmi kupon oranı
              ve ek getiri burada ilan edilir. İhale sonrası sonuç duyurusundan (aşağıdaki
              &quot;İhale geçmişi&quot; tablosu) farklı bir belgedir. Tarihe tıklayınca kaynak
              duyuru (PDF) yeni sekmede açılır.
            </p>
            <div className="max-h-[300px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>İhale Tarihi</TableHead>
                    <TableHead>Valör</TableHead>
                    <TableHead>İtfa Tarihi</TableHead>
                    <TableHead>Vade</TableHead>
                    <TableHead>İhraç Tipi</TableHead>
                    <TableHead className="text-right">Resmi Kupon Oranı</TableHead>
                    <TableHead className="text-right">Ek Getiri (bp)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siraliDuyuru.map((d, i) => (
                    <KaynakSatiri key={i} url={d.kaynak_url} ilkHucre={d.ihale_tarihi}>
                      <TableCell className="font-figures whitespace-nowrap">{isoTarihGoster(d.valor_tarihi)}</TableCell>
                      <TableCell className="font-figures whitespace-nowrap">{isoTarihGoster(d.itfa_tarihi)}</TableCell>
                      <TableCell>{d.vade_aciklama ?? "–"}</TableCell>
                      <TableCell>{d.ihrac_tipi ?? "–"}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(d.resmi_kupon_orani_pct)}</TableCell>
                      <TableCell className="font-figures text-right">
                        {d.ek_getiri_bp == null ? "–" : Number(d.ek_getiri_bp).toFixed(0)}
                      </TableCell>
                    </KaynakSatiri>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>İhale geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            HMB&apos;nin ihale SONRASI yayımladığı &quot;Gerçekleştirilen İhalelere Ait Basın
            Duyurusu&quot; verileri — bu kağıdın <b>tüm</b> ihaleleri. Tarihe tıklayınca kaynak
            duyuru (PDF) yeni sekmede açılır.
            {arsivSayisi > 0 && (
              <>
                {" "}
                <b className="text-foreground">arşiv</b> etiketli {arsivSayisi} satır, HMB&apos;nin
                makine okunabilir duyuru arşivinden ÖNCEKİ (genelde 2019 öncesi) ihraçlar — bu eski
                duyurularda oran/tutar dökümü yok, sadece ihale tarihi ve kaynak belgesi var.
              </>
            )}
          </p>
          {siraliIhale.length === 0 ? (
            <BosDurum baslik="Bu ISIN için ihale kaydı bulunamadı." aciklama="HMB duyuru arşivinde bu kağıda ait bir ihale sonucu yok." />
          ) : (
            <div className="max-h-[420px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    {/* Metin sütunu artan genişliği emiyor -- yoksa boşluk sayı
                        sütunlarına dağılıp ihraç tipini sıkıştırıyordu. */}
                    <TableHead className="w-full min-w-[10rem]">İhraç Tipi</TableHead>
                    <TableHead className="text-right">
                      <KolonBasligi ust="Toplam Teklif" alt="Mn TL" />
                    </TableHead>
                    <TableHead className="text-right">
                      <KolonBasligi ust="Gerçekleşme" alt="Mn TL" />
                    </TableHead>
                    <TableHead className="text-right">
                      <KolonBasligi ust="İhraç Sonrası Stok" alt="Mn TL" />
                    </TableHead>
                    <TableHead className="text-right">
                      <KolonBasligi ust="Ort. Faiz" alt="Bileşik" />
                    </TableHead>
                    <TableHead className="text-right">
                      <KolonBasligi ust="En Düşük" alt="Faiz" />
                    </TableHead>
                    <TableHead className="text-right">
                      <KolonBasligi ust="En Yüksek" alt="Faiz" />
                    </TableHead>
                    <TableHead className="text-right">
                      <KolonBasligi ust="Ort. Fiyat" />
                    </TableHead>
                    <TableHead className="text-right">
                      <KolonBasligi ust="Talep" alt="Karşılama" />
                    </TableHead>
                    <TableHead className="text-right">
                      <KolonBasligi ust="Tail" alt="bps" />
                    </TableHead>
                    <TableHead className="text-right">
                      <KolonBasligi ust="ROT" alt="Payı" />
                    </TableHead>
                    <TableHead className="text-right">
                      <KolonBasligi ust="İlk 3" alt="Katılımcı" />
                    </TableHead>
                    <TableHead className="text-right">
                      <KolonBasligi ust="İlk 5" alt="Katılımcı" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siraliIhale.map((h, i) => (
                    <KaynakSatiri key={i} url={h.kaynak_url} ilkHucre={h.ihale_tarihi}>
                      <TableCell className="whitespace-nowrap">
                        {h.arsivMi ? (
                          <span
                            className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                            title="Eski HMB arşivinden (HTML/OCR) — bu duyurularda oran/tutar dökümü yok, sadece ihale tarihi ve kaynak belgesi var."
                          >
                            {h.ihrac_tipi ?? "arşiv kaydı"}
                          </span>
                        ) : (
                          (h.ihrac_tipi ?? "–")
                        )}
                      </TableCell>
                      <TableCell className="font-figures text-right">{sayi(h.toplam_teklif_mn, 1)}</TableCell>
                      <TableCell className="font-figures text-right">{sayi(h.toplam_gerceklesme_mn, 1)}</TableCell>
                      <TableCell className="font-figures text-right">{sayi(h.ihrac_sonrasi_stok_mn, 1)}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(h.ort_yillik_bilesik_gerceklesme)}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(h.en_dusuk_bilesik_gerceklesme)}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(h.en_yuksek_bilesik_gerceklesme)}</TableCell>
                      <TableCell className="font-figures text-right">{sayi(h.ort_fiyat_gerceklesme, 3)}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(h.toplam_oran_pct, 0)}</TableCell>
                      <TableCell className="font-figures text-right">{sayi(h.tail_bps, 1)}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(h.rot_pay_toplam_pct, 1)}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(h.top3_katilimci_pay_pct, 1)}</TableCell>
                      <TableCell className="font-figures text-right">{yuzde(h.top5_katilimci_pay_pct, 1)}</TableCell>
                    </KaynakSatiri>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {ihaleSeyri.length > 1 && (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold">Gerçekleşen faizin zaman içindeki seyri</h3>
                <IhaleSeyriGrafigi
                  veri={ihaleSeyri}
                  dataKey="faiz"
                  birim="%"
                  ondalik={2}
                  renk="var(--chart-1)"
                />
              </div>
              <div className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold">
                  Toplam ihraç stoku (yeniden ihraçlarla büyüme)
                </h3>
                <IhaleSeyriGrafigi
                  veri={ihaleSeyri.filter((r) => r.stokMlr != null)}
                  dataKey="stokMlr"
                  birim=" mlr TL"
                  ondalik={1}
                  renk="var(--chart-2)"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TCMB doğrudan alım geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          {tcmbAlimSatirlari.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              TCMB bu ISIN&apos;i doğrudan alım yoluyla satın almamış (kayıtlarımızda yok).
            </p>
          ) : (
            <div className="space-y-4">
              <OzetSerit
                alanlar={[
                  {
                    etiket: "Toplam alım",
                    deger: `${tcmbToplamAlim.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} Bin TL`,
                  },
                  { etiket: "Doğrudan alım ihalesi", deger: String(tcmbAlimSatirlari.length) },
                ]}
              />
              <div className="max-h-[300px] overflow-y-auto overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead className="text-right">Alınan tutar (Bin TL)</TableHead>
                      <TableHead className="text-right">Kümülatif (Bin TL)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...tcmbAlimSatirlari].reverse().map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-figures whitespace-nowrap">{isoTarihGoster(r.tarih)}</TableCell>
                        <TableCell className="font-figures text-right">
                          {r.tutar.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell className="font-figures text-right">
                          {r.kumulatif.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="duzenli">
          <DuzenliIslemGorenBolumu />
        </TabsContent>

        <TabsContent value="karsilastir">
          <KarsilastirBolumu isinlerParam={isinlerParam} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
