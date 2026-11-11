import { createSerwistRoute } from "@serwist/turbopack";

// Emit the worker at build time so standalone deployments need no source files.
export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export const { GET, generateStaticParams } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
  // Serwist bundles independently of Next.js, so it must inline the public
  // configuration itself. A worker has no Node.js `process` global.
  esbuildOptions: {
    define: Object.fromEntries([
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_APP_NAME",
      "NEXT_PUBLIC_APP_SHORT_NAME",
      "NEXT_PUBLIC_APP_DESCRIPTION",
      "NEXT_PUBLIC_APP_LOGO",
      "NEXT_PUBLIC_APP_LOGO_DARK",
      "NEXT_PUBLIC_ORGANIZATION_NAME",
      "NEXT_PUBLIC_ORGANIZATION_URL",
    ].map((key) => [`process.env.${key}`, JSON.stringify(process.env[key] ?? "")])),
  },
  additionalPrecacheEntries: [
    // Only precache pages that don't require auth — auth-required pages
    // (dashboard, scout/*) are cached at runtime via the OfflinePrecache
    // component so the SW stores the *authenticated* HTML.
    { url: "/login", revision: Date.now().toString() },
    { url: "/signup", revision: Date.now().toString() },
  ],
});
