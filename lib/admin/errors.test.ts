import { describe, expect, it } from "vitest";
import { mapDatabaseError } from "./errors";

describe("mapDatabaseError", () => {
  it("passes through our own live_fail codes and messages", () => {
    expect(
      mapDatabaseError({ code: "P0001", hint: "admin.price_locked", message: "Prices are locked since the matchday 1 deadline." }),
    ).toEqual({ code: "admin.price_locked", message: "Prices are locked since the matchday 1 deadline.", retryable: false });
  });

  it("passes through Bolu's live.* rule codes", () => {
    expect(mapDatabaseError({ code: "P0001", hint: "live.has_events", message: "This fixture already has match events." })).toEqual({
      code: "live.has_events",
      message: "This fixture already has match events.",
      retryable: false,
    });
  });

  it("maps the role guard's fixed messages", () => {
    expect(mapDatabaseError({ code: "P0001", message: "You cannot change your own role" }).code).toBe("admin.own_role");
    expect(mapDatabaseError({ code: "P0001", message: "Admin can only be granted or removed in the database" }).code).toBe(
      "admin.role_forbidden",
    );
  });

  it("never returns an unknown raw message", () => {
    const mapped = mapDatabaseError({ code: "P0001", message: 'relation "secret_table" does not exist' });
    expect(mapped.code).toBe("admin.rule_violation");
    expect(mapped.message).not.toContain("secret_table");
    expect(mapDatabaseError({ code: "XX000", message: "internal error at line 3" }).message).not.toContain("line 3");
  });

  it("maps constraint and permission errors", () => {
    expect(mapDatabaseError({ code: "23505", message: "duplicate key" }).code).toBe("admin.conflict");
    expect(mapDatabaseError({ code: "23503", message: "fk" }).code).toBe("admin.in_use");
    expect(mapDatabaseError({ code: "42501", message: "permission denied" }).code).toBe("admin.forbidden");
    expect(
      mapDatabaseError({
        code: "23514",
        message: 'new row for relation "players" violates check constraint "players_price_tenths_check"',
      }),
    ).toEqual({ code: "admin.invalid_input", message: "That price is outside the allowed range.", retryable: false });
  });

  it("marks busy and network errors as retryable", () => {
    expect(mapDatabaseError({ code: "57014", message: "canceling statement" })).toMatchObject({ code: "admin.unavailable", retryable: true });
    expect(mapDatabaseError({ code: "", message: "TypeError: fetch failed" })).toMatchObject({ code: "admin.unavailable", retryable: true });
  });

  it("handles a missing error", () => {
    expect(mapDatabaseError(null).code).toBe("admin.unexpected");
  });
});
