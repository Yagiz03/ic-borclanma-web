import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

// Gövde yazı tipi: sistem fontu (-apple-system) yerine Inter -- Windows/Linux'ta
// sistem fontu tutarsız/okunması güç görünebiliyor, Inter her platformda aynı,
// yüksek okunabilirlikte render ediyor (bkz. globals.css --font-sans).
// Finansal rakamlar (font-figures) artık Geist Mono değil, sistem monospace
// fontu (ui-monospace/SF Mono/Consolas) kullanıyor -- Geist Mono'nun "0"
// rakamını çizgili (slashed zero) çizmesi okunabilirlik şikayetine yol açtı.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Türkiye Tahvil ve Bono Terminali",
  description:
    "Hazine iç borçlanma senetleri (DİBS), ihale sonuçları, getiri eğrisi ve tahvil fiyatlama terminali.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
