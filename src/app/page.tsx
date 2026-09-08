"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Landmark, LineChart, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const OZELLIKLER = [
  { icon: Landmark, metin: "Tüm DİBS kağıtlarının ihale ve stok geçmişi" },
  { icon: LineChart, metin: "BIST ikincil piyasa fiyat ve getiri grafikleri" },
  { icon: Star, metin: "Kendi izleme listeni oluştur, kağıt takip et" },
];

// Açılış ekranı. Giriş/kayıt ekranı (/giris) kodda duruyor ama şu an devrede
// değil -- abonelik sistemi geldiğinde devreye alınacak. O yüzden burada
// kullanıcıya hiçbir form gösterilmiyor: "Başla"ya (ya da ekranın herhangi bir
// yerine) basınca arka planda sessizce misafir oturumu açılıp panele geçiliyor.
// Misafir oturumu, izleme listesi / pozisyon / ihale emri gibi kişisel
// özelliklerin dayandığı auth.uid()'yi sağlıyor.
const HEDEF = "/dashboard/ihale-detay";

export default function Home() {
  const router = useRouter();
  const [cikisAnimasyonu, setCikisAnimasyonu] = useState(false);
  const [hata, setHata] = useState(false);

  useEffect(() => {
    router.prefetch(HEDEF);
  }, [router]);

  // Oturumu kullanıcı daha tıklamadan hazırla ki geçiş anında olsun.
  useEffect(() => {
    void oturumuHazirla();
  }, []);

  const basla = useCallback(async () => {
    if (cikisAnimasyonu) return;
    setHata(false);
    setCikisAnimasyonu(true);
    try {
      // Oturum hazırlığı takılırsa kullanıcı görünmez sayfada mahsur
      // kalmasın diye zaman aşımı: 4 sn sonra yine de devam ediyoruz.
      await Promise.race([
        oturumuHazirla(),
        new Promise((c) => setTimeout(c, 4000)),
      ]);
    } catch {
      // Oturum açılamadıysa panele girilemez; sayfayı geri görünür yapıp
      // kullanıcıya tekrar deneme şansı veriyoruz (önce sayfa sonsuza
      // kadar boş/görünmez kalıyordu).
      setCikisAnimasyonu(false);
      setHata(true);
      return;
    }
    // Bilinçli olarak TAM SAYFA gezinme (router.push değil): istemci taraflı
    // gezinme burada sessizce başarısız olabiliyordu ve sayfa çıkış
    // animasyonu yüzünden görünmez kaldığı için kullanıcı BOŞ EKRANDA
    // kalıyordu (Edge'de doğrulandı). Tam yükleme, middleware'in az önce
    // yazılan oturum çerezini görmesini de garantiler.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(HEDEF);
  }, [cikisAnimasyonu]);

  return (
    <main
      onClick={basla}
      className={cn(
        "gradient-marka relative flex min-h-screen cursor-pointer flex-col items-center justify-center overflow-hidden px-6 text-white transition-all duration-500 ease-out",
        cikisAnimasyonu && "scale-[1.04] opacity-0",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70 mix-blend-overlay"
        style={{
          background:
            "radial-gradient(circle at 15% 15%, white, transparent 40%), radial-gradient(circle at 85% 85%, white, transparent 45%)",
        }}
      />

      <div className="relative flex max-w-2xl flex-col items-center text-center">
        <p className="animate-in fade-in slide-in-from-bottom-2 text-sm font-semibold tracking-[0.2em] text-white/70 uppercase duration-700">
          Türkiye Tahvil
        </p>

        <h1 className="animate-in fade-in slide-in-from-bottom-3 mt-5 text-4xl font-semibold tracking-tight text-balance duration-700 sm:text-6xl">
          Türkiye tahvil ve bono terminali
        </h1>

        <p className="animate-in fade-in slide-in-from-bottom-3 mt-5 max-w-xl text-base text-balance text-white/80 duration-1000 sm:text-lg">
          Hazine iç borçlanma senetlerini ihaleden ikincil piyasaya, ihale sonuçlarından getiri
          eğrisine tek panelde takip et.
        </p>

        <span className="animate-in fade-in zoom-in-95 mt-10 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-[oklch(0.52_0.18_254)] shadow-lg transition-transform duration-1000 hover:scale-[1.03]">
          Başla
          <ArrowRight className="size-4" />
        </span>

        {hata && (
          <p className="mt-4 text-sm text-white/90">
            Bağlantı kurulamadı, panele girilemedi. Lütfen tekrar dene.
          </p>
        )}

        <ul className="animate-in fade-in mt-14 flex flex-col items-start gap-3 duration-1000 sm:flex-row sm:gap-8">
          {OZELLIKLER.map((o) => (
            <li key={o.metin} className="flex items-center gap-2.5 text-sm text-white/85">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                <o.icon className="size-3.5" />
              </span>
              {o.metin}
            </li>
          ))}
        </ul>
      </div>

      <p className="absolute bottom-8 text-xs text-white/50">
        HMB · BIST BAP · TCMB verilerine dayanır.
      </p>
    </main>
  );
}

/** Oturum yoksa sessizce misafir (anonim) oturumu açar.
 *  Oturum kurulamazsa HATA FIRLATIR: çağıran taraf bunu yakalayıp kullanıcıyı
 *  bilgilendiriyor (önce sessizce yutuluyordu ve kullanıcı panele giremeden
 *  boş bir sayfada kalıyordu). */
async function oturumuHazirla() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  const { data: yeni, error } = await supabase.auth.signInAnonymously();
  if (error || !yeni.session) {
    throw new Error(error?.message ?? "Misafir oturumu açılamadı.");
  }
}
