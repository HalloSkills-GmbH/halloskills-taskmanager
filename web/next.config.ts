import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  /**
   * Dev: kein Filesystem-Webpack-Cache (stabiler Fast Refresh).
   * Production: nur Memory-Cache — vermeidet häufige „Cannot find module './611.js'“-Fehler,
   * wenn der persistente Webpack-Cache unter `.next/cache` mit dem Output verdriftet
   * (abgebrochene Builds, parallel `dev` + `start`, IDE/Tooling).
   */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    } else {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default nextConfig;
