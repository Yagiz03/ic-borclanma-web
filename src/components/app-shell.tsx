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
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { SignOutButton } from "@/app/dashboard/sign-out-button";
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
];

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const aktif = pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all",
        aktif
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export function AppShell({
  children,
  ustBant,
}: {
  children: React.ReactNode;
  ustBant?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobilAcik, setMobilAcik] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-background/70 backdrop-blur-xl backdrop-saturate-150">
        {ustBant}
        {/* Dar masaüstünde (ör. 1280px, 13" dizüstü) 11 sekme tek satıra sığmıyordu:
            menü taşıp son sekmeler erişilemez oluyor ve sayfa yatay kayıyordu.
            flex-wrap ile sekmeler ikinci satıra iniyor -- hiçbir sekme gizlenmiyor
            ve etiketler eski projeyle birebir aynı kalıyor. */}
        <div className="flex min-h-16 w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2 lg:px-8">
          <nav className="hidden min-w-0 flex-1 flex-wrap items-center gap-1 lg:flex">
            {anaSayfalar.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 lg:ml-0">
            <SignOutButton />
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
