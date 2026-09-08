import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { trTarihAyristir } from "@/lib/tarih";
import type { AramaKagidi } from "@/components/global-arama";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Oturum yoksa da panel açılır (bkz. lib/supabase/middleware.ts) -- sadece
  // kişisel özellikler devre dışı kalır, o yüzden bir uyarı şeridi gösteriliyor.
  const misafirOturumuYok = !user;

  // Üst bardaki global arama kutusunun kağıt indeksi (core/arama.py ile aynı
  // filtreler): itfa olmuşlar düşer, ikincil piyasada hiç işlem görmemiş Kamu
  // Kira Sertifikaları dışlanır -- yoksa arama, DİBS Detay'ın seçim kutusunda
  // bulunmayan bir ISIN önerebilirdi.
  const { data: ozetHam } = await supabase
    .from("isin_ozet")
    .select("isin, senet_tanimi, vade_tarihi, bist_son_tarih");

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
      {misafirOturumuYok && (
        <div className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Misafir oturumu açılamadı — tüm veriler görünüyor, ancak izleme listesi,
          pozisyonlar ve ihale emirleri bu tarayıcıda kaydedilemez. Tarayıcının site
          verisi/çerez izni kapalıysa ya da ağ Supabase&apos;e erişimi engelliyorsa bu olur.
        </div>
      )}
      {children}
    </AppShell>
  );
}
