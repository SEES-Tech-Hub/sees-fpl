// Live scores: cache tags.
//
// If you cache live data with 'use cache' (for example a sport page's list of
// fixtures), tag it with one of these. The console actions expire them after
// every write. The match page reads (queries.ts) are not cached, and open
// pages are kept fresh by Realtime (see realtime.ts).
export const liveTags = {
  /** One fixture: its score, clock, timeline and lineups. */
  fixture: (fixtureId: string) => `live:fixture:${fixtureId}`,
  /** Any list of fixtures (home page "Live now", sport pages, fixtures by date). */
  fixtureList: "live:fixtures",
  /** League tables and stats pages (phase 2). */
  standings: "live:standings",
} as const;
