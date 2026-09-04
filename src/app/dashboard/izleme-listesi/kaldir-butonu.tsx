"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function KaldirButonu({ isin }: { isin: string }) {
  const router = useRouter();

  async function kaldir() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("watchlist").delete().eq("user_id", user.id).eq("isin", isin);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon" onClick={kaldir} aria-label="Listeden çıkar">
      <X className="size-4" />
    </Button>
  );
}
