"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";

/**
 * Kaynak duyurusuna (HMB basın duyurusu PDF'i) tıklanabilir tablo satırı --
 * core/ui.py::tiklanabilir_tablo'nun karşılığı.
 *
 * HTML'de <tr> bir <a> içine sarılamadığı için satırın TAMAMI onClick ile
 * açılıyor; ilk hücrede ayrıca gerçek bir <a> var, böylece orta tık / "yeni
 * sekmede aç" / klavyeyle gezinme ve ekran okuyucular da çalışıyor.
 */
export function KaynakSatiri({
  url,
  children,
  ilkHucre,
}: {
  url: string | null | undefined;
  /** Tarih gibi, bağlantı hâline gelecek ilk hücrenin içeriği. */
  ilkHucre: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!url) {
    return (
      <TableRow>
        <TableCell className="font-figures whitespace-nowrap">{ilkHucre}</TableCell>
        {children}
      </TableRow>
    );
  }

  const ac = () => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <TableRow
      className="group cursor-pointer hover:bg-muted/60"
      title="HMB basın duyurusunu (PDF) yeni sekmede aç"
      onClick={(e) => {
        // İç bağlantıya tıklandıysa onun kendi davranışı geçerli olsun.
        if ((e.target as HTMLElement).closest("a")) return;
        ac();
      }}
    >
      <TableCell className="font-figures whitespace-nowrap">
        <Link
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"
        >
          {ilkHucre}
          <ExternalLink className="size-3 opacity-40 transition-opacity group-hover:opacity-80" />
        </Link>
      </TableCell>
      {children}
    </TableRow>
  );
}
