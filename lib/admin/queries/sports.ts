import "server-only";
import { cache } from "react";
import { adminReadClient, throwReadError } from "../server";
import type { ResultFormat } from "../types";

// Owner: admin backend. Sports, events and teams for the admin portal
// (PRD admin items 1 and 2).

export type AdminEvent = {
  id: string;
  sportId: string;
  slug: string;
  name: string;
  periodMinutes: number | null;
  periodCount: number | null;
  extraPeriodMinutes: number | null;
  fixtureCount: number;
};

export type AdminSport = {
  id: string;
  slug: string;
  name: string;
  resultFormat: ResultFormat;
  sortOrder: number;
  events: AdminEvent[];
};

export type AdminTeam = {
  id: string;
  year: number;
  name: string;
  shortName: string;
  classLabel: string;
  coaches: string[];
};

export type EventRow = {
  id: string;
  sport_id: string;
  slug: string;
  name: string;
  period_minutes: number | null;
  period_count: number | null;
  extra_period_minutes: number | null;
  fixtures?: { count: number }[];
};

export const toAdminEvent = (row: EventRow): AdminEvent => ({
  id: row.id,
  sportId: row.sport_id,
  slug: row.slug,
  name: row.name,
  periodMinutes: row.period_minutes,
  periodCount: row.period_count,
  extraPeriodMinutes: row.extra_period_minutes,
  fixtureCount: row.fixtures?.[0]?.count ?? 0,
});

export const toAdminTeam = (row: {
  id: string;
  year: number;
  name: string;
  short_name: string;
  class_label: string;
  coaches: string[];
}): AdminTeam => ({
  id: row.id,
  year: row.year,
  name: row.name,
  shortName: row.short_name,
  classLabel: row.class_label,
  coaches: row.coaches,
});

/** All sports in display order, each with its events (and how many fixtures each event has). */
export const listSports = cache(async (): Promise<AdminSport[]> => {
  const { supabase } = await adminReadClient();
  const { data, error } = await supabase
    .from("sports")
    .select(
      "id, slug, name, result_format, sort_order, events ( id, sport_id, slug, name, period_minutes, period_count, extra_period_minutes, fixtures ( count ) )",
    )
    .order("sort_order")
    .order("name");
  if (error) throwReadError("sports", error);
  return (data ?? []).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    resultFormat: s.result_format,
    sortOrder: s.sort_order,
    events: ((s.events ?? []) as EventRow[]).map(toAdminEvent).sort((a, b) => a.name.localeCompare(b.name, "en")),
  }));
});

/** The five year teams, by year. */
export const listTeams = cache(async (): Promise<AdminTeam[]> => {
  const { supabase } = await adminReadClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, year, name, short_name, class_label, coaches")
    .order("year");
  if (error) throwReadError("teams", error);
  return (data ?? []).map(toAdminTeam);
});
