/** İlerleme %'sini kırmızı (düşük) -> yeşil (tamama yakın) gradyanla gösteren rozet --
 * orijinal Streamlit sayfasındaki RdYlGn colormap'in web karşılığı. */
export function IlerlemeRozeti({ oran }: { oran: number | null }) {
  if (oran == null) return <span className="text-muted-foreground">–</span>;
  const t = Math.max(0, Math.min(1, oran));
  const ton = t * 130; // 0 = kırmızı, 130 = yeşil (oklch hue derecesi)
  return (
    <span
      className="inline-flex min-w-14 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold font-figures"
      style={{
        backgroundColor: `oklch(0.93 0.08 ${ton})`,
        color: `oklch(0.32 0.14 ${ton})`,
      }}
    >
      %{(t * 100).toFixed(1)}
    </span>
  );
}
