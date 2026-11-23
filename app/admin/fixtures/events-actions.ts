"use server";

import { requireRole } from "@/lib/auth";
import { getMatchTimeline } from "@/lib/live/queries";
import type { TimelineEntry } from "@/lib/live/types";

/** A fixture's recorded (not voided) events, for the admin's corrections list. */
export async function loadFixtureEvents(fixtureId: string): Promise<TimelineEntry[]> {
  await requireRole("admin");
  return getMatchTimeline(fixtureId);
}
