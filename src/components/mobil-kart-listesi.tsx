import Link from "next/link";
import { ExternalLink } from "lucide-react";

/**
 * Geniş tabloların mobil karşılığı.
 *
 * 14 sütunlu "İhale geçmişi" tablosu 375 px'lik bir telefonda 1287 px
 * genişliğinde kalıyor -- yani ekranın dört katı kadar yatay kaydırma. Sütun
 * daraltmakla çözülecek bir şey değil; mobilde SATIR BAŞINA BİR KART daha
 * okunur. Tablo `hidden sm:block`, bu liste `sm:hidden` olarak yan yana
 * duruyor: masaüstü görünümü hiç değişmiyor (masaüstü öncelikli ürün).
 */
export type KartAlan = {
  etiket: string;
  deger: React.ReactNode;
  /** Uzun metinler (senet tanımı gibi) tüm satırı kaplasın. */
  genis?: boolean;
};

export type MobilKart = {
  /** Kartın kimliği -- tarih, ISIN gibi. */
  baslik: React.ReactNode;
  altBaslik?: React.ReactNode;
  /** Varsa başlık kaynak belgeye (PDF) bağlanır. */
  url?: string | null;
  alanlar: KartAlan[];
};

export function MobilKartListesi({ kartlar }: { kartlar: MobilKart[] }) {
  if (kartlar.length === 0) return null;

  return (
    <ul className="space-y-2 sm:hidden">
      {kartlar.map((k, i) => (
        <li key={i} className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-border/60 pb-2">
            <span className="font-figures text-sm font-semibold">
              {k.url ? (
                <Link
                  href={k.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"
                >
                  {k.baslik}
                  <ExternalLink className="size-3 opacity-40" />
                </Link>
              ) : (
                k.baslik
              )}
            </span>
            {k.altBaslik && (
              <span className="min-w-0 truncate text-xs text-muted-foreground">{k.altBaslik}</span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {k.alanlar.map((a) => (
              <div key={a.etiket} className={a.genis ? "col-span-2" : undefined}>
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  {a.etiket}
                </dt>
                <dd className="font-figures text-sm">{a.deger}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}
