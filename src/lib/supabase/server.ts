import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { fixtureAcik, fixtureFetch } from "./fixture";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component'ten çağrıldığında cookie set edilemez --
            // middleware zaten session'ı tazeliyor, burada sessizce yok say.
          }
        },
      },
      ...(fixtureAcik ? { global: { fetch: fixtureFetch() } } : {}),
    },
  );
}
