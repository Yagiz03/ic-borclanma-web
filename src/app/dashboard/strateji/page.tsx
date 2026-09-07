import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export default async function StratejiPage() {
  const supabase = await createClient();

  const { data: rapor, error } = await supabase
    .from("strateji_raporlari")
    .select("*")
    .order("tarih", { ascending: false })
    .limit(1)
    .maybeSingle();

  const pdfDosyaAdi = rapor ? `fark-raporu-${rapor.tarih}.pdf` : null;
  const pdfUrl = pdfDosyaAdi ? `/strateji/${pdfDosyaAdi}` : null;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Borçlanma Stratejisi</h1>
        <p className="text-sm text-muted-foreground">
          Ardışık iki aylık İç Borçlanma Stratejisi belgesi arasındaki değişiklikleri (plan revizyonları,
          ihraç takvimi kaymaları vb.) karşılaştıran fark raporu -- HMB&apos;nin stratejinin kendisi değildir.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {!rapor ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Henüz fark raporu yok.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {pdfUrl && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Fark raporu (PDF)</h2>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
                  >
                    📄 PDF&apos;i indir / yeni sekmede aç
                  </a>
                </div>
                <iframe
                  src={pdfUrl}
                  title="İç Borçlanma Stratejisi Fark Raporu"
                  className="h-[80vh] w-full rounded-lg border border-border"
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 text-base font-semibold">Fark raporu (metin)</h2>
              <article className="markdown-icerik">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {rapor.icerik_markdown}
                </ReactMarkdown>
              </article>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
