"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Şifre sıfırlama linkine tıklayan kullanıcı buraya düşer. /auth/callback linki
// zaten geçerli bir oturum kurduğu için burada sadece yeni şifreyi yazması yeterli.
export default function SifreYenilePage() {
  const router = useRouter();
  const [sifre, setSifre] = useState("");
  const [sifreTekrar, setSifreTekrar] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);

    if (sifre !== sifreTekrar) {
      setHata("Şifreler birbiriyle uyuşmuyor.");
      return;
    }

    setYukleniyor(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: sifre });
    setYukleniyor(false);

    if (error) {
      setHata(
        error.message.toLowerCase().includes("session")
          ? "Sıfırlama linki geçersiz veya süresi dolmuş. Yeni bir link iste."
          : error.message,
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Yeni şifre belirle</CardTitle>
          <CardDescription>Hesabın için en az 8 karakterli yeni bir şifre gir.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={kaydet} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sifre">Yeni şifre</Label>
              <Input
                id="sifre"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={sifre}
                onChange={(e) => setSifre(e.target.value)}
                placeholder="En az 8 karakter"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sifre_tekrar">Yeni şifre (tekrar)</Label>
              <Input
                id="sifre_tekrar"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={sifreTekrar}
                onChange={(e) => setSifreTekrar(e.target.value)}
                placeholder="En az 8 karakter"
              />
            </div>
            {hata && <p className="text-sm text-destructive">{hata}</p>}
            <Button type="submit" className="w-full" disabled={yukleniyor}>
              {yukleniyor ? "Kaydediliyor..." : "Şifreyi güncelle"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
