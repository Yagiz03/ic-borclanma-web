import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { fixtureAcik, fixtureFetch } from "./fixture";

/**
 * Çerez OKUMAYAN Supabase istemcisi.
 *
 * Neden ayrı: önbelleğe alınan bir kapsam içinde `cookies()` okunamıyor
 * (Next kuralı). Herkese açık veriler (isin_ozet, ihale_sonuclari, BIST
 * fiyatları, EVDS serileri...) zaten oturumdan bağımsız olduğu için bu
 * istemciyle çekilip önbelleğe alınabiliyor.
 *
 * KULLANICIYA ÖZEL tablolar (watchlist, positions, auction_tracks,
 * auction_orders) BURADAN OKUNMAZ -- onlar auth.uid()'ye bağlı, çerezli
 * istemci (lib/supabase/server.ts) ile çekilmeli. Aksi halde RLS kullanıcıyı
 * tanıyamaz ve sonuç boş döner.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      ...(fixtureAcik ? { global: { fetch: fixtureFetch() } } : {}),
    },
  );
}
