import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { liveTags } from "@/lib/live/tags";
import { adminTags } from "./tags";

// Owner: admin backend. What each kind of change expires. Call only from
// Server Actions (updateTag works nowhere else).

type Area = "players" | "teams" | "sports" | "fixtures" | "matchdays" | "officials" | "announcements" | "audit";

const PATHS: Record<Area, string[]> = {
  players: ["/admin/players"],
  teams: ["/admin/teams"],
  sports: ["/admin/sports"],
  fixtures: ["/admin/fixtures", "/admin/officials"],
  matchdays: ["/admin/matchdays"],
  officials: ["/admin/officials", "/admin/fixtures"],
  announcements: ["/admin/announcements", "/"],
  audit: ["/admin/audit"],
};

const TAGS: Record<Area, string[]> = {
  players: [adminTags.players],
  teams: [adminTags.teams],
  sports: [adminTags.sports],
  fixtures: [adminTags.fixtures, liveTags.fixtureList, liveTags.standings],
  matchdays: [adminTags.matchdays],
  officials: [adminTags.fixtures],
  announcements: [adminTags.announcements],
  audit: [],
};

/** Expires the tags and admin pages for the areas that changed, plus the dashboard and audit log. */
export function expire(areas: Area[], fixtureIds: string[] = []) {
  const tags = new Set<string>([adminTags.dashboard]);
  const paths = new Set<string>(["/admin", "/admin/audit"]);
  for (const area of areas) {
    TAGS[area].forEach((t) => tags.add(t));
    PATHS[area].forEach((p) => paths.add(p));
  }
  for (const fixtureId of fixtureIds) {
    tags.add(adminTags.fixture(fixtureId));
    tags.add(liveTags.fixture(fixtureId));
  }
  tags.forEach((tag) => updateTag(tag));
  paths.forEach((path) => revalidatePath(path));
}
