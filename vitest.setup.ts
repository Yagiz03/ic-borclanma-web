import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

// Recharts ResponsiveContainer jsdom'da 0x0 ölçer ve hiçbir şey çizmez;
// grafik testleri için sabit bir boyut taklit ediliyor.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom scrollIntoView'i uygulamıyor; klavyeyle gezilen listeler (Combobox)
// vurguyu görünür kılmak için onu çağırıyor.
Element.prototype.scrollIntoView ??= () => {};

// next/navigation, test ortamında router bağlamı olmadan patlıyor.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard/ihale-detay",
}));
