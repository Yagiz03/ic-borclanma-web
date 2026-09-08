import { BosDurum } from "@/components/bos-durum";
import { createClient } from "@/lib/supabase/server";
import { tumSatirlariGetir } from "@/lib/supabase-sayfali";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CokluCizgiGrafigi, YiginliAlanGrafigi } from "./coklu-cizgi-grafigi";
import { TcmbApiPortfoyuBolumu } from "./tcmb-api-portfoyu";
import { KagitTipiDagilimiBolumu } from "./kagit-tipi-dagilimi";
import { TufeM2KfeBonoBolumu } from "./tufe-m2-kfe-bono";
import { DisDengeBolumu } from "./dis-denge";
import { NetRezervBolumu } from "./net-rezerv";
import { PiyasaBeklentileriBolumu } from "./piyasa-beklentileri";

function pivotla(rows: { seri_adi: string; tarih: string; deger: number | null }[]): Record<string, string | number>[] {
  const gunler = new Map<string, Record<string, string | number>>();
  for (const r of rows) {
    if (r.deger == null) continue;
    const satir = gunler.get(r.tarih) ?? { tarih: r.tarih };
    satir[r.seri_adi] = r.deger;
    gunler.set(r.tarih, satir);
  }
  return Array.from(gunler.values()).sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
}

function pct1(v: number | null | undefined): string {
  return v == null ? "–" : `%${v.toFixed(1)}`;
}

// Geçerli sekme değerleri: global arama sonucundan ?tab= ile doğrudan ilgili
// sekmeye gelinebilsin diye. Önce her sonuç sayfanın ilk sekmesini açıyordu,
// kullanıcı aradığı bölümü kendisi bulmak zorunda kalıyordu.
const SEKMELER = [
  "dibs", "apiportfoyu", "tufem2kfebono", "koridor", "tlref",
  "disdenge", "rezerv", "beklenti", "ppkfarki", "enflasyonraporu",
] as const;

