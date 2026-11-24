import type { MetadataRoute } from "next";
import { getFixtureCards } from "@/lib/live/fixture-cards";
import { getSports } from "@/lib/live/public-pages";
import { siteBase } from "@/lib/seo";

// Every public page search engines should know about: the main sections,
// each sport, and each match. Signed-in pages are left out (see robots.ts).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBase();
  const [sports, cards] = await Promise.all([getSports(), getFixtureCards()]);
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) => ({
    url: `${base}${path}`,
    priority,
    changeFrequency,
  });
  return [
    page("/", 1, "hourly"),
    page("/tables", 0.9, "hourly"),
    page("/sports", 0.8, "daily"),
    page("/fantasy", 0.8, "daily"),
    page("/fantasy/rankings", 0.6, "daily"),
    page("/fantasy/rules", 0.5, "weekly"),
    page("/privacy", 0.2, "yearly"),
    ...sports.map((s) => page(`/sports/${s.slug}`, 0.7, "daily")),
    ...cards.map((c) => ({ ...page(`/matches/${c.id}`, 0.6, "hourly"), lastModified: c.state.updatedAt })),
  ];
}
