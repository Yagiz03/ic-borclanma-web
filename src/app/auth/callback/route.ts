import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// E-posta doğrulama ve şifre sıfırlama linklerinin indiği yer. Supabase, proje
// ayarına göre iki farklı biçim gönderebiliyor: PKCE akışında ?code=..., klasik
// akışta ?token_hash=...&type=... -- ikisini de karşılıyoruz. Link tek kullanımlık
// olduğu için, oturum kurulduktan sonra kullanıcıyı hedef sayfaya yönlendiriyoruz.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const sonraki = searchParams.get("sonraki") ?? "/dashboard";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${sonraki}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${sonraki}`);
  }

  return NextResponse.redirect(`${origin}/giris?hata=link-gecersiz`);
}
