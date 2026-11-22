import "server-only";
import { cache } from "react";
import { decodeAuditCursor, encodeAuditCursor, summariseAuditEntry } from "../domain/audit";
import { auditLogFilter, parseInput } from "../schemas";
import { adminReadClient, throwReadError } from "../server";
import type { z } from "zod";

// Owner: admin backend. The audit log page (PRD admin item 9), over
// admin_audit_page(): audit_log plus match event corrections, newest first,
// keyset-paginated (no offsets, so new rows never shift a page).

export type AuditEntry = {
  /** Unique across both sources; use as the React key. */
  key: string;
  source: "audit" | "match_void" | "match_record";
  occurredAt: string;
  actorId: string | null;
  /** Display name, falling back to email (admins only see this page). Null for SQL editor changes. */
  actorName: string | null;
  tableName: string;
  rowId: string;
  action: "insert" | "update" | "delete" | "void" | "record";
  old: unknown;
  new: unknown;
  /** e.g. { importId } or { reason } or { action: "set_role" }. */
  context: unknown;
  /** One line in plain words, e.g. "Player: status available → injured". */
  summary: string;
};

export type AuditPage = { entries: AuditEntry[]; nextCursor: string | null };

/**
 * One page of the audit log. Filters: table (e.g. "players", "match_events"),
 * actorId, from and to (ISO). Pass the previous page's nextCursor for the next one.
 */
export const getAuditLog = cache(async (filter?: z.input<typeof auditLogFilter>): Promise<AuditPage> => {
  const parsed = parseInput(auditLogFilter, filter ?? {});
  if (!parsed.ok) throw new Error(parsed.result.ok ? "Invalid filter" : parsed.result.error.message);
  const f = parsed.data;
  // admin_audit_page returns at most 100 rows, and one extra is fetched below.
  const limit = Math.min(f.limit, 99);
  const cursor = f.cursor ? decodeAuditCursor(f.cursor) : null;
  if (f.cursor && !cursor) throw new Error("That page link is out of date. Go back to the first page.");

  const { supabase } = await adminReadClient();
  const { data, error } = await supabase.rpc("admin_audit_page", {
    ...(f.table ? { p_table: f.table } : {}),
    ...(f.actorId ? { p_actor: f.actorId } : {}),
    ...(f.from ? { p_from: f.from } : {}),
    ...(f.to ? { p_to: f.to } : {}),
    ...(cursor ? { p_before_at: cursor.at, p_before_source: cursor.source, p_before_id: cursor.id } : {}),
    // One extra row tells us whether there's another page.
    p_limit: limit + 1,
  });
  if (error) throwReadError("the audit log", error);

  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const entries: AuditEntry[] = page.map((row) => {
    const entry = {
      tableName: row.table_name,
      action: row.action,
      old: row.old,
      new: row.new,
      context: row.context,
    };
    return {
      key: `${row.source}:${row.id}`,
      source: row.source as AuditEntry["source"],
      occurredAt: row.occurred_at,
      actorId: row.actor ?? null,
      actorName: row.actor_name ?? null,
      tableName: row.table_name,
      rowId: row.row_id,
      action: row.action as AuditEntry["action"],
      old: row.old,
      new: row.new,
      context: row.context,
      summary: summariseAuditEntry(entry),
    };
  });

  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last ? encodeAuditCursor({ at: last.occurred_at, source: last.source, id: last.id }) : null;
  return { entries, nextCursor };
});
