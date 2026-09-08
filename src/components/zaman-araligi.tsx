"use client";

export type ZamanAraligi = "ytd" | "1y" | "3y" | "tum";

export const ZAMAN_SECENEKLERI: { deger: ZamanAraligi; etiket: string }[] = [
  { deger: "ytd", etiket: "Yılbaşından" },
  { deger: "1y", etiket: "1 yıl" },
  { deger: "3y", etiket: "3 yıl" },
  { deger: "tum", etiket: "Tümü" },
];

/** Seçilen aralığın başlangıç tarihi (ISO, YYYY-MM-DD). "tum" için null. */
export function araligaGoreBaslangic(aralik: ZamanAraligi): string | null {
  const bugun = new Date();
  if (aralik === "tum") return null;
  if (aralik === "ytd") return `${bugun.getFullYear()}-01-01`;
  const yil = aralik === "1y" ? 1 : 3;
  const d = new Date(bugun);
  d.setFullYear(d.getFullYear() - yil);
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
}: {
  deger: ZamanAraligi;
  onChange: (d: ZamanAraligi) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full bg-muted p-1">
      {ZAMAN_SECENEKLERI.map((s) => (
        <button
          key={s.deger}
          type="button"
          onClick={() => onChange(s.deger)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            deger === s.deger
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {s.etiket}
        </button>
      ))}
    </div>
  );
}
