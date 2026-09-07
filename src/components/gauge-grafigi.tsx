export function GaugeGrafigi({
  yuzde,
  merkezEtiket,
  altYazi,
}: {
  yuzde: number;
  merkezEtiket: string;
  altYazi?: string;
}) {
  const r = 60;
  const cevre = 2 * Math.PI * r;
  const dolu = Math.min(1, Math.max(0, yuzde / 100)) * cevre;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150">
      <circle cx="75" cy="75" r={r} fill="none" stroke="var(--muted)" strokeWidth="14" />
      <circle
        cx="75"
        cy="75"
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="14"
        strokeDasharray={`${dolu} ${cevre}`}
        strokeLinecap="round"
        transform="rotate(-90 75 75)"
      />
      <text x="75" y="72" textAnchor="middle" className="font-figures" fontSize="26" fontWeight="700" fill="var(--foreground)">
        {merkezEtiket}
      </text>
      {altYazi && (
        <text x="75" y="92" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
          {altYazi}
        </text>
      )}
    </svg>
  );
}
