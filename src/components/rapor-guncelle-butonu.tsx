"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Sonuc = { tur: "bilgi" | "hata"; mesaj: string };

/**
 * Bir raporu elle ürettiren tuş (PPK karar farkı, Borçlanma stratejisi).
 *
 * `uc` bir /api/... yolu; o uç GitHub Actions workflow'unu tetikliyor.
 * Üst üste basmak zararsız: uç "zaten çalışıyor" / "az önce başlatıldı"
 * cevabı döndürüp yeni çalışma açmıyor (bkz. lib/workflow-tetikle.ts).
 *
 * Rapor hazır olduğunda sayfanın kendini tazelemesi için iki kez
 * yenileniyor -- workflow süresi ağ/runner'a göre oynuyor, tek sabit
 * bekleme bazen erken kalıyordu.
 */
export function RaporGuncelleButonu({
  uc,
  etiket = "Raporu güncelle",
  aciklama,
  // Olculen workflow sureleri: PPK ~21 sn, strateji ~34 sn. Iki kez
  // yenileniyor cunku runner suresi ag/kuyruk yuzunden oynuyor.
  yenilemeSn = [40, 80],
}: {
  uc: string;
  etiket?: string;
  aciklama?: string;
  yenilemeSn?: number[];
}) {
  const router = useRouter();
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  const tetikle = useCallback(async () => {
    setCalisiyor(true);
    setSonuc(null);
    try {
      const cevap = await fetch(uc, { method: "POST" });
      const govde = (await cevap.json()) as { mesaj?: string; hata?: string };
      if (cevap.ok) {
        setSonuc({ tur: "bilgi", mesaj: govde.mesaj ?? "Başlatıldı." });
        for (const sn of yenilemeSn) setTimeout(() => router.refresh(), sn * 1000);
      } else {
        setSonuc({ tur: "hata", mesaj: govde.mesaj ?? govde.hata ?? "Tetiklenemedi." });
      }
    } catch {
      setSonuc({ tur: "hata", mesaj: "Sunucuya ulaşılamadı." });
    } finally {
      setCalisiyor(false);
    }
  }, [router, uc, yenilemeSn]);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button type="button" variant="outline" size="sm" onClick={tetikle} disabled={calisiyor}>
        <RefreshCw className={calisiyor ? "animate-spin" : undefined} />
        {calisiyor ? "Başlatılıyor…" : etiket}
      </Button>
      {aciklama && <p className="text-xs text-muted-foreground">{aciklama}</p>}
      {sonuc && (
        <p className={`text-xs ${sonuc.tur === "hata" ? "text-destructive" : "text-muted-foreground"}`}>
          {sonuc.mesaj}
        </p>
      )}
    </div>
  );
}
