"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function IzlemeCikarButonu({ isin }: { isin: string }) {
  const router = useRouter();
  const [siliniyor, setSiliniyor] = useState(false);

  async function cikar() {
    setSiliniyor(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("watchlist").delete().eq("user_id", user.id).eq("isin", isin);
    }
    router.refresh();
  }

  return (
    <button
      onClick={cikar}
      disabled={siliniyor}
      title="İzleme listesinden çıkar"
      aria-label={`${isin} kağıdını izleme listesinden çıkar`}
      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50"
    >
      <X className="size-4" />
    </button>
  );
}
