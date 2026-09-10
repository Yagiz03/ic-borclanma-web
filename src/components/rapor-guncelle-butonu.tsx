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
/** Yoklama araligi ve tavani. Is 20-35 sn suruyor; 2 sn'lik cozunurluk
 *  raporu dustugu an gostermeye yetiyor. 3 dakikadan sonra vazgecip
 *  kullaniciya "sayfayi yenile" diyoruz -- sonsuz yoklamayalim. */
const YOKLAMA_MS = 2000;
const TAVAN_MS = 180_000;

export function RaporGuncelleButonu({
  uc,
  etiket = "Raporu güncelle",
  aciklama,
}: {
  uc: string;
  etiket?: string;
  aciklama?: string;
}) {
  const router = useRouter();
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  const tetikle = useCallback(async () => {
    setCalisiyor(true);
    setSonuc(null);
    try {
      const cevap = await fetch(uc, { method: "POST" });
      const govde = (await cevap.json()) as {
        mesaj?: string;
        hata?: string;
        oncekiKosuId?: number | null;
      };
      if (!cevap.ok) {
        setSonuc({ tur: "hata", mesaj: govde.mesaj ?? govde.hata ?? "Tetiklenemedi." });
        setCalisiyor(false);
        return;
      }

      setSonuc({ tur: "bilgi", mesaj: govde.mesaj ?? "Başlatıldı." });

      // Sabit bekleme yerine YOKLAMA: rapor hazir oldugu an gorunsun.
      const sorgu =
        govde.oncekiKosuId != null ? `?oncekiKosuId=${govde.oncekiKosuId}` : "";
      const basla = Date.now();
      for (;;) {
        await new Promise((r) => setTimeout(r, YOKLAMA_MS));
        if (Date.now() - basla > TAVAN_MS) {
          setSonuc({ tur: "bilgi", mesaj: "Beklenenden uzun sürdü — sayfayı yenile." });
          break;
        }
        let durum: { durum?: string; sonuc?: string | null } = {};
        try {
          durum = await (await fetch(uc + sorgu, { cache: "no-store" })).json();
        } catch {
          continue; // gecici ag hatasi: yoklamaya devam
        }
        if (durum.durum === "bitti") {
          if (durum.sonuc === "success") {
            setSonuc({ tur: "bilgi", mesaj: "Rapor hazır." });
            router.refresh();
          } else {
            setSonuc({ tur: "hata", mesaj: "Rapor üretilemedi." });
          }
          break;
        }
        if (durum.durum === "bilinmiyor") break;
      }
    } catch {
      setSonuc({ tur: "hata", mesaj: "Sunucuya ulaşılamadı." });
    } finally {
      setCalisiyor(false);
    }
  }, [router, uc]);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button type="button" variant="outline" size="sm" onClick={tetikle} disabled={calisiyor}>
        <RefreshCw className={calisiyor ? "animate-spin" : undefined} />
        {calisiyor ? "Üretiliyor…" : etiket}
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
