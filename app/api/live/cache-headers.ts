// Vercel's CDN keeps each live response for 4 s, then serves the old copy for
// up to 4 s more while it fetches a new one. Browsers don't cache it at all,
// so every poll reaches the CDN. See lib/live/live-state.ts.
export const LIVE_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "CDN-Cache-Control": "public, s-maxage=4, stale-while-revalidate=4",
  "Vercel-CDN-Cache-Control": "public, s-maxage=4, stale-while-revalidate=4",
};
