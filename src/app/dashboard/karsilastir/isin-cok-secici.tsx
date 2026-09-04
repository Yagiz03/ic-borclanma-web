"use client";

import { useRouter } from "next/navigation";

type Secenek = { isin: string; etiket: string };

export function IsinCokSecici({ secenekler, secililer }: { secenekler: Secenek[]; secililer: string[] }) {
  const router = useRouter();

  function degistir(isin: string, secili: boolean) {
    let yeni = secili ? [...secililer, isin] : secililer.filter((i) => i !== isin);
    if (yeni.length > 5) yeni = yeni.slice(-5);
    router.push(`/dashboard/karsilastir?isinler=${yeni.join(",")}`);
  }

  return (
    <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
      {secenekler.map((s) => (
        <label key={s.isin} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
          <input
            type="checkbox"
            checked={secililer.includes(s.isin)}
            onChange={(e) => degistir(s.isin, e.target.checked)}
            className="accent-primary"
          />
          <span className="font-figures">{s.isin}</span>
          <span className="truncate text-xs text-muted-foreground">{s.etiket}</span>
        </label>
      ))}
    </div>
  );
}