export default async function TcmbPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const gecerliTab = SEKMELER.includes(tab as (typeof SEKMELER)[number]) ? tab! : "dibs";
  const supabase = await createClient();

  const dibsSeriler = [
    "dibs_piy_deg_bankalar",
    "dibs_piy_deg_tcmb",
    "dibs_piy_deg_emeklilik_fonlari",
    "dibs_piy_deg_yatirim_fonlari",
    "dibs_piy_deg_dunya_geri_kalani",
  ];

  // Supabase/PostgREST tek sorguda en fazla 1000 satır döndürüyor. Seriler bu
  // sınırı aşıyor (tlref_kapanis 1659, repo_gecelik_bist 1680) ve düz .select()
  // ile EN YENİ ~2,5 yıl sessizce kayboluyordu: grafikler Ocak 2024'te bitiyor
  // ama hata da vermiyordu. Sayfalı okuma (tumSatirlariGetir) ile tamamı
  // çekiliyor -- 1000+ satırlı diğer tablolarda zaten kullanılan yöntem.
  const evdsSeri = (seri: string) =>
    tumSatirlariGetir<{ seri_adi: string; tarih: string; deger: number | null }>((from, to) =>
      supabase.from("evds_seriler").select("*").eq("seri_adi", seri).order("tarih").range(from, to),
    );

  const [
    dibsSonuclari, tlrefRes, repoRes,
    koridorRes, politikaRes, enflasyonRaporuRes,
  ] = await Promise.all([
    Promise.all(dibsSeriler.map(evdsSeri)),
    evdsSeri("tlref_kapanis"),
    evdsSeri("repo_gecelik_bist"),
    supabase.from("tcmb_faiz_koridoru").select("tarih, borc_alma, borc_verme").order("tarih"),
    supabase.from("tcmb_politika_faizi").select("tarih, politika_faizi").order("tarih"),
    supabase.from("tcmb_enflasyon_raporu").select("*").limit(1).maybeSingle(),
  ]);

  // tumSatirlariGetir hatayı düz string olarak döndürüyor (Supabase'in kendi
  // sorgusundaki gibi { message } nesnesi değil).
  const ilkHata = [...dibsSonuclari, tlrefRes, repoRes].find((r) => r.error)?.error;
  if (ilkHata) {
    return (
      <div className="w-full">
        <h1 className="text-2xl font-semibold">TCMB</h1>
        <p className="mt-4 text-sm text-destructive">{ilkHata}</p>
      </div>
    );
  }

  const dibsVeri = pivotla(dibsSonuclari.flatMap((r) => r.data ?? []));
  const tlrefVeri = pivotla(tlrefRes.data ?? []);

  const koridorVeri = (koridorRes.data ?? []).map((r) => ({ tarih: r.tarih, "Alt bant": Number(r.borc_alma), "Üst bant": Number(r.borc_verme) }));
  const politikaVeri = (politikaRes.data ?? []).map((r) => ({ tarih: r.tarih, "Politika faizi": Number(r.politika_faizi) }));
  // koridor + politika + BIST gecelik repo'yu tek zaman ekseninde birleştir
  const koridorBirlesik = pivotla([
    ...(koridorRes.data ?? []).flatMap((r) => [
      { seri_adi: "Alt bant", tarih: r.tarih, deger: r.borc_alma != null ? Number(r.borc_alma) : null },
      { seri_adi: "Üst bant", tarih: r.tarih, deger: r.borc_verme != null ? Number(r.borc_verme) : null },
    ]),
    ...(politikaRes.data ?? []).map((r) => ({ seri_adi: "Politika faizi", tarih: r.tarih, deger: r.politika_faizi != null ? Number(r.politika_faizi) : null })),
    ...(repoRes.data ?? []).map((r) => ({ seri_adi: "BIST gecelik repo", tarih: r.tarih, deger: r.deger })),
  ]);

  const sonKoridor = koridorVeri[koridorVeri.length - 1];
  const sonPolitika = politikaVeri[politikaVeri.length - 1];

  const enflasyonRaporu = enflasyonRaporuRes.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">TCMB</h1>
        <p className="text-sm text-muted-foreground">
          EVDS üzerinden DİBS piyasa değeri, TLREF, döviz kuru, rezerv ve enflasyon göstergeleri.
        </p>
      </div>

      <Tabs defaultValue={gecerliTab}>
        <TabsList variant="line" className="mb-5 overflow-x-auto">
          <TabsTrigger value="dibs" className="shrink-0">DİBS Piyasa Değeri</TabsTrigger>
          <TabsTrigger value="apiportfoyu" className="shrink-0">TCMB APİ Portföyü</TabsTrigger>
          <TabsTrigger value="tufem2kfebono" className="shrink-0">TÜFE, M2, KFE ve Bono</TabsTrigger>
          <TabsTrigger value="koridor" className="shrink-0">Repo Faiz Koridoru</TabsTrigger>
          <TabsTrigger value="tlref" className="shrink-0">TLREF</TabsTrigger>
          <TabsTrigger value="disdenge" className="shrink-0">Dış Denge</TabsTrigger>
          <TabsTrigger value="rezerv" className="shrink-0">Net Rezerv</TabsTrigger>
          <TabsTrigger value="beklenti" className="shrink-0">Piyasa Beklentileri</TabsTrigger>
          <TabsTrigger value="ppkfarki" className="shrink-0">PPK Karar Farkı</TabsTrigger>
          <TabsTrigger value="enflasyonraporu" className="shrink-0">Enflasyon Raporu</TabsTrigger>
        </TabsList>

        <TabsContent value="dibs" className="space-y-8">
          <KagitTipiDagilimiBolumu />

          <div>
          <p className="mb-3 text-sm text-muted-foreground">
            DİBS&apos;lerin sahiplik kesimine (sektöre) göre piyasa değeri dağılımı (Milyon TL, haftalık).
          </p>
          <YiginliAlanGrafigi
            veri={dibsVeri}
            seriler={[
              { anahtar: "dibs_piy_deg_bankalar", etiket: "Bankalar" },
              { anahtar: "dibs_piy_deg_tcmb", etiket: "TCMB" },
              { anahtar: "dibs_piy_deg_emeklilik_fonlari", etiket: "Emeklilik Fonları" },
              { anahtar: "dibs_piy_deg_yatirim_fonlari", etiket: "Yatırım Fonları" },
              { anahtar: "dibs_piy_deg_dunya_geri_kalani", etiket: "Dünyanın Geri Kalanı" },
            ]}
          />
          </div>
        </TabsContent>

        <TabsContent value="apiportfoyu">
          <TcmbApiPortfoyuBolumu />
        </TabsContent>

        <TabsContent value="tufem2kfebono">
          <TufeM2KfeBonoBolumu />
        </TabsContent>

        <TabsContent value="koridor">
          <p className="mb-3 text-sm text-muted-foreground">
            TCMB&apos;nin ilan ettiği &quot;faiz koridoru&quot; — gecelik borç alma (alt bant) ve borç verme (üst
            bant) faizleri ile 1 hafta vadeli repo (politika faizi); BIST gecelik repo piyasada fiilen oluşan
            oranı gösteriyor.
          </p>
          {koridorVeri.length === 0 ? (
            <p className="text-sm text-muted-foreground">Veri yok.</p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Üst bant (gecelik borç verme)</p>
                  <p className="font-figures font-semibold">{pct1(sonKoridor?.["Üst bant"] as number)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Politika faizi (1 hafta repo)</p>
                  <p className="font-figures font-semibold">{pct1(sonPolitika?.["Politika faizi"] as number)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Alt bant (gecelik borç alma)</p>
                  <p className="font-figures font-semibold">{pct1(sonKoridor?.["Alt bant"] as number)}</p>
                </div>
              </div>
              <CokluCizgiGrafigi
                veri={koridorBirlesik}
                seriler={[
                  { anahtar: "Üst bant", etiket: "Üst bant (borç verme)" },
                  { anahtar: "Politika faizi", etiket: "Politika faizi" },
                  { anahtar: "Alt bant", etiket: "Alt bant (borç alma)" },
                  { anahtar: "BIST gecelik repo", etiket: "BIST gecelik repo (piyasa)" },
                ]}
                ondalik={2}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="tlref">
          <p className="mb-3 text-sm text-muted-foreground">TLREF endeksi kapanış değeri (günlük).</p>
          <CokluCizgiGrafigi veri={tlrefVeri} seriler={[{ anahtar: "tlref_kapanis", etiket: "TLREF Kapanış" }]} ondalik={2} />
        </TabsContent>

        <TabsContent value="disdenge">
          <DisDengeBolumu />
        </TabsContent>

        <TabsContent value="rezerv">
          <NetRezervBolumu />
        </TabsContent>

        <TabsContent value="beklenti">
          <PiyasaBeklentileriBolumu />
        </TabsContent>

        <TabsContent value="ppkfarki">
          <p className="mb-3 text-sm text-muted-foreground">
            PPK&apos;nın son iki &quot;Faiz Oranlarına İlişkin Basın Duyurusu&quot; metni arasındaki fark,
            Word&apos;ün &quot;değişiklikleri izle&quot; biçiminde — kırmızı üstü çizili kısımlar önceki
            karardan kaldırılan, yeşil altı çizili kısımlar yeni eklenen ifadelerdir.
          </p>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
            <h3 className="text-base font-semibold">Fark raporu (PDF)</h3>
            <a
              href="/ppk-karar-farki/ppk-karar-farki-2026-07-23.pdf"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
            >
              📄 PDF&apos;i indir / yeni sekmede aç
            </a>
          </div>
          <iframe
            src="/ppk-karar-farki/ppk-karar-farki-2026-07-23.pdf"
            title="PPK Karar Farkı"
            className="mt-3 h-[80vh] w-full rounded-lg border border-border"
          />
        </TabsContent>

        <TabsContent value="enflasyonraporu">
          {!enflasyonRaporu ? (
            <BosDurum baslik="Enflasyon Raporu kaydı yok" aciklama="TCMB'nin yayımladığı Enflasyon Raporu özetleri burada listelenir." />
          ) : (
            <div className="space-y-3">
              <h3 className="text-base font-semibold">{enflasyonRaporu.rapor_baslik}</h3>
              <a
                href={enflasyonRaporu.tam_metin_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
              >
                📄 Tam metni indir (PDF)
              </a>
              <p className="text-xs text-muted-foreground">
                Bu bilgiler {enflasyonRaporu.indirilme_tarihi} tarihinde TCMB&apos;nin sitesinden çekildi.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
