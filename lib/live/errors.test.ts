import { describe, expect, it } from "vitest";
import { toLiveError, toLiveErrorFromThrown } from "./errors";

describe("toLiveError", () => {
  it("passes database rule violations through with their message", () => {
    expect(
      toLiveError({ code: "P0001", hint: "live.not_holder", message: "Only the official holding this match can record it." }),
    ).toEqual({ code: "not_holder", message: "Only the official holding this match can record it.", retryable: false });
  });

  it("treats unknown live codes as unknown errors", () => {
    expect(toLiveError({ code: "P0001", hint: "live.something_new", message: "x" }).code).toBe("unknown");
  });

  it("maps permission errors", () => {
    expect(toLiveError({ code: "42501", message: "permission denied for function take_fixture" })).toMatchObject({
      code: "forbidden",
      retryable: false,
    });
  });

  it("marks network and busy-database errors as retryable", () => {
    expect(toLiveError({ code: "", message: "TypeError: fetch failed" })).toMatchObject({ code: "unavailable", retryable: true });
    expect(toLiveError(null)).toMatchObject({ code: "unavailable", retryable: true });
    expect(toLiveError({ code: "57014", message: "statement timeout" }).retryable).toBe(true);
    expect(toLiveError({ code: "PGRST003", message: "pool timeout" }).retryable).toBe(true);
  });

  it("does not retry other server errors", () => {
    expect(toLiveError({ code: "23505", message: "duplicate key" })).toMatchObject({ code: "unknown", retryable: false });
  });
});

describe("toLiveErrorFromThrown", () => {
  it("retries anything thrown without a code (fetch failed)", () => {
    expect(toLiveErrorFromThrown(new TypeError("fetch failed"))).toMatchObject({ code: "unavailable", retryable: true });
  });
});
