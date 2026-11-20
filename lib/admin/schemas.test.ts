import { describe, expect, it } from "vitest";
import { announcementInput, createPlayerInput, parseInput, setRoleInput, stage } from "./schemas";

const TEAM = "6f1c1b7e-2f0a-4c55-9a51-0e8f1b8a2c11";

describe("schemas", () => {
  it("normalises names and applies defaults", () => {
    const parsed = parseInput(createPlayerInput, { teamId: TEAM, fullName: "  Samuel   Okafor ", position: "DEF" });
    expect(parsed.ok && parsed.data).toMatchObject({ fullName: "Samuel Okafor", status: "available" });
  });

  it("returns admin.invalid_input with field errors", () => {
    const parsed = parseInput(createPlayerInput, { teamId: "nope", fullName: " ", position: "ATT" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && !parsed.result.ok) {
      expect(parsed.result.error.code).toBe("admin.invalid_input");
      expect(Object.keys(parsed.result.error.fieldErrors ?? {})).toEqual(["teamId", "fullName", "position"]);
    }
  });

  it("only allows user and official roles", () => {
    expect(parseInput(setRoleInput, { profileId: TEAM, role: "admin" }).ok).toBe(false);
    expect(parseInput(setRoleInput, { profileId: TEAM, role: "official" }).ok).toBe(true);
  });

  it("normalises stages", () => {
    expect(stage.parse(" Third place ")).toBe("third_place");
  });

  it("needs an announcement to end after it starts", () => {
    const parsed = parseInput(announcementInput, {
      message: "Matchday 2 kickoff moved to 4 pm",
      startsAt: "2026-11-30T10:00:00+01:00",
      endsAt: "2026-11-30T09:00:00+01:00",
    });
    expect(!parsed.ok && !parsed.result.ok && parsed.result.error.fieldErrors).toEqual({
      endsAt: ["The end must be after the start"],
    });
  });
});
