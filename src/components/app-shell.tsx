"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileSearch,
  Gauge,
  LineChart,
  CalendarDays,
  Wallet,
  Landmark,
  Star,
  GitCompare,
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

const anaSayfalar: NavItem[] = [
  { href: "/dashboard/dibs-detay", label: "DİBS Detay", icon: FileSearch },
  { href: "/dashboard/ihale-detay", label: "İhale Detay", icon: Gauge },
  { href: "/dashboard/ihale-gunu", label: "İhale Günü", icon: CalendarClock },
  { href: "/dashboard/karsilastir", label: "Karşılaştır", icon: GitCompare },
  { href: "/dashboard/pricing", label: "Pricing", icon: Wallet },
  { href: "/dashboard/pnl", label: "P&L", icon: Landmark },
  { href: "/dashboard/getiri-egrisi", label: "Getiri Eğrisi", icon: LineChart },
  { href: "/dashboard/tcmb", label: "TCMB", icon: Banknote },
  { href: "/dashboard/hazine", label: "Hazine", icon: Coins },
  { href: "/dashboard/takvim", label: "Takvim", icon: CalendarDays },
  { href: "/dashboard/takasbank-tpp", label: "Takasbank TPP", icon: ArrowRightLeft },
  { href: "/dashboard/ozel-sektor", label: "Özel Sektör", icon: Building2 },
  { href: "/dashboard/strateji", label: "Strateji", icon: FileText },
  { href: "/dashboard/izleme-listesi", label: "İzleme Listesi", icon: Star },
];

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const aktif = pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
        aktif
          ? "gradient-marka text-white shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function Logo() {
  return (
    <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
      <div className="gradient-marka flex size-9 items-center justify-center rounded-xl font-figures text-sm font-bold text-white shadow-sm">
        İB
      </div>
      <div className="hidden sm:block">
        <div className="text-sm leading-tight font-semibold">İç Borçlanma</div>
        <div className="gradient-metin text-xs leading-tight font-medium">Dashboard</div>
      </div>
    </Link>
  );
}

export function AppShell({
  children,
  adSoyad,
  email,
}: {
  children: React.ReactNode;
  adSoyad: string;
  email: string;
}) {
  const pathname = usePathname();
  const [mobilAcik, setMobilAcik] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="flex h-16 w-full items-center gap-4 px-4 lg:px-6">
          <Logo />

          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex">
            {anaSayfalar.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 lg:ml-0">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium">{adSoyad}</div>
              <div className="text-xs text-muted-foreground">{email}</div>
            </div>
            <SignOutButton />
            <button
              className="rounded-md p-2 hover:bg-accent lg:hidden"
              onClick={() => setMobilAcik((v) => !v)}
              aria-label="Menüyü aç"
            >
              {mobilAcik ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {mobilAcik && (
          <nav className="flex flex-col gap-1 border-t border-border p-3 lg:hidden">
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
