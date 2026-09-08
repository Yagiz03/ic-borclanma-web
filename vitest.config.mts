import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest yapılandırması. İki tür test bir arada:
 *  - golden.test.ts  -> saf matematik, Python çıktılarına karşı doğrulanır
 *  - render.test.tsx -> bileşen render'ı (jsdom + Testing Library)
 *
 * JSX'i esbuild dönüştürüyor (tsconfig'de jsx: "react-jsx") -- @vitejs/plugin-react
 * KURULMADI: shadcn'in @babel/core 7 bağımlılığıyla çakışıyor ve React 19'un
 * otomatik JSX runtime'ı için gereksiz.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
