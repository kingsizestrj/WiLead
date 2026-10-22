import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Loaded at runtime by Node (its optional source-map-support require breaks bundling)
  serverExternalPackages: ["node-routeros"],
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
};

export default nextConfig;
