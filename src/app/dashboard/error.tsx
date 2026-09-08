"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Dashboard sayfalarından biri hata verirse (ör. Supabase sorgusu düşerse)
// kullanıcı Next.js'in varsayılan İngilizce hata ekranını görüyordu.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg items-center justify-center py-16">
      <Card className="w-full">
        <CardContent className="space-y-4 pt-6 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-destructive/10">
            <TriangleAlert className="size-5 text-destructive" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold">Bu sayfa yüklenemedi</h2>
            <p className="text-sm text-muted-foreground">
              Veri kaynağına ulaşırken bir sorun çıktı. Tekrar denemek sorunu genellikle çözer.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button onClick={reset}>Tekrar dene</Button>
          </div>
          {error.digest && (
            <p className="font-figures text-xs text-muted-foreground">Hata kodu: {error.digest}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
