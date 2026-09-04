"use client";

import { useRouter } from "next/navigation";

type Secenek = { isin: string; etiket: string };

export function IsinSecici({ secenekler, secili }: { secenekler: Secenek[]; secili: string }) {
  const router = useRouter();

  return (
    <select
      value={secili}
      onChange={(e) => router.push(`/dashboard/dibs-detay?isin=${e.target.value}`)}
      className="h-10 w-full max-w-md rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {secenekler.map((s) => (
        <option key={s.isin} value={s.isin} className="bg-popover text-popover-foreground">
          {s.etiket}
        </option>
      ))}
    </select>
  );
}
