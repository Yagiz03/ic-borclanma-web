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
    <div
      className="relative overflow-hidden rounded-3xl p-8 shadow-[0_16px_32px_-10px_rgba(109,40,217,0.35)]"
      style={{ backgroundImage: "linear-gradient(120deg, oklch(0.47 0.22 293) 0%, oklch(0.55 0.22 293) 45%, oklch(0.58 0.22 330) 100%)" }}
    >
      <div className="pointer-events-none absolute -top-36 -right-10 size-85 rounded-full bg-white/8" />
      <div className="relative z-10 flex flex-col gap-7 lg:flex-row">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-wide text-violet-100">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="M3 17l6-6 4 4 8-8" />
            </svg>
            {ustBaslik}
          </div>
          <div className="mt-2 font-figures text-5xl leading-none font-bold text-white">
            {deger}
            {birim && <span className="ml-2 text-xl font-medium text-violet-200">{birim}</span>}
          </div>
          <div className="mt-2 text-[13px] text-violet-100">{aciklama}</div>
          {ilerlemeYuzde != null && (
            <div className="mt-4 h-[7px] w-full max-w-md overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${Math.min(100, Math.max(0, ilerlemeYuzde))}%` }}
              />
            </div>
          )}
          {aksiyon && (
            <a
              href={aksiyon.href}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-violet-700 hover:opacity-90"
            >
              {aksiyon.etiket}
            </a>
          )}
        </div>
        {yanKartlar.length > 0 && (
          <div className="flex w-full flex-col gap-2 lg:w-70 lg:shrink-0">
            {yanKartlar.map((k) => (
              <div key={k.etiket} className="rounded-2xl bg-white/14 px-4 py-3">
                <div className="text-[10.5px] text-violet-100">{k.etiket}</div>
                <div className="font-figures mt-0.5 text-lg font-bold text-white">{k.deger}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
