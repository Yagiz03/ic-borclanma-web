"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function PozisyonSilButonu({ id }: { id: string }) {
  const router = useRouter();

  async function sil() {
    if (!confirm("Bu pozisyonu silmek istediğine emin misin? Bu işlem geri alınamaz.")) return;
    const supabase = createClient();
    await supabase.from("positions").delete().eq("id", id);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon" onClick={sil} aria-label="Pozisyonu sil">
      <Trash2 className="size-4" />
    </Button>
  );
}
