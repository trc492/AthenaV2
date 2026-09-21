import { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/app-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/", "/scout/", "/login", "/signup"],
    },
    sitemap: `${getPublicAppUrl()}/sitemap.xml`,
  };
}
