// Owner: admin backend. Cache tags that admin actions expire with updateTag()
// (Server Actions only; see node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md).
//
// Tag a public 'use cache' read with these (cacheTag(adminTags.players)) and
// admin changes reach it immediately. Admin pages themselves read with the
// signed-in client (cookies), so they are never in a 'use cache' scope; actions
// refresh them with revalidatePath instead.
//
// Fixture changes also expire Bolu's liveTags.fixtureList (lib/live/tags.ts)
// once his API is on main.

export const adminTags = {
  teams: "teams",
  players: "players",
  sports: "sports",
  fixtures: "fixtures",
  fixture: (fixtureId: string) => `fixture:${fixtureId}`,
  matchdays: "matchdays",
  announcements: "announcements",
  dashboard: "dashboard",
} as const;
