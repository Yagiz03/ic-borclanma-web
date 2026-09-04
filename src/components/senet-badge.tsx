import { senetRengi } from "@/lib/senet-tipi";

export function SenetBadge({ tanim }: { tanim: string | null | undefined }) {
  const renk = senetRengi(tanim);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${renk.bg} ${renk.text}`}
    >
      <span className={`size-1.5 rounded-full ${renk.dot}`} />
      {tanim ?? "Bilinmiyor"}
    </span>
  );
}
