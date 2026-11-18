import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Owner: Tayo. Shared by every area; see "Functions people call across areas"
// in the team task plan. Call these from Server Components (inside
// <Suspense>, because they read cookies), Server Actions and Route Handlers.

export type AppRole = "user" | "official" | "admin";

export type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: AppRole;
  year_group: number | null;
  created_at: string;
};

export type CurrentUser = {
  user: { id: string; email?: string };
  profile: Profile;
};

/**
 * The signed-in user and their profile, or null when signed out.
 * Cached per request, so calling it in several components costs one lookup.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url, role, year_group, created_at")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return { user: { id: user.id, email: user.email }, profile: profile as Profile };
});

/** True when `role` meets `required`. Admins pass every check. */
export function hasRole(role: AppRole | undefined, required: "official" | "admin") {
  if (role === "admin") return true;
  return required === "official" && role === "official";
}

/**
 * For admin and console pages and actions. Anyone without the role gets the
 * not-found page, so the area's existence isn't revealed.
 */
export async function requireRole(required: "official" | "admin"): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current || !hasRole(current.profile.role, required)) notFound();
  return current;
}

/**
 * For pages that need any signed-in user (e.g. fantasy). Sends signed-out
 * visitors to sign in, then back to `nextPath`.
 */
export async function requireSignedIn(nextPath: string): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return current;
}
