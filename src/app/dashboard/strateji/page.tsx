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

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Borçlanma Stratejisi</h1>
        <p className="text-sm text-muted-foreground">
          Ardışık iki aylık İç Borçlanma Stratejisi belgesi arasındaki değişiklikleri (plan revizyonları,
          ihraç takvimi kaymaları vb.) karşılaştıran fark raporu -- HMB&apos;nin stratejinin kendisi değildir.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error.message}</p>}
          {!rapor ? (
            <p className="text-sm text-muted-foreground">Henüz fark raporu yok.</p>
          ) : (
            <article className="markdown-icerik">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {rapor.icerik_markdown}
              </ReactMarkdown>
            </article>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
