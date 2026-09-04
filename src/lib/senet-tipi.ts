const RENKLER: Record<string, { bg: string; text: string; dot: string }> = {
  "Sabit Kuponlu Devlet Tahvili": { bg: "bg-[oklch(0.94_0.05_264)]", text: "text-[oklch(0.4_0.18_264)]", dot: "bg-[oklch(0.55_0.21_264)]" },
  "TLREF'e Endeksli Devlet Tahvili": { bg: "bg-[oklch(0.94_0.05_300)]", text: "text-[oklch(0.42_0.17_300)]", dot: "bg-[oklch(0.55_0.2_300)]" },
  "TÜFE'ye Endeksli Devlet Tahvili": { bg: "bg-[oklch(0.94_0.06_155)]", text: "text-[oklch(0.38_0.14_155)]", dot: "bg-[oklch(0.55_0.18_155)]" },
  "Değişken Faizli Devlet Tahvili": { bg: "bg-[oklch(0.95_0.06_85)]", text: "text-[oklch(0.42_0.13_75)]", dot: "bg-[oklch(0.65_0.17_75)]" },
  "Kuponsuz Devlet Tahvili": { bg: "bg-[oklch(0.94_0.06_35)]", text: "text-[oklch(0.42_0.16_35)]", dot: "bg-[oklch(0.6_0.19_35)]" },
  "Hazine Bonosu": { bg: "bg-muted", text: "text-secondary-foreground", dot: "bg-muted-foreground" },
};

const VARSAYILAN = { bg: "bg-muted", text: "text-secondary-foreground", dot: "bg-muted-foreground" };

export function senetRengi(tanim: string | null | undefined) {
  return (tanim && RENKLER[tanim]) || VARSAYILAN;
}
