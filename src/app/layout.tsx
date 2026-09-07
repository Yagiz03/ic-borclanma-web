import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

// Gövde yazı tipi artık sistem fontu (bkz. globals.css --font-sans) --
// sadece finansal rakamlar (font-figures) için Geist Mono kalıyor.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "İç Borçlanma Dashboard",
  description: "Türkiye Hazine iç borçlanma senetleri (DİBS) takip paneli",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
