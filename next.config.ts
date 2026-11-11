import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  output: "standalone",
  // Azure credentials use native process helpers that cannot be bundled on Windows.
  serverExternalPackages: ["@azure/identity"],
  // Deployment credentials and mutable state must never enter release artifacts.
  outputFileTracingExcludes: { "/*": ["./.runtime/**/*", "./.env*"] },
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    webpackMemoryOptimizations: true,
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
    ],
  },
  // Empty Turbopack config to silence Next.js 16 warning
  // The webpack config below will still be used when needed
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Exclude database service from client-side bundles
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        // Add Node.js built-in modules
        "node:stream": false,
        "node:url": false,
        "node:crypto": false,
        "node:buffer": false,
        "node:util": false,
      };

      // Exclude mssql and related packages from client bundle
      config.externals = config.externals || [];
      config.externals.push({
        mssql: "mssql",
        tedious: "tedious",
        "node:stream": "node:stream",
        "node:url": "node:url",
      });
    }

    return config;
  },
};

export default withSerwist(nextConfig);
