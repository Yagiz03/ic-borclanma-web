import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="font-figures text-5xl font-semibold text-muted-foreground">404</p>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Sayfa bulunamadı</h1>
        <p className="text-sm text-muted-foreground">
          Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/dashboard/ihale-detay" />}>
        Panele dön
      </Button>
    </main>
  );
}
