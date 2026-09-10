"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Sonuc = { tur: "bilgi" | "hata"; mesaj: string };

/**
 * PPK fark raporunu elle ürettirir: /api/ppk-guncelle üzerinden
 * ic-borclanma-dashboard reposundaki "PPK karar farki" workflow'unu
 * çalıştırır. Workflow son iki karar metnini indirip PDF'i üretiyor ve
 * Supabase Storage'a yüklüyor; sayfa kovadaki en yeni raporu gösterdiği
 * için başka bir adım yok.
 *
 * Neden buton: PPK yılda 8 kez ve düzensiz aralıklarla toplanıyor -- günlük
 * cron boş çalışırdı, karar günü tek tık daha doğru.
 */
export function PpkGuncelleButonu() {
  const router = useRouter();
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  const tetikle = useCallback(async () => {
    setCalisiyor(true);
    setSonuc(null);
    try {
      const cevap = await fetch("/api/ppk-guncelle", { method: "POST" });
      const govde = (await cevap.json()) as { mesaj?: string; hata?: string };
      if (cevap.ok) {
        setSonuc({ tur: "bilgi", mesaj: govde.mesaj ?? "Rapor üretiliyor." });
        // İndirme + PDF üretimi + yükleme ~1-2 dk sürüyor.
        setTimeout(() => router.refresh(), 120_000);
      } else {
        setSonuc({ tur: "hata", mesaj: govde.mesaj ?? govde.hata ?? "Tetiklenemedi." });
      }
    } catch {
      setSonuc({ tur: "hata", mesaj: "Sunucuya ulaşılamadı." });
    } finally {
      setCalisiyor(false);
    }
  }, [router]);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button type="button" variant="outline" size="sm" onClick={tetikle} disabled={calisiyor}>
        <RefreshCw className={calisiyor ? "animate-spin" : undefined} />
        {calisiyor ? "Başlatılıyor…" : "Raporu güncelle"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Yeni PPK kararı çıktığı gün bas — son iki karar metni indirilip fark raporu yeniden üretilir.
      </p>
      {sonuc && (
        <p className={`text-xs ${sonuc.tur === "hata" ? "text-destructive" : "text-muted-foreground"}`}>
          {sonuc.mesaj}
        </p>
      )}
    </div>
  );
}
