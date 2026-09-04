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
  Menu,
  ChevronDown,
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
  { href: "/dashboard/karsilastir", label: "Karşılaştır", icon: GitCompare },
  { href: "/dashboard/pricing", label: "Pricing", icon: Wallet },
  { href: "/dashboard/pnl", label: "P&L", icon: Landmark },
  { href: "/dashboard/izleme-listesi", label: "İzleme Listesi", icon: Star },
];

const yakindaSayfalar: NavItem[] = [
  { href: "/dashboard/getiri-egrisi", label: "Getiri Eğrisi", icon: LineChart, yakinda: true },
  { href: "/dashboard/takvim", label: "Takvim", icon: CalendarDays, yakinda: true },
  { href: "/dashboard/ozel-sektor", label: "Özel Sektör", icon: Building2, yakinda: true },
  { href: "/dashboard/strateji", label: "Strateji", icon: FileText, yakinda: true },
  { href: "/dashboard/deneysel", label: "Deneysel", icon: FlaskConical, yakinda: true },
];

const yonetimSayfalari: NavItem[] = [
  { href: "/dashboard/analitik", label: "Ziyaret Takibi", icon: Activity },
];

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const aktif = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
  const Icon = item.icon;

  if (item.yakinda) {
    return (
      <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/40">
        <Icon className="size-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] font-medium tracking-wide text-sidebar-foreground/50">
          YAKINDA
        </span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        aktif
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const [yakindaAcik, setYakindaAcik] = useState(false);

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center gap-2 px-2 pt-1">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary font-figures text-sm font-bold text-primary-foreground">
          İB
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">İç Borçlanma</div>
          <div className="text-xs leading-tight text-muted-foreground">Dashboard</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {anaSayfalar.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
        ))}

        <div className="my-3 h-px bg-sidebar-border" />
        {yonetimSayfalari.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
        ))}

        <div className="my-3 h-px bg-sidebar-border" />
        <button
          onClick={() => setYakindaAcik((v) => !v)}
          className="flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase hover:text-sidebar-foreground/80"
        >
          Yakında ({yakindaSayfalar.length})
          <ChevronDown className={`size-3.5 transition-transform ${yakindaAcik ? "rotate-180" : ""}`} />
        </button>
        {yakindaAcik &&
          yakindaSayfalar.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
          ))}
      </nav>
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
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {mobilAcik && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobilAcik(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <SidebarContent pathname={pathname} onNavigate={() => setMobilAcik(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 lg:px-6">
          <button
            className="rounded-md p-2 hover:bg-accent lg:hidden"
            onClick={() => setMobilAcik(true)}
            aria-label="Menüyü aç"
          >
            <Menu className="size-5" />
          </button>
          <div className="hidden text-sm text-muted-foreground lg:block" />
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{adSoyad}</div>
              <div className="text-xs text-muted-foreground">{email}</div>
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
