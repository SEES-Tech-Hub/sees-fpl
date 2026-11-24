import type { Metadata } from "next";

// One place for page metadata, so every public page gets a unique title and
// description, a canonical URL, og:url and the site name. (Next doesn't
// deep-merge openGraph between layouts and pages, so pages set it whole here.)
// Share images come from opengraph-image files next to the pages.

export const SITE_NAME = "SEES Games Hub";
export const SITE_DESCRIPTION =
  "Live scores, tables and results from SEES Games 2026 at the University of Lagos, plus SEES Fantasy, the free fantasy football game for the SEES year teams.";

export function pageMeta({
  title,
  description,
  path,
  noindex,
}: {
  /** Shown as "<title> · SEES Games Hub". */
  title: string;
  description: string;
  /** The page's path, like "/tables". */
  path: string;
  /** Signed-in or private pages: keep them out of search results. */
  noindex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_NG",
      url: path,
      title: `${title} · ${SITE_NAME}`,
      description,
    },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE_NAME}`, description },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** For pages that only signed-in people use: a title and no indexing. */
export const privatePage = (title: string): Metadata => ({ title, robots: { index: false, follow: false } });

/**
 * The site's address for sitemaps and robots.txt: NEXT_PUBLIC_SITE_URL (with
 * or without https://), else the Vercel deployment, else localhost. Never throws.
 */
export function siteBase(): string {
  for (const raw of [process.env.NEXT_PUBLIC_SITE_URL, process.env.VERCEL_URL]) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      return new URL(/^https?:\/\//.test(value) ? value : `https://${value}`).origin;
    } catch {
      // Try the next one.
    }
  }
  return "http://localhost:3000";
}
