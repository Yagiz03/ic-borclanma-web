"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SignOutButton() {
  const router = useRouter();
  const [anonim, setAnonim] = useState(false);
  const [onayAcik, setOnayAcik] = useState(false);

  // Eski anonim oturumlarda çıkış YIKICI: auth.uid() kalıcı olmadığı için
  // kullanıcı çıkıştan sonra kendi izleme listesine/pozisyonlarına bir daha
  // erişemiyor. Bu yüzden anonim kullanıcıdan önce onay istiyoruz.
  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setAnonim(Boolean(data.session?.user.is_anonymous)));
  }, []);

  async function cikisYap() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/giris");
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" onClick={() => (anonim ? setOnayAcik(true) : cikisYap())}>
        Çıkış yap
      </Button>

      <Dialog open={onayAcik} onOpenChange={setOnayAcik}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verilerin kalıcı olarak silinecek</DialogTitle>
            <DialogDescription>
              Hesabın geçici olduğu için çıkış yaptığında izleme listen, pozisyonların ve ihale
              emirlerin geri getirilemez. Önce hesabını kalıcı yaparsan verilerin korunur.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOnayAcik(false)}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={cikisYap}>
              Yine de çıkış yap
            </Button>
            <Button render={<Link href="/giris" />}>Hesabımı kalıcı yap</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
