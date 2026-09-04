"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function GirisPage() {
  const [email, setEmail] = useState("");
  const [gonderildi, setGonderildi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function girisYap(e: React.FormEvent) {
    e.preventDefault();
    setYukleniyor(true);
    setHata(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setYukleniyor(false);
    if (error) {
      setHata(error.message);
      return;
    }
    setGonderildi(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Giriş yap</CardTitle>
          <CardDescription>
            {gonderildi
              ? "E-postana bir giriş bağlantısı gönderdik -- gelen kutunu kontrol et."
              : "E-posta adresini gir, sana bir giriş bağlantısı (magic link) gönderelim -- şifre yok."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!gonderildi && (
            <form onSubmit={girisYap} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@eposta.com"
                />
              </div>
              {hata && <p className="text-sm text-destructive">{hata}</p>}
              <Button type="submit" className="w-full" disabled={yukleniyor}>
                {yukleniyor ? "Gönderiliyor..." : "Bağlantı gönder"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
