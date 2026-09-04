"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function GirisPage() {
  const router = useRouter();
  const [adSoyad, setAdSoyad] = useState("");
  const [email, setEmail] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function girisYap(e: React.FormEvent) {
    e.preventDefault();
    setYukleniyor(true);
    setHata(null);
    const supabase = createClient();

    // E-posta doğrulama linki YOK -- kullanıcı isteğiyle, ad soyad + e-posta
    // yazıp DOĞRUDAN içeri giriyor (core/kullanici.py'deki mevcut Streamlit
    // uygulamasındaki "gerçek auth değil, sadece veri ayrımı" felsefesiyle
    // aynı). Anonim Supabase Auth oturumu (signInAnonymously) gerçek bir
    // auth.uid() veriyor -- e-posta round-trip'i olmadan -- böylece RLS
    // (watchlist/positions/page_views) yine de çalışıyor.
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      setYukleniyor(false);
      setHata(error?.message ?? "Giriş yapılamadı.");
      return;
    }

    const { error: metaError } = await supabase.auth.updateUser({
      data: { ad_soyad: adSoyad, email },
    });
    if (metaError) {
      setYukleniyor(false);
      setHata(metaError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Giriş yap</CardTitle>
          <CardDescription>
            Ad soyad ve e-posta yazıp doğrudan gir -- şifre ya da e-posta
            doğrulaması gerekmiyor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={girisYap} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ad_soyad">Ad soyad</Label>
              <Input
                id="ad_soyad"
                required
                value={adSoyad}
                onChange={(e) => setAdSoyad(e.target.value)}
                placeholder="Ad Soyad"
              />
            </div>
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
              {yukleniyor ? "Giriş yapılıyor..." : "Giriş yap"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
