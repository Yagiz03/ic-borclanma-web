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
export default function Home() {
  const router = useRouter();
  const [cikisAnimasyonu, setCikisAnimasyonu] = useState(false);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  // Oturumu kullanıcı daha tıklamadan hazırla ki geçiş anında olsun.
  useEffect(() => {
    void oturumuHazirla();
  }, []);

  const basla = useCallback(async () => {
    if (cikisAnimasyonu) return;
    setCikisAnimasyonu(true);
    await oturumuHazirla();
    // Çıkış animasyonunun bitmesini bekle, sonra panele geç.
    setTimeout(() => router.push("/dashboard"), 480);
  }, [cikisAnimasyonu, router]);

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

/** Oturum yoksa sessizce misafir (anonim) oturumu açar. */
async function oturumuHazirla() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) await supabase.auth.signInAnonymously();
}
