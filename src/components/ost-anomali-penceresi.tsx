"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Panele girişte açılan ÖST anomali uyarısı.
 *
 * Eski Streamlit projesinde bu bir st.dialog'du ve yalnızca Özel sektör
 * sayfasına girince açılıyordu (pages/ozel_sektor.py::_ost_anomali_popup).
 * Kullanıcı isteğiyle artık panele girişte çıkıyor -- kağıdın hareketini
 * o sayfaya uğramadan da görebilmek için.
 *
 * TARİH BAŞINA BİR KEZ: aynı işlem gününün uyarısı her sayfa geçişinde
 * yeniden açılırsa rahatsız edici olur. Kapatılan tarih localStorage'a
 * yazılıyor (eski projede oturum durumuydu; burada sekme yenilense de
 * tekrar açılmasın diye kalıcı).
 */
const ANAHTAR = "ost-anomali-kapatilan-tarih";

type Cevap = { tarih: string | null; mesajlar: string[] };

export function OstAnomaliPenceresi() {
  const [veri, setVeri] = useState<Cevap | null>(null);
  const [acik, setAcik] = useState(false);
  // React StrictMode efekti iki kez çalıştırıyor; tek sefer çekilsin.
  const cekildiRef = useRef(false);

  useEffect(() => {
    if (cekildiRef.current) return;
    cekildiRef.current = true;

    (async () => {
      try {
        const c: Cevap = await (await fetch("/api/ost-anomali")).json();
        if (!c.tarih || c.mesajlar.length === 0) return;
        let kapatilan: string | null = null;
        try {
          kapatilan = localStorage.getItem(ANAHTAR);
        } catch {
          // Depolama kapalı olabilir (gizli sekme) -- o zaman her girişte çıkar.
        }
        if (kapatilan === c.tarih) return;
        setVeri(c);
        setAcik(true);
      } catch {
        // Uyarı ikincil bir bilgi: çekilemezse sessizce geç.
      }
    })();
  }, []);

  function kapat(yeniAcik: boolean) {
    setAcik(yeniAcik);
    if (!yeniAcik && veri?.tarih) {
      try {
        localStorage.setItem(ANAHTAR, veri.tarih);
      } catch {}
    }
  }

  if (!veri) return null;

  const tarihMetni = veri.tarih
    ? new Date(`${veri.tarih}T00:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "UTC" })
    : "";

  return (
    <Dialog open={acik} onOpenChange={kapat}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-destructive">
            ⚠️ {veri.mesajlar.length} kağıtta anormal hareket
          </DialogTitle>
          <DialogDescription>
            {tarihMetni} işlem gününde, her kağıdın KENDİ bir önceki gerçek işlem gününe göre getirisi
            ≥300 bps ya da fiyatı ≥%3 hareket edenler.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[50vh] list-inside list-disc space-y-1.5 overflow-y-auto text-sm text-destructive">
          {veri.mesajlar.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>Kapat</DialogClose>
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard/ozel-sektor" />}
            onClick={() => kapat(false)}
          >
            Özel sektör sayfasına git
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
