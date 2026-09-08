import { Inbox } from "lucide-react";

// Boş durumlar sayfa boyunca düz gri bir cümleydi; içeriğin yüklenmediği mi
// yoksa gerçekten veri mi olmadığı belirsiz kalıyordu. Kesikli çerçeveli,
// ikonlu bu kutu "burada bilinçli olarak bir şey yok" mesajını net veriyor.
export function BosDurum({
  baslik,
  aciklama,
  ikon: Ikon = Inbox,
}: {
  baslik: string;
  aciklama?: string;
  ikon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <Ikon className="size-5 text-muted-foreground/70" />
      <p className="text-sm font-medium text-foreground">{baslik}</p>
      {aciklama && <p className="max-w-md text-sm text-muted-foreground">{aciklama}</p>}
    </div>
  );
}
