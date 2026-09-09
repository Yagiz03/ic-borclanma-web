"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileSearch,
  Gauge,
  LineChart,
  CalendarDays,
  Wallet,
  Building2,
  FileText,
  Banknote,
  Coins,
  ArrowRightLeft,
  CalendarClock,
  FlaskConical,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { GlobalArama, type AramaKagidi } from "@/components/global-arama";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

// Sıra ve isimler Python tarafındaki dashboard.py::main()'deki st.Page
// listesiyle BİREBİR eşleşiyor (kullanıcı isteği, 04.09.2026'da orada
// sabitlenen sıra). Karşılaştır/P&L/İzleme Listesi orijinalde ayrı üst
// bar sayfası değil, DİBS Detay/Pricing içinde gömülü alt-sekme -- Karşılaştır
// DİBS Detay'ın, P&L de Bono ve Getiri Hesaplayıcı'nın alt-sekmesi (ayrı nav öğesi yok).
const anaSayfalar: NavItem[] = [
  { href: "/dashboard/ihale-detay", label: "İhale Detay", icon: Gauge },
  { href: "/dashboard/ihale-gunu", label: "İhale günü", icon: CalendarClock },
  { href: "/dashboard/dibs-detay", label: "DİBS Detay", icon: FileSearch },
  { href: "/dashboard/getiri-egrisi", label: "Getiri eğrisi", icon: LineChart },
  { href: "/dashboard/pricing", label: "Bono ve Getiri Hesaplayıcı", icon: Wallet },
  { href: "/dashboard/tcmb", label: "TCMB", icon: Banknote },
  { href: "/dashboard/hazine", label: "Hazine", icon: Coins },
  { href: "/dashboard/takasbank-tpp", label: "TPP", icon: ArrowRightLeft },
  { href: "/dashboard/ozel-sektor", label: "Özel sektör tahvilleri", icon: Building2 },
  { href: "/dashboard/strateji", label: "Borçlanma stratejisi", icon: FileText },
  { href: "/dashboard/takvim", label: "Takvim", icon: CalendarDays },
  { href: "/dashboard/deneysel", label: "Deneysel", icon: FlaskConical },
];

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const aktif = pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        // Dolgu/boşluklar bilinçli olarak dar: 11 sekme + arama kutusunun
        // tam ekranda TEK SATIRDA kalması için yer kazanmak gerekiyor.
        "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all",
        aktif
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground",
      )}
    >
      {/* İkonlar 11 sekmede ~200px yer tutuyor; arama kutusuyla birlikte tek
          satıra sığmak için sadece geniş ekranlarda (>=1536px) gösteriliyor. */}
      <Icon className="hidden size-4 shrink-0 2xl:block" />
      {item.label}
    </Link>
  );
}

export function AppShell({
  children,
  aramaKagitlari = [],
}: {
  children: React.ReactNode;
  aramaKagitlari?: AramaKagidi[];
}) {
  const pathname = usePathname();
  const [mobilAcik, setMobilAcik] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-background/70 backdrop-blur-xl backdrop-saturate-150">
        {/* Dar masaüstünde (ör. 1280px, 13" dizüstü) 11 sekme tek satıra sığmıyordu:
            menü taşıp son sekmeler erişilemez oluyor ve sayfa yatay kayıyordu.
            flex-wrap ile sekmeler ikinci satıra iniyor — hiçbir sekme gizlenmiyor
            ve etiketler eski projeyle birebir aynı kalıyor. */}
        <div className="flex min-h-16 w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2 lg:px-8">
          <nav className="hidden min-w-0 flex-1 flex-wrap items-center gap-0.5 lg:flex">
            {anaSayfalar.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
            {/* Arama kutusu son sekmenin (Takvim) hemen yanında ve sekmelerle
                aynı yükseklikte/hizada duruyor; nav akışının içinde olduğu için
                sekmeler alt satıra sardığında onunla birlikte sarıyor. */}
            <GlobalArama kagitlar={aramaKagitlari} />
          </nav>

          {/* Giriş sistemi şu an devrede olmadığı (herkes misafir oturumu) için
              "Çıkış yap" burada yok: çıkılacak bir hesap yokken tek etkisi
              misafirin izleme listesini/pozisyonlarını silmek olurdu. */}
          <div className="ml-auto flex items-center gap-3">
            <button
              className="rounded-full p-2 hover:bg-foreground/[0.05] lg:hidden"
              onClick={() => setMobilAcik((v) => !v)}
              aria-label="Menüyü aç"
            >
              {mobilAcik ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {mobilAcik && (
          <nav className="flex flex-col gap-1 border-t border-black/[0.06] p-3 lg:hidden">
            {/* Arama mobilde de olmalı: masaüstünde nav'ın içindeydi ama mobil
                menüye hiç eklenmemişti, yani ISIN araması telefonda tamamen
                erişilemezdi. Bir sonuca gidilince menü kendiliğinden kapanıyor. */}
            <GlobalArama
              kagitlar={aramaKagitlari}
              sinif="relative mb-2 w-full"
              onGezindi={() => setMobilAcik(false)}
            />
            {anaSayfalar.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onClick={() => setMobilAcik(false)} />
            ))}
          </nav>
        )}
      </header>

      <main className="w-full flex-1 p-4 lg:p-6">{children}</main>
    </div>
  );
}
