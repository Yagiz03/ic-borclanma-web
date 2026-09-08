#!/usr/bin/env node
/**
 * RLS (satır düzeyi güvenlik) doğrulaması: iki AYRI misafir (anonim) oturumu
 * açıp kullanıcıya özel dört tablonun (watchlist, positions, auction_tracks,
 * auction_orders) birbirinden gerçekten yalıtıldığını kontrol eder.
 *
 *   npm run rls
 *
 * `npm test`in parçası DEĞİL: ağ gerektiriyor ve gerçek Supabase projesine
 * yazıyor. Yalnızca PUBLIC anon anahtarını kullanır (service_role ASLA).
 * Her çalıştırma iki anonim kullanıcı oluşturur; yazdığı test satırlarını
 * sonunda kendisi siler.
 */
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync("/Users/yagiztulun/Desktop/Dosyalar/Kodlarım/ic-borclanma-web/.env.local", "utf8")
    .split("\n").filter(l => l.includes("=")).map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const anonimGiris = async () => {
  const r = await fetch(`${URL}/auth/v1/signup`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: "{}",
  });
  const d = await r.json();
  if (!d.access_token) throw new Error("anonim oturum acilamadi: " + JSON.stringify(d).slice(0, 200));
  return { token: d.access_token, uid: d.user.id };
};
const db = (u) => async (yol, opts = {}) => {
  const r = await fetch(`${URL}/rest/v1/${yol}`, {
    ...opts,
    headers: { apikey: ANON, Authorization: `Bearer ${u.token}`, "Content-Type": "application/json",
               Prefer: "return=representation", ...(opts.headers || {}) },
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const sonuc = [];
const kontrol = (ad, gecti, detay = "") => { sonuc.push({ ad, gecti, detay }); console.log(`${gecti ? "GECTI " : "KALDI "} ${ad}${detay ? "  -- " + detay : ""}`); };

const a = await anonimGiris(), b = await anonimGiris();
console.log("A:", a.uid, "\nB:", b.uid, "\n");
const A = db(a), B = db(b);

// --- watchlist ---
let r = await A("watchlist", { method: "POST", body: JSON.stringify({ user_id: a.uid, isin: "TRT_RLS_TEST" }) });
kontrol("A kendi watchlist satirini yazabiliyor", r.status === 201, `HTTP ${r.status}`);
r = await B("watchlist?isin=eq.TRT_RLS_TEST&select=*");
kontrol("B, A'nin watchlist satirini GOREMIYOR", Array.isArray(r.body) && r.body.length === 0, `donen satir: ${r.body?.length}`);
r = await B("watchlist?isin=eq.TRT_RLS_TEST", { method: "DELETE" });
kontrol("B, A'nin watchlist satirini SILEMIYOR", !(Array.isArray(r.body) && r.body.length > 0), `HTTP ${r.status}`);
r = await B("watchlist", { method: "POST", body: JSON.stringify({ user_id: a.uid, isin: "SAHTE" }) });
kontrol("B, A adina watchlist satiri EKLEYEMIYOR", r.status >= 400, `HTTP ${r.status}`);

// --- positions ---
r = await A("positions", { method: "POST", body: JSON.stringify({ user_id: a.uid, isin: "TRT_RLS_TEST", nominal: 1000, alis_fiyati: 99, alis_tarihi: "2026-01-02" }) });
kontrol("A kendi pozisyonunu yazabiliyor", r.status === 201, `HTTP ${r.status}`);
r = await B("positions?isin=eq.TRT_RLS_TEST&select=*");
kontrol("B, A'nin pozisyonunu GOREMIYOR", Array.isArray(r.body) && r.body.length === 0, `donen satir: ${r.body?.length}`);
r = await B("positions", { method: "POST", body: JSON.stringify({ user_id: a.uid, isin: "SAHTE", nominal: 1, alis_fiyati: 1, alis_tarihi: "2026-01-02" }) });
kontrol("B, A adina pozisyon EKLEYEMIYOR", r.status >= 400, `HTTP ${r.status}`);

// --- auction_tracks / auction_orders ---
r = await A("auction_tracks", { method: "POST", body: JSON.stringify({ user_id: a.uid, isin: "TRT_RLS_TEST", ihale_tarihi: "2026-01-02" }) });
const trackId = Array.isArray(r.body) ? r.body[0]?.id : null;
kontrol("A kendi ihale takibini yazabiliyor", r.status === 201 && !!trackId, `HTTP ${r.status}`);
if (trackId) {
  r = await A("auction_orders", { method: "POST", body: JSON.stringify({ track_id: trackId, fiyat: 98.5, nominal: 500 }) });
  kontrol("A kendi takibine emir ekleyebiliyor", r.status === 201, `HTTP ${r.status}`);
  r = await B(`auction_orders?track_id=eq.${trackId}&select=*`);
  kontrol("B, A'nin emirlerini GOREMIYOR", Array.isArray(r.body) && r.body.length === 0, `donen satir: ${r.body?.length}`);
  r = await B("auction_orders", { method: "POST", body: JSON.stringify({ track_id: trackId, fiyat: 1, nominal: 1 }) });
  kontrol("B, A'nin takibine emir EKLEYEMIYOR", r.status >= 400, `HTTP ${r.status}`);
}

// --- temizlik ---
await A("watchlist?isin=eq.TRT_RLS_TEST", { method: "DELETE" });
await A("positions?isin=eq.TRT_RLS_TEST", { method: "DELETE" });
await A("auction_tracks?isin=eq.TRT_RLS_TEST", { method: "DELETE" });
const kalan = await A("watchlist?isin=eq.TRT_RLS_TEST&select=*");
console.log("\ntemizlik sonrasi kalan test satiri:", kalan.body?.length ?? "?");
const kaldi = sonuc.filter(s => !s.gecti);
console.log(`\nSONUC: ${sonuc.length - kaldi.length}/${sonuc.length} gecti`);
if (kaldi.length) process.exit(1);
