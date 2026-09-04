"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function IzlemeButonu({ isin, baslangicIzlemede }: { isin: string; baslangicIzlemede: boolean }) {
  const [izlemede, setIzlemede] = useState(baslangicIzlemede);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function toggle() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (izlemede) {
      await supabase.from("watchlist").delete().eq("user_id", user.id).eq("isin", isin);
    } else {
      await supabase.from("watchlist").insert({ user_id: user.id, isin });
    }
    setIzlemede(!izlemede);
    startTransition(() => router.refresh());
  }

  return (
    <Button variant={izlemede ? "default" : "outline"} onClick={toggle}>
      <Star className={`size-4 ${izlemede ? "fill-current" : ""}`} />
      {izlemede ? "İzlemede" : "İzlemeye al"}
    </Button>
  );
}
