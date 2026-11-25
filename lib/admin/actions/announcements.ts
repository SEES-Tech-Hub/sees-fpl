"use server";

import { after } from "next/server";
import { notifyAnnouncement } from "@/lib/push/send";
import type { Announcement } from "../queries/announcements";
import { fail, ok, type ActionResult } from "../result";
import { expire } from "../revalidate";
import { announcementIdInput, announcementInput, parseInput, updateAnnouncementInput } from "../schemas";
import { databaseFailure, runAdminAction } from "../server";

// Owner: admin backend. Home page banners (PRD admin item 8). Times are ISO
// strings with an offset; convert WAT input with watToUtc.

type Row = { id: string; message: string; tone: string; starts_at: string; ends_at: string };
const FIELDS = "id, message, tone, starts_at, ends_at";

const toAnnouncement = (row: Row): Announcement => ({
  id: row.id,
  message: row.message,
  tone: row.tone === "warning" ? "warning" : "info",
  startsAt: row.starts_at,
  endsAt: row.ends_at,
});

/** e.g. { message: "Matchday 2 kickoff moved to 4 pm", tone: "warning", startsAt, endsAt }. */
export async function createAnnouncement(input: unknown): Promise<ActionResult<Announcement>> {
  return runAdminAction("announcements.create", async ({ supabase }) => {
    const parsed = parseInput(announcementInput, input);
    if (!parsed.ok) return parsed.result;
    const v = parsed.data;

    const { data, error } = await supabase
      .from("announcements")
      .insert({ message: v.message, tone: v.tone, starts_at: v.startsAt, ends_at: v.endsAt })
      .select(FIELDS)
      .single();
    if (error || !data) return databaseFailure("announcements.create", error);

    expire(["announcements"]);
    const announcement = toAnnouncement(data);
    // Live now: push it to everyone with notifications on (after the admin has their answer).
    const now = Date.now();
    if (Date.parse(announcement.startsAt) <= now + 60_000 && Date.parse(announcement.endsAt) > now) {
      after(() => notifyAnnouncement(announcement).catch((e) => console.error("[push] announcement failed:", e)));
    }
    return ok(announcement);
  });
}

export async function updateAnnouncement(input: unknown): Promise<ActionResult<Announcement>> {
  return runAdminAction("announcements.update", async ({ supabase }) => {
    const parsed = parseInput(updateAnnouncementInput, input);
    if (!parsed.ok) return parsed.result;
    const v = parsed.data;

    const { data, error } = await supabase
      .from("announcements")
      .update({ message: v.message, tone: v.tone, starts_at: v.startsAt, ends_at: v.endsAt })
      .eq("id", v.announcementId)
      .select(FIELDS)
      .single();
    if (error || !data) return databaseFailure("announcements.update", error, { announcementId: v.announcementId });

    expire(["announcements"]);
    return ok(toAnnouncement(data));
  });
}

/**
 * Takes a banner down now. A banner that hasn't started yet is removed; one
 * that's showing ends now (it stays in the list and the audit log). Ending one
 * that has already ended does nothing.
 */
export async function endAnnouncement(input: unknown): Promise<ActionResult<{ id: string; removed: boolean }>> {
  return runAdminAction("announcements.end", async ({ supabase }) => {
    const parsed = parseInput(announcementIdInput, input);
    if (!parsed.ok) return parsed.result;
    const { announcementId } = parsed.data;

    const { data: current, error: readError } = await supabase
      .from("announcements")
      .select("starts_at, ends_at")
      .eq("id", announcementId)
      .maybeSingle();
    if (readError) return databaseFailure("announcements.end", readError, { announcementId });
    if (!current) return fail("admin.not_found", "That announcement wasn't found.");

    const now = new Date();
    if (new Date(current.ends_at) <= now) return ok({ id: announcementId, removed: false });

    if (new Date(current.starts_at) >= now) {
      const { error } = await supabase.from("announcements").delete().eq("id", announcementId);
      if (error) return databaseFailure("announcements.end", error, { announcementId });
      expire(["announcements"]);
      return ok({ id: announcementId, removed: true });
    }

    const { error } = await supabase.from("announcements").update({ ends_at: now.toISOString() }).eq("id", announcementId);
    if (error) return databaseFailure("announcements.end", error, { announcementId });
    expire(["announcements"]);
    return ok({ id: announcementId, removed: false });
  });
}
