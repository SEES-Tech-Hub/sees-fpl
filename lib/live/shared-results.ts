import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getChampionshipProgress, getMedalTable } from "./results";
import { liveTags } from "./tags";

// The medal table and the championship progress, as the home and
// championship pages show them: the same for everyone, so read once into the
// shared cache (every server instance uses the same copy) instead of on every
// visit. They refresh once a minute and when a result or a correction lands
// (liveTags.standings).

export async function sharedMedalTable() {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  cacheTag(liveTags.standings);
  return getMedalTable();
}

export async function sharedChampionshipProgress() {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  cacheTag(liveTags.standings);
  return getChampionshipProgress();
}
