import "server-only";
import { redirect } from "next/navigation";
import { getMyManager, getMyTeam, requireFantasyUser } from "./api";

// Page guards. Call inside a <Suspense> boundary (they read cookies).

/** Signed in and has joined fantasy; otherwise off to sign-in or onboarding. */
export async function requireManager(nextPath: string) {
  const user = await requireFantasyUser(nextPath);
  const manager = await getMyManager(user);
  if (!manager) redirect("/fantasy/squad");
  return { user, manager };
}

/** As requireManager, and has picked a squad; otherwise off to the squad builder. */
export async function requireSquad(nextPath: string) {
  const { user, manager } = await requireManager(nextPath);
  const team = await getMyTeam(user);
  if (!team) redirect("/fantasy/squad");
  return { user, manager, team };
}
