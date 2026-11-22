import "server-only";
import { cache } from "react";
import { z } from "zod";
import { parseInput } from "../schemas";
import { adminReadClient, throwReadError } from "../server";
import type { AppRole } from "../types";

// Owner: admin backend. Accounts for the officials page (PRD admin item 5).
// Emails are shown to the admin only (RLS: admins read all profiles); never log them.

export type AdminProfile = {
  id: string;
  displayName: string | null;
  email: string | null;
  role: AppRole;
  createdAt: string;
};

type ProfileRow = { id: string; display_name: string | null; email: string | null; role: AppRole; created_at: string };

const toProfile = (row: ProfileRow): AdminProfile => ({
  id: row.id,
  displayName: row.display_name,
  email: row.email,
  role: row.role,
  createdAt: row.created_at,
});

export const listProfilesFilter = z
  .object({
    /** Matches name or email. */
    search: z.string().trim().max(80).optional(),
    role: z.enum(["user", "official", "admin"]).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .default({ limit: 50 });

/** Signed-in accounts, newest first, to find someone to promote. Search by name or email. */
export const listProfiles = cache(async (filter?: z.input<typeof listProfilesFilter>): Promise<AdminProfile[]> => {
  const parsed = parseInput(listProfilesFilter, filter ?? {});
  const f = parsed.ok ? parsed.data : { limit: 50 };
  const { supabase } = await adminReadClient();

  let query = supabase.from("profiles").select("id, display_name, email, role, created_at");
  if (f.role) query = query.eq("role", f.role);
  if (f.search) {
    const term = f.search.replace(/[%_,()]/g, " ").trim();
    if (term) query = query.or(`display_name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(f.limit);
  if (error) throwReadError("accounts", error);
  return ((data ?? []) as ProfileRow[]).map(toProfile);
});

/** Every official and admin account (who can hold a console), by name. */
export const listOfficials = cache(async (): Promise<AdminProfile[]> => {
  const { supabase } = await adminReadClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, role, created_at")
    .in("role", ["official", "admin"])
    .order("display_name");
  if (error) throwReadError("officials", error);
  return ((data ?? []) as ProfileRow[]).map(toProfile);
});
