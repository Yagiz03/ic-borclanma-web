"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, LineChart, Star, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const OZELLIKLER = [
  { icon: Landmark, metin: "Tüm DİBS kağıtlarının ihale ve stok geçmişi" },
  { icon: LineChart, metin: "BIST ikincil piyasa fiyat ve getiri grafikleri" },
  { icon: Star, metin: "Kendi izleme listeni oluştur, kağıt takip et" },
];

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
    // (watchlist/positions) yine de çalışıyor.
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
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="gradient-marka relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-70 mix-blend-overlay"
          style={{
            background:
              "radial-gradient(circle at 15% 15%, white, transparent 40%), radial-gradient(circle at 85% 85%, white, transparent 45%)",
          }}
        />
        <div className="relative flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/20 font-figures text-sm font-bold backdrop-blur-sm">
            İB
          </div>
          <span className="font-semibold">İç Borçlanma Dashboard</span>
        </div>

        <div className="relative space-y-8">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">
            Türkiye Hazine iç borçlanma senetlerini tek panelde takip et.
          </h1>
          <ul className="space-y-4">
            {OZELLIKLER.map((o) => (
              <li key={o.metin} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <o.icon className="size-4" />
                </span>
                {o.metin}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">HMB · BIST BAP · TCMB verilerine dayanır.</p>
      </div>

      <div className="flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border-0 shadow-none lg:border lg:shadow-md">
          <CardHeader>
            <div className="gradient-marka mb-2 flex size-9 items-center justify-center rounded-lg font-figures text-sm font-bold text-white lg:hidden">
              İB
            </div>
            <CardTitle className="text-xl">Giriş yap</CardTitle>
            <CardDescription>
              Ad soyad ve e-posta yazıp doğrudan gir -- şifre ya da e-posta doğrulaması gerekmiyor.
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
      </div>
    </main>
  );
}
