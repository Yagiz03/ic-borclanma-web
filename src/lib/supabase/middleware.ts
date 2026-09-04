import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Oturumu tazelemek için auth.getUser() ZORUNLU -- session cookie'sini
  // yenilemeden sadece cookie okumak, refresh token süresi dolduğunda
  // kullanıcıyı sessizce çıkışa düşürür.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /dashboard altındaki her şey korumalı -- Faz 1'deki gerçek sayfalar
  // (İhale Detay, DİBS Detay) buraya taşınacak.
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/giris";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
