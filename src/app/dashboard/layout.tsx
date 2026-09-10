import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { trTarihAyristir } from "@/lib/tarih";
import type { AramaKagidi } from "@/components/global-arama";
import { HaftaBildirimi } from "@/components/hafta-bildirimi";
import { OstAnomaliPenceresi } from "@/components/ost-anomali-penceresi";
import { haftalikOlaylariGetir } from "@/lib/haftalik-olaylar";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Oturum yoksa da panel açılır (bkz. lib/supabase/middleware.ts): gösterilen
  // verilerin tamamı herkese açık, yalnızca kişisel özellikler (izleme listesi,
  // pozisyon, ihale emri) sessizce çalışmaz. Kullanıcıya uyarı GÖSTERİLMİYOR --
  // çoğu ziyaretçi için anlamsız bir teknik ayrıntı.
  void user;

  // Üst bardaki global arama kutusunun kağıt indeksi (core/arama.py ile aynı
  // filtreler): itfa olmuşlar düşer, ikincil piyasada hiç işlem görmemiş Kamu
  // Kira Sertifikaları dışlanır -- yoksa arama, DİBS Detay'ın seçim kutusunda
  // bulunmayan bir ISIN önerebilirdi.
  const [{ data: ozetHam }, haftaOlaylari] = await Promise.all([
    supabase.from("isin_ozet").select("isin, senet_tanimi, vade_tarihi, bist_son_tarih"),
    // Panele girişte sağ üstte çıkan "Bu hafta" bildirimi.
    haftalikOlaylariGetir(),
  ]);

  const bugun = new Date().getTime();
  const gorulen = new Set<string>();
  const aramaKagitlari: AramaKagidi[] = [];
  for (const r of ozetHam ?? []) {
    const vade = trTarihAyristir(r.vade_tarihi);
    if (!vade || vade.getTime() <= bugun) continue;
    const tanim = r.senet_tanimi ?? "";
    if (tanim.includes("Kira Sertifikas") && r.bist_son_tarih == null) continue;
    if (gorulen.has(r.isin)) continue;
    gorulen.add(r.isin);
    aramaKagitlari.push({ isin: r.isin, tanim });
  }

  return (
    <AppShell aramaKagitlari={aramaKagitlari}>
      <HaftaBildirimi ozet={haftaOlaylari} />
      <OstAnomaliPenceresi />
      {children}
    </AppShell>
  );
}
