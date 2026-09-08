import Link from "next/link";
import { TriangleAlert } from "lucide-react";

// Eski sürümde giriş signInAnonymously() ile yapılıyordu: kullanıcının izleme
// listesi / pozisyonları / ihale emirleri kalıcı olmayan bir anonim auth.uid()'ye
// bağlı. Çıkış yapmak ya da tarayıcı verisini temizlemek bu veriyi geri
// dönülemez şekilde erişilemez kılıyor. Bu bant, o kullanıcıları verilerini
// koruyarak kalıcı hesaba geçmeye çağırıyor (bkz. giris/page.tsx yükseltme akışı).
export function GeciciHesapUyarisi() {
  return (
    <div className="border-b border-amber-500/25 bg-amber-500/10">
      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5 lg:px-8">
        <TriangleAlert className="size-4 shrink-0 text-amber-600" />
        <p className="text-sm text-foreground">
          Hesabın geçici. Çıkış yaparsan izleme listen, pozisyonların ve ihale emirlerin kalıcı
          olarak kaybolur.
        </p>
        <Link
          href="/giris"
          className="ml-auto rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700"
        >
          Hesabını kalıcı yap
        </Link>
      </div>
    </div>
  );
}
