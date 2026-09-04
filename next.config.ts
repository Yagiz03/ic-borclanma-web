import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ev dizininde alakasız bir package-lock.json bulunduğundan Turbopack
  // workspace kökünü belirsiz buluyordu -- burayı açıkça sabitliyoruz.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
