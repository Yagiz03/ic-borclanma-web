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

  // Panel KASITLI OLARAK oturum istemiyor. Misafir oturumu sadece kişisel
  // özellikler (izleme listesi / pozisyon / ihale emri -- hepsi auth.uid()'ye
  // dayanıyor) için gerekiyor; gösterilen verilerin tamamı zaten herkese açık.
  // Eskiden oturumsuz ziyaretçi açılış ekranına geri atılıyordu ve misafir
  // oturumu AÇILAMAYAN bir tarayıcıda (site verisi/çerezi kapalı, kurumsal ağ
  // Supabase auth'u engelliyor, anonim giriş limiti) site tamamen
  // kullanılamaz hale geliyordu -- "bağlantı kurulamadı" ekranı buydu.
  // Artık oturum kurulamasa da panel açılıyor, sadece kişisel özellikler
  // devre dışı kalıyor.
  void user;

  return supabaseResponse;
}
