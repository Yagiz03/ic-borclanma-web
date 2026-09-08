"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Sonuc = { tur: "bilgi" | "hata"; mesaj: string };

/**
 * OST verisini elle tazeler: /api/ost-guncelle üzerinden GitHub Actions'taki
 * "OST veri guncelleme" workflow'unu çalıştırır. Workflow'un kendi cron'u
 * 15:16 TR'ye ayarlı ama GitHub `schedule:` tetikleyicisini saatlerce
 * geciktirebiliyor -- bu buton beklemeden çalıştırmak için.
 */
export function VeriGuncelleButonu() {
  const router = useRouter();
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  const tetikle = useCallback(async () => {
    setCalisiyor(true);
    setSonuc(null);
    try {
      const cevap = await fetch("/api/ost-guncelle", { method: "POST" });
      const govde = (await cevap.json()) as { mesaj?: string; hata?: string };
      if (cevap.ok) {
        setSonuc({ tur: "bilgi", mesaj: govde.mesaj ?? "Güncelleme başlatıldı." });
        // Workflow'un indirme + Supabase yazma adımları ~2-3 dk sürüyor;
        // sayfayı o civarda tazeleyip yeni veriyi gösteriyoruz.
        setTimeout(() => router.refresh(), 150_000);
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
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <Button type="button" variant="outline" size="sm" onClick={tetikle} disabled={calisiyor}>
        <RefreshCw className={calisiyor ? "animate-spin" : undefined} />
        {calisiyor ? "Başlatılıyor…" : "Veri güncelle"}
      </Button>
      <p className="text-xs text-muted-foreground">
        BIST ara bülteni ~15:15&apos;te yayımlanıyor — <b>15:20&apos;de &quot;Veri güncelle&quot;ye bas.</b>
      </p>
      {sonuc && (
        <p className={`text-xs ${sonuc.tur === "hata" ? "text-destructive" : "text-muted-foreground"}`}>
          {sonuc.mesaj}
        </p>
      )}
    </div>
  );
}
