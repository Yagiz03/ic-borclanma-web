"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, X } from "lucide-react";
import type { HaftaOlayi, HaftaOzeti } from "@/lib/haftalik-olaylar";

/** Bildirim ekranda kalma süresi. */
const SURE_MS = 15_000;
/** Sayfa boyansın diye küçük bir giriş gecikmesi (bildirim sonra kayarak girer). */
const GIRIS_GECIKMESI_MS = 400;
/** Kayarak çıkış animasyonunun süresi. */
const CIKIS_MS = 300;
/** Oturum başına bir kez: sayfa değiştikçe tekrar tekrar çıkmasın. */
const OTURUM_ANAHTARI = "hafta-bildirimi-gosterildi";

const GUN_ADLARI = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

const NOKTA: Record<HaftaOlayi["tur"], string> = {
  ppk: "bg-[var(--chart-1)]",
  ihale: "bg-[var(--chart-4)]",
  global: "bg-slate-400",
  enflasyon: "bg-[oklch(0.62_0.2_15)]",
  diger: "bg-[var(--chart-2)]",
};

/**
 * Panele girişte sağ üstte beliren, bu haftanın takvim olaylarını özetleyen
 * bildirim. Ekranı kaplamaz, 15 saniye sonra kendiliğinden kapanır; kullanıcı
 * elle de kapatabilir. Oturum başına bir kez gösterilir (sessionStorage) --
 * her sayfa geçişinde yeniden çıkması rahatsız edici olurdu.
 */
type Asama = "gizli" | "acik" | "kapaniyor";

export function HaftaBildirimi({ ozet }: { ozet: HaftaOzeti }) {
  const { olaylar, ileriBakis } = ozet;
  const [asama, setAsama] = useState<Asama>("gizli");

  const kapat = useCallback(() => {
    setAsama("kapaniyor");
    // Kayarak çıkış animasyonu bitince DOM'dan kaldır.
    setTimeout(() => setAsama("gizli"), CIKIS_MS);
  }, []);

  useEffect(() => {
    if (olaylar.length === 0) return;
    try {
      if (sessionStorage.getItem(OTURUM_ANAHTARI)) return;
      sessionStorage.setItem(OTURUM_ANAHTARI, "1");
    } catch {
      // Depolama kapalıysa (gizli sekme, katı gizlilik ayarı) bildirim yine
      // gösterilir -- sadece "oturumda bir kez" güvencesi kalkar.
    }
    // setState EFEKT GÖVDESİNDE ÇAĞRILMIYOR (React Compiler kuralı): giriş de
    // zamanlayıcı üzerinden, sayfa boyandıktan sonra tetikleniyor.
    const zamanlayicilar: ReturnType<typeof setTimeout>[] = [];
    zamanlayicilar.push(setTimeout(() => setAsama("acik"), GIRIS_GECIKMESI_MS));
    zamanlayicilar.push(
      setTimeout(() => {
        setAsama("kapaniyor");
        zamanlayicilar.push(setTimeout(() => setAsama("gizli"), CIKIS_MS));
      }, GIRIS_GECIKMESI_MS + SURE_MS),
    );
    return () => zamanlayicilar.forEach(clearTimeout);
  }, [olaylar.length]);

  if (asama === "gizli" || olaylar.length === 0) return null;

  // Günlere göre grupla: "Perşembe: PPK, ABD ÜFE, ECB faiz kararı" gibi.
  const gunler = new Map<string, HaftaOlayi[]>();
  for (const o of olaylar) {
    gunler.set(o.tarih, [...(gunler.get(o.tarih) ?? []), o]);
  }

  const bugunIso = new Date().toISOString().slice(0, 10);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-20 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover/95 p-4 shadow-lg backdrop-blur-md transition-all duration-300 ${
        asama === "kapaniyor" ? "translate-x-2 opacity-0" : "translate-x-0 opacity-100"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" />
          <p className="text-sm font-semibold">{ileriBakis ? "Önümüzdeki 7 gün" : "Bu hafta"}</p>
        </div>
        <button
          type="button"
          onClick={kapat}
          aria-label="Bildirimi kapat"
          className="-mt-1 -mr-1 rounded-full p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="mt-2.5 space-y-2">
        {[...gunler.entries()].map(([tarih, gunOlaylari]) => {
          const gunAdi = GUN_ADLARI[new Date(`${tarih}T00:00:00Z`).getUTCDay()];
          return (
            <div key={tarih} className="text-xs">
              <p className="font-medium text-foreground">
                {tarih === bugunIso ? "Bugün" : gunAdi}
                {/* Biçim elle kuruluyor: tarayıcı yereli tr-TR değilse
                    toLocaleDateString "10/09" gibi eğik çizgili basıyordu. */}
                <span className="font-figures ml-1.5 font-normal text-muted-foreground">
                  {tarih.slice(8, 10)}.{tarih.slice(5, 7)}
                </span>
              </p>
              <ul className="mt-1 space-y-0.5">
                {gunOlaylari.map((o, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-muted-foreground">
                    <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${NOKTA[o.tur]}`} />
                    <span>{o.etiket}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <Link
        href="/dashboard/takvim"
        onClick={kapat}
        className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline"
      >
        Takvimin tamamı →
      </Link>
    </div>
  );
}
