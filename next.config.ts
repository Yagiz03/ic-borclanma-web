import path from "node:path";
import type { NextConfig } from "next";

/**
 * Güvenlik başlıkları. Vercel varsayılan olarak yalnızca HSTS gönderiyordu;
 * aşağıdakiler yayın öncesi kontrol listesinin "güvenlik başlıkları" maddesi.
 *
 * CSP burada BİLİNÇLİ olarak dar tutuldu: yalnızca `frame-ancestors`.
 * Next.js'in kendi inline script/style'ları ve Recharts'ın ürettiği stiller
 * yüzünden tam bir `script-src`/`style-src` politikası nonce altyapısı
 * kurulmadan siteyi kırar -- çalışmayan bir CSP, olmayandan daha kötüdür.
 * `frame-ancestors 'none'` clickjacking'i tek başına kapatıyor (X-Frame-Options
 * eski tarayıcılar için yedek olarak duruyor).
 */
const GUVENLIK_BASLIKLARI = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Sitenin hiçbiri gerekmiyor -- üçüncü taraf bir script yüklense bile
  // kamera/mikrofon/konum isteyemesin.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // Ev dizininde alakasız bir package-lock.json bulunduğundan Turbopack
  // workspace kökünü belirsiz buluyordu -- burayı açıkça sabitliyoruz.
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [{ source: "/:path*", headers: GUVENLIK_BASLIKLARI }];
  },
};

export default nextConfig;
