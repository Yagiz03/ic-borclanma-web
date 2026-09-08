"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, LineChart, Star } from "lucide-react";
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

type Mod = "giris" | "kayit" | "sifremi-unuttum";

/** Supabase'in İngilizce hata mesajlarını kullanıcıya gösterilebilir Türkçeye çevirir. */
function hataMesaji(mesaj: string): string {
  const m = mesaj.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-posta veya şifre hatalı.";
  if (m.includes("email not confirmed")) return "E-postanı henüz doğrulamamışsın -- gelen kutunu kontrol et.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Bu e-posta ile zaten bir hesap var. Giriş yap sekmesini kullan.";
  if (m.includes("password should be at least")) return "Şifre en az 8 karakter olmalı.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Çok fazla deneme yapıldı, birkaç dakika sonra tekrar dene.";
  if (m.includes("unable to validate email")) return "Geçerli bir e-posta adresi gir.";
  return mesaj;
}

export default function GirisPage() {
  const router = useRouter();
  const [mod, setMod] = useState<Mod>("giris");
  const [adSoyad, setAdSoyad] = useState("");
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  function modDegistir(yeni: Mod) {
    setMod(yeni);
    setHata(null);
    setBilgi(null);
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setYukleniyor(true);
    setHata(null);
    setBilgi(null);
    const supabase = createClient();

    try {
      if (mod === "sifremi-unuttum") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?sonraki=/sifre-yenile`,
        });
        if (error) throw error;
        setBilgi("Şifre sıfırlama linki e-postana gönderildi.");
        return;
      }

      if (mod === "giris") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: sifre });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
        return;
      }

      // mod === "kayit". Tarayıcıda hâlâ eski anonim oturum duruyorsa, YENİ hesap
      // açmak yerine o oturumu kalıcı hesaba YÜKSELTİYORUZ: auth.uid() aynı kaldığı
      // için kullanıcının izleme listesi / pozisyonları / ihale emirleri korunuyor.
      // (Eski sürümde giriş signInAnonymously() ile yapılıyordu.)
      const { data: mevcut } = await supabase.auth.getUser();
      if (mevcut.user?.is_anonymous) {
        const { error } = await supabase.auth.updateUser({
          email,
          password: sifre,
          data: { ad_soyad: adSoyad },
        });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
        return;
      }

      // E-posta doğrulaması bilinçli olarak KAPALI (kullanıcı kararı, 08.09.2026):
      // her yeni kayıtta doğrulama maili göndermek, ani kullanıcı akınında
      // e-posta gönderim limitine takılır. Kayıt olan doğrudan içeri giriyor.
      // (Şifre sıfırlama maili duruyor -- o sadece unutan kullanıcı kadar.)
      const { data, error } = await supabase.auth.signUp({
        email,
        password: sifre,
        options: { data: { ad_soyad: adSoyad } },
      });
      if (error) throw error;

      // Supabase tarafında "Confirm email" sonradan açılırsa signUp oturum döndürmez.
      if (!data.session) {
        setBilgi("Hesabın oluşturuldu. Şimdi giriş yapabilirsin.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setHata(hataMesaji(e instanceof Error ? e.message : "Bir şeyler ters gitti."));
    } finally {
      setYukleniyor(false);
    }
  }

  const baslik =
    mod === "giris" ? "Giriş yap" : mod === "kayit" ? "Hesap oluştur" : "Şifremi unuttum";
  const aciklama =
    mod === "giris"
      ? "E-posta ve şifrenle hesabına gir."
      : mod === "kayit"
        ? "İzleme listen, pozisyonların ve ihale emirlerin hesabına kayıtlı kalır."
        : "Kayıtlı e-postanı gir, sıfırlama linki gönderelim.";

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
        <div className="relative">
          <span className="text-lg font-semibold tracking-tight">Türkiye Tahvil</span>
        </div>

        <div className="relative space-y-8">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">
            Türkiye tahvil ve bono terminali
          </h1>
          <p className="-mt-4 text-sm text-white/80">
            Hazine iç borçlanma senetlerini ihaleden ikincil piyasaya tek panelde takip et.
          </p>
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
            <p className="gradient-metin mb-2 text-base font-semibold tracking-tight lg:hidden">
              Türkiye Tahvil
            </p>
            <CardTitle className="text-xl">{baslik}</CardTitle>
            <CardDescription>{aciklama}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mod !== "sifremi-unuttum" && (
              <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
                {(["giris", "kayit"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => modDegistir(m)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      mod === m
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "giris" ? "Giriş yap" : "Hesap oluştur"}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={gonder} className="space-y-4">
              {mod === "kayit" && (
                <div className="space-y-2">
                  <Label htmlFor="ad_soyad">Ad soyad</Label>
                  <Input
                    id="ad_soyad"
                    required
                    autoComplete="name"
                    value={adSoyad}
                    onChange={(e) => setAdSoyad(e.target.value)}
                    placeholder="Ad Soyad"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@eposta.com"
                />
              </div>

              {mod !== "sifremi-unuttum" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sifre">Şifre</Label>
                    {mod === "giris" && (
                      <button
                        type="button"
                        onClick={() => modDegistir("sifremi-unuttum")}
                        className="text-xs text-primary hover:underline"
                      >
                        Şifremi unuttum
                      </button>
                    )}
                  </div>
                  <Input
                    id="sifre"
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mod === "giris" ? "current-password" : "new-password"}
                    value={sifre}
                    onChange={(e) => setSifre(e.target.value)}
                    placeholder="En az 8 karakter"
                  />
                </div>
              )}

              {hata && <p className="text-sm text-destructive">{hata}</p>}
              {bilgi && <p className="text-sm text-primary">{bilgi}</p>}

              <Button type="submit" className="w-full" disabled={yukleniyor}>
                {yukleniyor
                  ? "Lütfen bekle..."
                  : mod === "giris"
                    ? "Giriş yap"
                    : mod === "kayit"
                      ? "Hesap oluştur"
                      : "Sıfırlama linki gönder"}
              </Button>

              {mod === "sifremi-unuttum" && (
                <button
                  type="button"
                  onClick={() => modDegistir("giris")}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  Girişe dön
                </button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
