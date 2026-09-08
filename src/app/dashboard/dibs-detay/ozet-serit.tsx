export type OzetAlan = { etiket: string; deger: string; yardim?: string };

// Kağıdın künye bilgileri (ilk ihraç, vade, kupon, stok, TCMB payı...) eskiden
// 2-3 sütunluk kart ızgarasındaydı ve dikeyde çok yer kaplıyordu. Eski
// Streamlit sayfasındaki gibi TEK SATIR: hücreler dikey çizgilerle ayrılıyor,
// dar ekranda şerit yatay kayıyor.
export function OzetSerit({ alanlar }: { alanlar: OzetAlan[] }) {
  if (alanlar.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="flex min-w-max divide-x divide-border">
        {alanlar.map((a) => (
          <div key={a.etiket} className="min-w-40 flex-1 px-4 py-3" title={a.yardim}>
            <p className="text-xs whitespace-nowrap text-muted-foreground">{a.etiket}</p>
            <p className="font-figures mt-1 text-lg font-semibold whitespace-nowrap">{a.deger}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
