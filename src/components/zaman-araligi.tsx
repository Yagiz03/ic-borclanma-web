"use client";

export type ZamanAraligi = "1a" | "3a" | "6a" | "ytd" | "1y" | "3y" | "tum";

const ETIKETLER: Record<ZamanAraligi, string> = {
  "1a": "1 Ay",
  "3a": "3 Ay",
  "6a": "6 Ay",
  ytd: "Yılbaşından",
  "1y": "1 yıl",
  "3y": "3 yıl",
  tum: "Tümü",
};

/** Varsayılan set. Daha ince aralık isteyen grafikler (ör. TLREF) kendi
 *  listesini `secenekler` ile geçiyor. */
export const ZAMAN_SECENEKLERI: ZamanAraligi[] = ["ytd", "1y", "3y", "tum"];

/** Seçilen aralığın başlangıç tarihi (ISO, YYYY-MM-DD). "tum" için null. */
export function araligaGoreBaslangic(aralik: ZamanAraligi): string | null {
  const bugun = new Date();
  if (aralik === "tum") return null;
  if (aralik === "ytd") return `${bugun.getFullYear()}-01-01`;

  const d = new Date(bugun);
  const ay = { "1a": 1, "3a": 3, "6a": 6 }[aralik as "1a" | "3a" | "6a"];
  if (ay != null) d.setMonth(d.getMonth() - ay);
  else d.setFullYear(d.getFullYear() - (aralik === "1y" ? 1 : 3));
  return d.toISOString().slice(0, 10);
}

/** `tarih` alanı ISO (YYYY-MM-DD) olan kayıtları seçilen aralığa göre süzer. */
export function zamanaGoreSuz<T extends { tarih: string }>(veri: T[], aralik: ZamanAraligi): T[] {
  const baslangic = araligaGoreBaslangic(aralik);
  if (!baslangic) return veri;
  return veri.filter((r) => r.tarih >= baslangic);
}

export function ZamanAraligiSecici({
  deger,
  onChange,
  secenekler = ZAMAN_SECENEKLERI,
}: {
  deger: ZamanAraligi;
  onChange: (d: ZamanAraligi) => void;
  secenekler?: ZamanAraligi[];
}) {
  return (
    <div className="flex gap-1 rounded-full bg-muted p-1">
      {secenekler.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            deger === s
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {ETIKETLER[s]}
        </button>
      ))}
    </div>
  );
}
