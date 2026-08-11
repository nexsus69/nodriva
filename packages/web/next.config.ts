import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Keep the production build deterministic until the compiler is validated
  // independently; it currently causes Turbopack to stall during compilation.
  reactCompiler: false,
  output: 'standalone',
  allowedDevOrigins: ['192.168.3.247'],
};

export default nextConfig;
