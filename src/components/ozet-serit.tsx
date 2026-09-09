export type OzetAlan = {
  etiket: string;
  deger: string;
  /** Değerin altında küçük punto ek bilgi (tarih, kaynak notu vb.). */
  altBilgi?: string;
  /** Hücrenin üstüne gelince çıkan açıklama. */
  yardim?: string;
};

// Etiketli metrikler (KPI) sayfadan sayfaya üç ayrı biçimde gösteriliyordu:
// kimi yerde havadar kart ızgarası, kimi yerde sıkı kartlar. Hepsi bu tek
// şeride bağlandı: hücreler dikey çizgiyle ayrılıyor, dar ekranda yatay
// kayıyor. Finansal terminallerin yoğun/okunaklı görünümü hedeflendi.
export function OzetSerit({ alanlar }: { alanlar: OzetAlan[] }) {
  if (alanlar.length === 0) return null;

  return (
    <div className="metrik-serit overflow-x-auto rounded-xl border border-border bg-card">
      <div className="flex min-w-max divide-x divide-border">
        {alanlar.map((a) => (
          <div key={a.etiket} className="min-w-44 flex-1 px-4 py-3" title={a.yardim}>
            <p className="text-xs whitespace-nowrap text-muted-foreground">{a.etiket}</p>
            <p className="font-figures mt-1 text-lg font-semibold whitespace-nowrap">{a.deger}</p>
            {a.altBilgi && (
              <p className="mt-0.5 text-xs whitespace-nowrap text-muted-foreground">{a.altBilgi}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
