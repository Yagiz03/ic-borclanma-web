"use client";

import { useRouter } from "next/navigation";
import { Combobox } from "@/components/ui/combobox";

type Secenek = { isin: string; etiket: string };

export function IsinSecici({
  secenekler,
  secili,
  bosKagitlariGoster,
  bosKagitSayisi,
}: {
  secenekler: Secenek[];
  secili: string;
  /** İkincil piyasada hiç işlem görmemiş kağıtlar da listelensin mi. */
  bosKagitlariGoster: boolean;
  bosKagitSayisi: number;
}) {
  const router = useRouter();

  return (
    <div className="space-y-2">
      <Combobox
        className="max-w-md"
        value={secili}
        onChange={(isin) =>
          router.push(`/dashboard/dibs-detay?isin=${isin}${bosKagitlariGoster ? "&bos=1" : ""}`)
        }
        options={secenekler.map((s) => ({ value: s.isin, label: s.etiket, keywords: s.isin }))}
        placeholder="ISIN veya kağıt adı yazın..."
        emptyText="Eşleşen kağıt yok."
      />
      {bosKagitSayisi > 0 && (
        <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={bosKagitlariGoster}
            onChange={(e) =>
              router.push(
                `/dashboard/dibs-detay?isin=${secili}${e.target.checked ? "&bos=1" : ""}`,
              )
            }
            className="mt-0.5 accent-primary"
          />
          <span>
            İşlem/veri kaydı olmayan kağıtları da göster ({bosKagitSayisi} adet — çoğunlukla
            Doğrudan Satış Kamu Kira Sertifikası, hiç ikincil piyasada işlem görmüyor)
          </span>
        </label>
      )}
    </div>
  );
}
