import type { MetadataRoute } from "next";
import { siteBase } from "@/lib/seo";

// Public pages are open to search engines; admin, the console, the API and
// the signed-in fantasy screens are not.
export default function robots(): MetadataRoute.Robots {
  const base = siteBase();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/console",
        "/api/",
        "/auth/",
        "/login",
        "/offline",
        "/fantasy/squad",
        "/fantasy/team",
        "/fantasy/transfers",
        "/fantasy/points",
        "/fantasy/leagues",
        "/fantasy/join",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
