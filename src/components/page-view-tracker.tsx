"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Her sayfa girişinde bir page_views satırı açar, sayfadan ayrılınca
 * (route değişimi ya da sekme kapanması) süreyi hesaplayıp aynı satırı
 * günceller. Son güncelleme `fetch(..., {keepalive: true})` ile atılıyor
 * -- sayfa kapanırken normal fetch/Supabase client isteği iptal
 * edilebiliyor, keepalive tarayıcının isteği arka planda tamamlamasını
 * sağlıyor (sendBeacon PATCH/Authorization header desteklemediği için
 * tercih edilmedi).
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const girisZamaniRef = useRef<number | null>(null);
  const satirIdRef = useRef<string | null>(null);

  useEffect(() => {
    let iptal = false;

    async function girisiKaydet() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || iptal) return;

      const adSoyad = (user.user_metadata?.ad_soyad as string) ?? "";
      const email = (user.user_metadata?.email as string) ?? user.email ?? "";

      const { data, error } = await supabase
        .from("page_views")
        .insert({ user_id: user.id, ad_soyad: adSoyad, email, yol: pathname })
        .select("id")
        .single();

      if (!error && data && !iptal) {
        satirIdRef.current = data.id;
        girisZamaniRef.current = Date.now();
      }
    }

    girisiKaydet();

    return () => {
      iptal = true;
      cikisiKaydet();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function cikisiKaydet() {
    const id = satirIdRef.current;
    const girisZamani = girisZamaniRef.current;
    if (!id || !girisZamani) return;

    const sureSaniye = (Date.now() - girisZamani) / 1000;
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/page_views?id=eq.${id}`;

    // localStorage'daki Supabase session'ından erişim token'ını okuyoruz --
    // client component'te senkron erişilebilen tek yer bu (supabase-js
    // access_token'ı burada tutuyor).
    let accessToken = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    try {
      const anahtar = Object.keys(localStorage).find((k) => k.endsWith("-auth-token"));
      if (anahtar) {
        const oturum = JSON.parse(localStorage.getItem(anahtar) ?? "{}");
        if (oturum?.access_token) accessToken = oturum.access_token;
      }
    } catch {
      // localStorage okunamazsa anon key ile devam -- RLS reddeder,
      // sessizce hiçbir şey güncellenmez.
    }

    fetch(url, {
      method: "PATCH",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ cikis_zamani: new Date().toISOString(), sure_saniye: sureSaniye }),
    }).catch(() => {});

    satirIdRef.current = null;
    girisZamaniRef.current = null;
  }

  useEffect(() => {
    window.addEventListener("beforeunload", cikisiKaydet);
    return () => window.removeEventListener("beforeunload", cikisiKaydet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
