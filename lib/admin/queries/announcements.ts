import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/live/public-client";
import { adminTags } from "../tags";
import { adminReadClient, throwReadError } from "../server";

// Owner: admin backend. The home page banner (PRD admin item 8).

export type Announcement = {
  id: string;
  message: string;
  tone: "info" | "warning";
  startsAt: string;
  endsAt: string;
};

export type AdminAnnouncement = Announcement & {
  createdBy: string | null;
  createdAt: string;
  /** Where it is now, from the server clock. */
  state: "scheduled" | "showing" | "ended";
};

type Row = { id: string; message: string; tone: string; starts_at: string; ends_at: string };

const toAnnouncement = (row: Row): Announcement => ({
  id: row.id,
  message: row.message,
  tone: row.tone === "warning" ? "warning" : "info",
  startsAt: row.starts_at,
  endsAt: row.ends_at,
});

/**
 * For Fortune's home page: the banner showing now, or null. Public data, read
 * as an anonymous visitor (row-level security returns only the banner inside
 * its window), and cached: admin changes expire it at once; otherwise a banner
 * appears or disappears within about a minute of its start and end times.
 * If several overlap, the one that started last wins.
 */
export async function getActiveAnnouncement(): Promise<Announcement | null> {
  "use cache: remote";
  cacheTag(adminTags.announcements);
  cacheLife({ stale: 60, revalidate: 60, expire: 300 });

  const { data, error } = await createPublicClient()
    .from("announcements")
    .select("id, message, tone, starts_at, ends_at")
    .order("starts_at", { ascending: false })
    .limit(1);
  if (error) {
    // The home page must never break because of the banner.
    console.error("[admin] active announcement read failed", { sqlstate: error.code ?? null });
    return null;
  }
  const row = data?.[0];
  return row ? toAnnouncement(row) : null;
}

/** Every banner, newest first, for the admin page. */
export const listAnnouncements = cache(async (): Promise<AdminAnnouncement[]> => {
  const { supabase } = await adminReadClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, message, tone, starts_at, ends_at, created_by, created_at")
    .order("starts_at", { ascending: false })
    .limit(100);
  if (error) throwReadError("announcements", error);
  const now = Date.now();
  return (data ?? []).map((row) => {
    const base = toAnnouncement(row);
    const state: AdminAnnouncement["state"] =
      new Date(row.starts_at).getTime() > now ? "scheduled" : new Date(row.ends_at).getTime() <= now ? "ended" : "showing";
    return { ...base, createdBy: row.created_by, createdAt: row.created_at, state };
  });
});
