// Plain-words summaries of audit entries for the audit page, e.g.
// "players: status available → injured". Pure, so it's tested.

export type AuditChange = { field: string; from: unknown; to: unknown };

const TABLE_LABELS: Record<string, string> = {
  players: "Player",
  teams: "Team",
  sports: "Sport",
  events: "Event",
  matchdays: "Matchday",
  fixtures: "Fixture",
  profiles: "Account",
  announcements: "Announcement",
  match_events: "Match event",
};

export function tableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** The fields that changed, from an entry's old and new values (changed columns only for updates). */
export function auditChanges(oldValue: unknown, newValue: unknown): AuditChange[] {
  const before = asObject(oldValue);
  const after = asObject(newValue);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return fields
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map((field) => ({ field, from: before[field] ?? null, to: after[field] ?? null }));
}

function show(value: unknown): string {
  if (value === null || value === undefined) return "none";
  if (typeof value === "string") return value.length > 40 ? `${value.slice(0, 37)}...` : value;
  return JSON.stringify(value);
}

/** One line for the audit list. */
export function summariseAuditEntry(entry: {
  tableName: string;
  action: string;
  old: unknown;
  new: unknown;
  context: unknown;
}): string {
  const label = tableLabel(entry.tableName);
  const context = asObject(entry.context);
  if (entry.action === "void") {
    const reason = typeof context.reason === "string" ? context.reason : "no reason";
    return `${label} voided: ${reason}`;
  }
  if (entry.action === "record") {
    const type = asObject(entry.new).type;
    return `${label} recorded by the admin: ${show(type)}`;
  }
  if (entry.action === "insert") return `${label} added`;
  if (entry.action === "delete") return `${label} removed`;
  const changes = auditChanges(entry.old, entry.new);
  if (changes.length === 0) return `${label} updated`;
  return `${label}: ${changes.map((c) => `${c.field} ${show(c.from)} → ${show(c.to)}`).join(", ")}`;
}

/** Opaque keyset cursor for the audit feed. */
export type AuditCursor = { at: string; source: string; id: number };

export function encodeAuditCursor(cursor: AuditCursor): string {
  return Buffer.from(JSON.stringify([cursor.at, cursor.source, cursor.id])).toString("base64url");
}

export function decodeAuditCursor(text: string): AuditCursor | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
    if (!Array.isArray(value) || value.length !== 3) return null;
    const [at, source, id] = value;
    if (typeof at !== "string" || Number.isNaN(new Date(at).getTime())) return null;
    if (typeof source !== "string" || !/^[a-z_]{1,20}$/.test(source)) return null;
    if (typeof id !== "number" || !Number.isInteger(id)) return null;
    return { at, source, id };
  } catch {
    return null;
  }
}
