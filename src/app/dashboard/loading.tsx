// Dashboard altındaki tüm sayfalar için ortak yükleme iskeleti. Bu dosya
// yokken Next.js gezinmeyi bloke ediyordu: veri ağır sayfalarda (TCMB, İhale
// günü) kullanıcı tıkladıktan sonra saniyelerce eski sayfada kalıyor ve
// uygulama donmuş gibi görünüyordu.
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] animate-pulse space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Yükleniyor…</span>

      <div className="space-y-2">
        <div className="h-7 w-56 rounded-md bg-foreground/[0.08]" />
        <div className="h-4 w-96 max-w-full rounded-md bg-foreground/[0.06]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.06]">
            <div className="h-3 w-24 rounded bg-foreground/[0.06]" />
            <div className="mt-3 h-7 w-32 rounded bg-foreground/[0.08]" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.06]">
        <div className="h-4 w-48 rounded bg-foreground/[0.08]" />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-foreground/[0.05]" />
          ))}
        </div>
      </div>
    </div>
  );
}
