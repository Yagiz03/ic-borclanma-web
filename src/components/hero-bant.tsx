export function HeroBant({
  ustBaslik,
  deger,
  birim,
  aciklama,
  ilerlemeYuzde,
  yanKartlar,
  aksiyon,
}: {
  ustBaslik: string;
  deger: string;
  birim?: string;
  aciklama: string;
  ilerlemeYuzde?: number;
  yanKartlar: { etiket: string; deger: string }[];
  aksiyon?: { etiket: string; href: string };
}) {
  return (
    <div className="metrik-serit rounded-2xl border border-border bg-card p-6 pt-6.5 shadow-xs">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="M3 17l6-6 4 4 8-8" />
            </svg>
            {ustBaslik}
          </div>
          <div className="font-figures mt-2 text-4xl leading-none font-bold text-foreground">
            {deger}
            {birim && <span className="ml-2 text-lg font-medium text-muted-foreground">{birim}</span>}
          </div>
          <div className="mt-2 text-[13px] text-muted-foreground">{aciklama}</div>
          {ilerlemeYuzde != null && (
            <div className="mt-4 h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(0, ilerlemeYuzde))}%` }}
              />
            </div>
          )}
          {aksiyon && (
            <a
              href={aksiyon.href}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              {aksiyon.etiket}
            </a>
          )}
        </div>
        {yanKartlar.length > 0 && (
          <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3 lg:w-auto lg:grid-cols-1 lg:shrink-0">
            {yanKartlar.map((k) => (
              <div key={k.etiket} className="min-w-40 rounded-xl bg-muted/60 px-4 py-3">
                <div className="text-[10.5px] text-muted-foreground">{k.etiket}</div>
                <div className="font-figures mt-0.5 text-lg font-semibold text-foreground">{k.deger}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
