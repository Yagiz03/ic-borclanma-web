const RENKLER: Record<string, { bg: string; text: string; dot: string }> = {
  "Sabit Kuponlu Devlet Tahvili": { bg: "bg-[oklch(0.7_0.16_250/0.15)]", text: "text-[oklch(0.78_0.14_250)]", dot: "bg-[oklch(0.7_0.16_250)]" },
  "TLREF'e Endeksli Devlet Tahvili": { bg: "bg-[oklch(0.68_0.15_300/0.15)]", text: "text-[oklch(0.78_0.13_300)]", dot: "bg-[oklch(0.68_0.15_300)]" },
  "TÜFE'ye Endeksli Devlet Tahvili": { bg: "bg-[oklch(0.72_0.15_155/0.15)]", text: "text-[oklch(0.8_0.14_155)]", dot: "bg-[oklch(0.72_0.15_155)]" },
  "Değişken Faizli Devlet Tahvili": { bg: "bg-[oklch(0.75_0.16_95/0.15)]", text: "text-[oklch(0.82_0.14_95)]", dot: "bg-[oklch(0.75_0.16_95)]" },
  "Kuponsuz Devlet Tahvili": { bg: "bg-[oklch(0.72_0.15_40/0.15)]", text: "text-[oklch(0.8_0.13_40)]", dot: "bg-[oklch(0.72_0.15_40)]" },
  "Hazine Bonosu": { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

const VARSAYILAN = { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" };

export function senetRengi(tanim: string | null | undefined) {
  return (tanim && RENKLER[tanim]) || VARSAYILAN;
}
