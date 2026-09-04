"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileSearch,
  Activity,
  Gauge,
  LineChart,
  CalendarDays,
  Wallet,
  Landmark,
  Star,
  GitCompare,
  Building2,
  FileText,
  FlaskConical,
  Banknote,
  ArrowRightLeft,
  CalendarClock,
  Menu,
  X,
  ChevronDown,
  Clock,
} from "lucide-react";
import { useState } from "react";
import { SignOutButton } from "@/app/dashboard/sign-out-button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  yakinda?: boolean;
};

const anaSayfalar: NavItem[] = [
  { href: "/dashboard", label: "Özet", icon: LayoutDashboard },
  { href: "/dashboard/dibs-detay", label: "DİBS Detay", icon: FileSearch },
  { href: "/dashboard/ihale-detay", label: "İhale Detay", icon: Gauge },
  { href: "/dashboard/ihale-gunu", label: "İhale Günü", icon: CalendarClock },
  { href: "/dashboard/karsilastir", label: "Karşılaştır", icon: GitCompare },
  { href: "/dashboard/pricing", label: "Pricing", icon: Wallet },
  { href: "/dashboard/pnl", label: "P&L", icon: Landmark },
  { href: "/dashboard/getiri-egrisi", label: "Getiri Eğrisi", icon: LineChart },
  { href: "/dashboard/tcmb", label: "TCMB", icon: Banknote },
  { href: "/dashboard/takvim", label: "Takvim", icon: CalendarDays },
  { href: "/dashboard/takasbank-tpp", label: "Takasbank TPP", icon: ArrowRightLeft },
  { href: "/dashboard/ozel-sektor", label: "Özel Sektör", icon: Building2 },
  { href: "/dashboard/strateji", label: "Strateji", icon: FileText },
  { href: "/dashboard/izleme-listesi", label: "İzleme Listesi", icon: Star },
];

const yakindaSayfalar: NavItem[] = [
  { href: "/dashboard/deneysel", label: "Deneysel", icon: FlaskConical, yakinda: true },
];

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const aktif = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
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

function YakindaMenu() {
  const [acik, setAcik] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setAcik((v) => !v)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Clock className="size-4" />
        Yakında
        <ChevronDown className={cn("size-3.5 transition-transform", acik && "rotate-180")} />
      </button>
      {acik && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAcik(false)} />
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-popover p-1.5 shadow-lg">
            {yakindaSayfalar.map((item) => (
              <div
                key={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground"
              >
                <item.icon className="size-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide">
                  YAKINDA
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
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
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-6">
          <Logo />

          <nav className="hidden flex-1 items-center gap-1 overflow-x-auto lg:flex">
            {anaSayfalar.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          <div className="hidden items-center gap-1 lg:flex">
            <Link
              href="/dashboard/analitik"
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                pathname.startsWith("/dashboard/analitik")
                  ? "gradient-marka text-white shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Activity className="size-4 shrink-0" />
              Ziyaret Takibi
            </Link>
            <YakindaMenu />
          </div>

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
            <NavLink
              item={{ href: "/dashboard/analitik", label: "Ziyaret Takibi", icon: Activity }}
              pathname={pathname}
              onClick={() => setMobilAcik(false)}
            />
            <div className="my-1 h-px bg-border" />
            {yakindaSayfalar.map((item) => (
              <div
                key={item.href}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground/60"
              >
                <item.icon className="size-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide">
                  YAKINDA
                </span>
              </div>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 lg:p-6">{children}</main>
    </div>
  );
}
