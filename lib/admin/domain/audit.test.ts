import { describe, expect, it } from "vitest";
import { auditChanges, decodeAuditCursor, encodeAuditCursor, summariseAuditEntry } from "./audit";

describe("audit summaries", () => {
  it("lists changed fields", () => {
    expect(
      summariseAuditEntry({ tableName: "players", action: "update", old: { status: "available" }, new: { status: "injured" }, context: null }),
    ).toBe("Player: status available → injured");
  });
  it("describes voids with their reason, and admin records", () => {
    expect(summariseAuditEntry({ tableName: "match_events", action: "void", old: {}, new: {}, context: { reason: "Wrong scorer" } })).toBe(
      "Match event voided: Wrong scorer",
    );
    expect(summariseAuditEntry({ tableName: "match_events", action: "record", old: null, new: { type: "goal" }, context: {} })).toBe(
      "Match event recorded by the admin: goal",
    );
  });
  it("handles inserts, deletes and nulls", () => {
    expect(summariseAuditEntry({ tableName: "announcements", action: "insert", old: null, new: {}, context: null })).toBe("Announcement added");
    expect(auditChanges({ console_holder: "abc" }, { console_holder: null })).toEqual([{ field: "console_holder", from: "abc", to: null }]);
  });
});

describe("audit cursor", () => {
  it("round-trips and rejects junk", () => {
    const cursor = { at: "2026-11-22T10:00:00.123456+00:00", source: "match_void", id: 42 };
    expect(decodeAuditCursor(encodeAuditCursor(cursor))).toEqual(cursor);
    expect(decodeAuditCursor("not-a-cursor")).toBeNull();
    expect(decodeAuditCursor(Buffer.from('["x","audit",1]').toString("base64url"))).toBeNull();
    expect(decodeAuditCursor(Buffer.from('["2026-11-22T10:00:00Z","Robert\'); drop",1]').toString("base64url"))).toBeNull();
  });
});
