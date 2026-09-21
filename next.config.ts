import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Ensure NEXTAUTH_SECRET is always available, even without an .env file.
// This runs in the Node.js context (not the Edge runtime), so filesystem I/O
// is fine.  We inject it via the `env` key so that Next.js bakes it into
// every runtime, including the Edge middleware.
// ---------------------------------------------------------------------------
function resolveAuthSecret(): string {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;

  const runtimeDir = join(process.cwd(), ".runtime");
  const secretPath = join(runtimeDir, "auth-secret.json");

  if (existsSync(secretPath)) {
    try {
      const parsed = JSON.parse(readFileSync(secretPath, "utf8")) as {
        secret: string;
      };
      if (parsed?.secret) return parsed.secret;
    } catch {
      // fall through to generate
    }
  }

  const newSecret = randomBytes(64).toString("hex");
  try {
    mkdirSync(runtimeDir, { recursive: true });
    writeFileSync(
      secretPath,
      JSON.stringify({ secret: newSecret }, null, 2) + "\n",
      "utf8",
    );
    console.log(
      "[next.config] Generated new NEXTAUTH_SECRET → .runtime/auth-secret.json",
    );
  } catch (err) {
    console.error("[next.config] Failed to persist auth secret:", err);
  }
  return newSecret;
}

// ---------------------------------------------------------------------------
// Resolve the canonical public URL for this deployment.
// Priority: NEXTAUTH_URL env var → .runtime/app-config.json → undefined.
// When resolved from the file, we also back-fill process.env.NEXTAUTH_URL so
// the rest of this config file (e.g. the redirects() block) can read it.
// ---------------------------------------------------------------------------
function resolveAppUrl(): string | undefined {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;

  const appConfigPath = join(process.cwd(), ".runtime", "app-config.json");
  if (existsSync(appConfigPath)) {
    try {
      const parsed = JSON.parse(readFileSync(appConfigPath, "utf8")) as {
        appUrl?: string;
      };
      if (parsed?.appUrl) {
        process.env.NEXTAUTH_URL = parsed.appUrl;
        console.log(
          `[next.config] Loaded NEXTAUTH_URL from .runtime/app-config.json → ${parsed.appUrl}`,
        );
        return parsed.appUrl;
      }
    } catch {
      // fall through — URL not yet configured (setup wizard hasn't run yet)
    }
  }

  return undefined;
}

const authSecret = resolveAuthSecret();
const appUrl = resolveAppUrl();

const nextConfig: NextConfig = {
  // Inject the auth secret, trust host flag, and (if known) the canonical app
  // URL so every runtime (including Edge middleware) can read them without
  // needing manual .env configuration.
  env: {
    NEXTAUTH_SECRET: authSecret,
    AUTH_SECRET: authSecret,
    AUTH_TRUST_HOST: "true",
    ...(appUrl ? { NEXTAUTH_URL: appUrl, AUTH_URL: appUrl } : {}),
  },
  output: "standalone",
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
