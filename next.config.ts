import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/**/*", "./docs/**/*", "./src/db/**/*"],
    "/**/*": ["./data/**/*", "./docs/**/*", "./src/db/**/*"],
  },
};

export default nextConfig;
