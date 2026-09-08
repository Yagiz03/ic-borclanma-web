"use client";

import { useRouter } from "next/navigation";
import { Combobox } from "@/components/ui/combobox";

type Secenek = { isin: string; etiket: string };

export function IsinSecici({ secenekler, secili }: { secenekler: Secenek[]; secili: string }) {
  const router = useRouter();

  return (
    <Combobox
      className="max-w-md"
      value={secili}
      onChange={(isin) => router.push(`/dashboard/dibs-detay?isin=${isin}`)}
      options={secenekler.map((s) => ({ value: s.isin, label: s.etiket, keywords: s.isin }))}
      placeholder="ISIN veya kağıt adı yazın..."
      emptyText="Eşleşen kağıt yok."
    />
  );
}
