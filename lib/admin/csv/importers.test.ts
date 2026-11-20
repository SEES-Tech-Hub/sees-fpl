import { describe, expect, it } from "vitest";
import { previewFixturesCsv, type ExistingFixture, type FixturesImportContext } from "./fixtures";
import { previewPlayersCsv, type ExistingPlayer, type PlayersImportContext } from "./players";
import { previewPricesCsv } from "./prices";

const RULES = { minTenths: 40, maxTenths: 100, stepTenths: 5 };
const teams = [1, 2, 3, 4, 5].map((year) => ({ id: `t${year}`, year, shortName: `Y${year}`, name: `Year ${year}` }));

// A slice of the real seed, including Year 2's two Samuels.
const players: ExistingPlayer[] = [
  { id: "p-zeke", teamId: "t2", fullName: "Zeke", displayName: "Zeke", position: "GK", shirtNumber: null, priceTenths: 45, status: "available" },
  { id: "p-sam-def", teamId: "t2", fullName: "Samuel", displayName: "Samuel (DEF)", position: "DEF", shirtNumber: null, priceTenths: 45, status: "available" },
  { id: "p-sam-att", teamId: "t2", fullName: "Samuel", displayName: "Samuel (ATT)", position: "FWD", shirtNumber: null, priceTenths: 60, status: "available" },
  { id: "p-kolade", teamId: "t5", fullName: "Kolade", displayName: "Kolade", position: "FWD", shirtNumber: 9, priceTenths: 60, status: "available" },
  { id: "p-atom3", teamId: "t3", fullName: "Atom", displayName: "Atom", position: "MID", shirtNumber: null, priceTenths: 55, status: "available" },
];

const playersContext = (overrides: Partial<PlayersImportContext> = {}): PlayersImportContext => ({
  teams,
  players,
  priceRules: RULES,
  priceLocked: false,
  ...overrides,
});

describe("players CSV", () => {
  it("matches existing players by name, ignoring case and extra spaces, and reports changes", () => {
    const preview = previewPlayersCsv(
      "full_name,year,position,shirt_number,price\n  KOLADE ,5,FWD,10,7.5\nzeke,2,GK,,4.5\n",
      playersContext(),
    );
    expect(preview.canCommit).toBe(true);
    expect(preview.rows[0]).toMatchObject({
      status: "update",
      changes: ["price ₦6.0m → ₦7.5m", "shirt 9 → 10"],
      value: { existingId: "p-kolade", displayName: "Kolade", fullName: "Kolade", priceTenths: 75 },
    });
    expect(preview.rows[1]).toMatchObject({ status: "unchanged", value: { existingId: "p-zeke" } });
    expect(preview.counts).toEqual({ new: 0, update: 1, unchanged: 1, error: 0 });
  });

  it("adds new players at the price given", () => {
    const preview = previewPlayersCsv("full_name,year,position,price\nTunde Bakare,1,MID,5.5", playersContext());
    expect(preview.rows[0]).toMatchObject({
      status: "new",
      warnings: [],
      value: { existingId: null, teamId: "t1", displayName: "Tunde Bakare", priceTenths: 55, status: "available" },
    });
  });

  it("errors when a name matches two players and no display name is given", () => {
    const preview = previewPlayersCsv("full_name,year,position,price\nSamuel,2,DEF,5", playersContext());
    expect(preview.canCommit).toBe(false);
    expect(preview.rows[0].errors[0]).toMatch(/^Row 2, full_name: 2 players in Year 2 are called Samuel/);
  });

  it("uses display_name to pick between players with the same name", () => {
    const preview = previewPlayersCsv(
      "full_name,year,position,price,display_name\nSamuel,2,FWD,6.5,samuel (att)",
      playersContext(),
    );
    expect(preview.rows[0]).toMatchObject({ status: "update", value: { existingId: "p-sam-att", displayName: "Samuel (ATT)" } });
  });

  it("refuses a display name that belongs to someone else", () => {
    const preview = previewPlayersCsv("full_name,year,position,price,display_name\nKoreed,2,DEF,5,Zeke", playersContext());
    expect(preview.rows[0].errors[0]).toContain('"Zeke" is Zeke, not Koreed');
  });

  it("never renames an existing player; new clashing players get a name and a warning", () => {
    const preview = previewPlayersCsv("full_name,year,position,price\nZeke,2,GK,4.5\nAyo,2,FWD,5\nAyo,2,MID,5", {
      ...playersContext(),
      players: [...players, { ...players[0], id: "p-ayo", fullName: "Ayo Old", displayName: "Ayo" }],
    });
    expect(preview.rows[0].value?.displayName).toBe("Zeke");
    expect(preview.rows[1]).toMatchObject({ status: "new", value: { displayName: "Ayo (FWD)" } });
    expect(preview.rows[2]).toMatchObject({ status: "new", value: { displayName: "Ayo (MID)" } });
    expect(preview.rows[1].warnings[0]).toContain('will show as "Ayo (FWD)"');
    expect(preview.canCommit).toBe(true);
  });

  it("leaves cross-team duplicates as they are", () => {
    const preview = previewPlayersCsv("full_name,year,position,price\nAtom,4,MID,5.5", playersContext());
    expect(preview.rows[0]).toMatchObject({ status: "new", warnings: [], value: { displayName: "Atom", teamId: "t4" } });
  });

  it("names the row and column in plain words", () => {
    const preview = previewPlayersCsv(
      "full_name,year,position,shirt_number,price,status\n,7,Winger,100,11.0,benched",
      playersContext(),
    );
    expect(preview.rows[0].errors).toEqual([
      "Row 2, full_name: is missing",
      'Row 2, year: "7" isn\'t a year; use 1 to 5',
      'Row 2, position: "Winger" isn\'t a position; use GK, DEF, MID or FWD',
      'Row 2, shirt_number: "100" isn\'t a shirt number; use 0 to 99',
      'Row 2, status: "benched" isn\'t a status; use available, injured, suspended, left',
      "Row 2, price: 11.0 is above the maximum of 10.0",
    ]);
    expect(preview.rows[0].value).toBeNull();
  });

  it("needs a price for new players before the lock", () => {
    const preview = previewPlayersCsv("full_name,year,position,price\nNew Guy,1,DEF,", playersContext());
    expect(preview.rows[0].errors).toEqual(["Row 2, price: is missing (new players need a price)"]);
  });

  it("flags two rows for the same player", () => {
    const preview = previewPlayersCsv("full_name,year,position,price\nKolade,5,FWD,6\nkolade,5,FWD,6.5", playersContext());
    expect(preview.rows[1].errors).toEqual(["Row 3: is the same player as row 2"]);
  });

  describe("after the price lock", () => {
    const locked = playersContext({ priceLocked: true });

    it("refuses price changes but allows status changes", () => {
      const preview = previewPlayersCsv(
        "full_name,year,position,price,status\nKolade,5,FWD,7,available\nZeke,2,GK,,injured",
        locked,
      );
      expect(preview.rows[0].errors[0]).toContain("prices are locked");
      expect(preview.rows[1]).toMatchObject({ status: "update", changes: ["status available → injured"], value: { priceTenths: 45 } });
    });

    it("gives late additions the lowest price, with a warning", () => {
      const preview = previewPlayersCsv("full_name,year,position,price\nLate Joiner,1,FWD,\nAnother,1,MID,4.0", locked);
      expect(preview.rows[0]).toMatchObject({ status: "new", value: { priceTenths: 40 } });
      expect(preview.rows[0].warnings[0]).toContain("late addition");
      expect(preview.rows[1]).toMatchObject({ status: "new", value: { priceTenths: 40 } });
    });

    it("refuses a late addition at any other price", () => {
      const preview = previewPlayersCsv("full_name,year,position,price\nLate Joiner,1,FWD,6", locked);
      expect(preview.rows[0].errors[0]).toContain("late additions join at 4.0");
    });
  });

  it("returns file errors without checking rows", () => {
    expect(previewPlayersCsv("", playersContext()).fileErrors).toEqual(["The file is empty"]);
    const unknown = previewPlayersCsv("full_name,year,position,price,team\nA,1,GK,5,x", playersContext());
    expect(unknown.fileErrors[0]).toContain('Unknown column "team"');
    expect(unknown.canCommit).toBe(false);
  });
});

describe("prices CSV", () => {
  const context = { teams, players, priceRules: RULES, priceLocked: false };

  it("updates prices and counts unchanged rows", () => {
    const preview = previewPricesCsv("full_name,year,price\nKolade,5,8.5\nZeke,2,4.5", context);
    expect(preview.rows.map((r) => r.status)).toEqual(["update", "unchanged"]);
    expect(preview.rows[0].value).toEqual({ playerId: "p-kolade", priceTenths: 85 });
  });

  it("refuses unknown and ambiguous players", () => {
    const preview = previewPricesCsv("full_name,year,price\nNobody,5,5\nSamuel,2,5", context);
    expect(preview.rows[0].errors[0]).toBe("Row 2, full_name: there's no player called Nobody in Year 5");
    expect(preview.rows[1].errors[0]).toContain("Add a display_name column");
  });

  it("resolves the Samuels with display_name", () => {
    const preview = previewPricesCsv("full_name,year,price,display_name\nSamuel,2,5.0,Samuel (DEF)", context);
    expect(preview.rows[0]).toMatchObject({ status: "update", value: { playerId: "p-sam-def", priceTenths: 50 } });
  });

  it("refuses changes after the lock, but unchanged rows are fine", () => {
    const preview = previewPricesCsv("full_name,year,price\nKolade,5,8.5\nZeke,2,4.5", { ...context, priceLocked: true });
    expect(preview.rows[0].status).toBe("error");
    expect(preview.rows[1].status).toBe("unchanged");
  });
});

describe("fixtures CSV", () => {
  const football = { id: "s-fb", slug: "football", name: "Football" };
  const athletics = { id: "s-ath", slug: "athletics", name: "Athletics" };
  const footballMen = { id: "e-fb", sportId: "s-fb", slug: "football-men", name: "Football (men)", periodMinutes: 25, periodCount: 2 };
  const fixtures: ExistingFixture[] = [
    { id: "f-md1-1", ref: null, eventId: "e-fb", stage: "league", homeTeamId: "t1", awayTeamId: "t4", kickoffAt: "2026-11-28T13:00:00Z", venue: "UNILAG Sports Centre", matchdayId: "md1", status: "scheduled" },
    { id: "f-md1-2", ref: null, eventId: "e-fb", stage: "league", homeTeamId: "t2", awayTeamId: "t3", kickoffAt: "2026-11-28T15:00:00Z", venue: "UNILAG Sports Centre", matchdayId: "md1", status: "scheduled" },
    { id: "f-final", ref: null, eventId: "e-fb", stage: "final", homeTeamId: null, awayTeamId: null, kickoffAt: "2026-12-09T15:00:00Z", venue: "UNILAG Sports Centre", matchdayId: "md6", status: "scheduled" },
  ];
  const context = (overrides: Partial<FixturesImportContext> = {}): FixturesImportContext => ({
    sports: [football, athletics],
    events: [
      footballMen,
      { id: "e-100m", sportId: "s-ath", slug: "100m-men", name: "100 m men", periodMinutes: null, periodCount: null },
      { id: "e-200m", sportId: "s-ath", slug: "200m-men", name: "200 m men", periodMinutes: null, periodCount: null },
    ],
    teams,
    matchdays: [1, 2, 3, 4, 5, 6].map((number) => ({ id: `md${number}`, number })),
    fixtures,
    supportsRef: false,
    now: new Date("2026-11-20T09:00:00Z"),
    ...overrides,
  });
  const header = "sport,event,stage,home,away,date,kickoff_wat,venue,matchday";

  it("sets a real kickoff on an existing league fixture, converting WAT to UTC", () => {
    const preview = previewFixturesCsv(`${header}\nFootball,,league,Y1,Y4,2026-11-28,15:30,UNILAG Sports Centre,1`, context());
    expect(preview.rows[0]).toMatchObject({
      status: "update",
      changes: ["kickoff 2026-11-28 14:00 → 2026-11-28 15:30"],
      value: { existingId: "f-md1-1", kickoffAt: "2026-11-28T14:30:00.000Z", matchdayId: "md1" },
    });
  });

  it("matches knockout fixtures with no teams yet", () => {
    const preview = previewFixturesCsv(`${header}\nfootball,football-men,Final,,,2026-12-09,17:00,UNILAG Sports Centre,6`, context());
    expect(preview.rows[0]).toMatchObject({ status: "update", value: { existingId: "f-final", stage: "final" } });
  });

  it("creates a new fixture when nothing matches", () => {
    const preview = previewFixturesCsv(`${header}\nAthletics,100 m men,final,,,2026-11-29,10:00,Track,`, context());
    expect(preview.rows[0]).toMatchObject({ status: "new", value: { eventId: "e-100m", existingId: null, matchdayId: null } });
  });

  it("needs the event when a sport has several", () => {
    const preview = previewFixturesCsv(`${header}\nAthletics,,final,,,2026-11-29,10:00,Track,`, context());
    expect(preview.rows[0].errors[0]).toContain("Athletics has 2 events");
  });

  it("checks teams, dates and times in plain words", () => {
    const preview = previewFixturesCsv(
      `${header}\nCricket,,league,Y1,Y1,2026-11-31,16:00,,9\nFootball,,league,Y6,,2026-11-28,,,`,
      context(),
    );
    expect(preview.rows[0].errors).toEqual([
      'Row 2, sport: "Cricket" isn\'t a sport',
      "Row 2, away: a team can't play itself",
      'Row 2, date: "2026-11-31" isn\'t a date. Use YYYY-MM-DD, like 2026-11-28',
      'Row 2, matchday: "9" isn\'t a matchday; use 1, 2, 3, 4, 5, 6',
    ]);
    expect(preview.rows[1].errors).toEqual([
      'Row 3, home: "Y6" isn\'t a team; use Y1 to Y5',
      "Row 3, away: is missing; give both teams, or leave both empty if they aren't known yet",
      "Row 3, kickoff_wat: is missing (there's a date)",
    ]);
  });

  it("allows a fixture with no time yet, with a warning", () => {
    const preview = previewFixturesCsv(`${header}\nAthletics,200m-men,heat_1,,,,,Track,`, context());
    expect(preview.rows[0]).toMatchObject({ status: "new", value: { kickoffAt: null } });
    expect(preview.rows[0].warnings[0]).toContain("time to be confirmed");
  });

  it("warns about a team playing twice at once", () => {
    const preview = previewFixturesCsv(`${header}\nFootball,,league,Y1,Y2,2026-11-28,14:30,Pitch 2,`, context());
    expect(preview.rows[0].status).toBe("new");
    expect(preview.rows[0].warnings.some((w) => w.includes("A team is also playing"))).toBe(true);
  });

  it("refuses a ref column until the migration is applied", () => {
    const preview = previewFixturesCsv(`${header},ref\nFootball,,league,Y1,Y4,2026-11-28,15:30,,1,FB-MD1-1`, context());
    expect(preview.fileErrors[0]).toContain('"ref" column');
  });

  it("matches by ref, and assigns a ref to a matching fixture without one", () => {
    const withRef = context({
      supportsRef: true,
      fixtures: [{ ...fixtures[0], ref: "FB-MD1-1" }, fixtures[1], fixtures[2]],
    });
    const preview = previewFixturesCsv(
      `${header},ref\nFootball,,league,Y1,Y4,2026-11-28,14:00,UNILAG Sports Centre,1,fb-md1-1\nFootball,,league,Y2,Y3,2026-11-28,16:00,UNILAG Sports Centre,1,FB-MD1-2`,
      withRef,
    );
    expect(preview.rows[0]).toMatchObject({ status: "unchanged", value: { existingId: "f-md1-1" } });
    expect(preview.rows[1]).toMatchObject({ status: "update", changes: ["ref → FB-MD1-2"], value: { existingId: "f-md1-2" } });
  });

  it("refuses changing the teams of a fixture that has started", () => {
    const withRef = context({
      supportsRef: true,
      fixtures: [{ ...fixtures[0], ref: "FB-MD1-1", status: "full_time" }],
    });
    const preview = previewFixturesCsv(`${header},ref\nFootball,,league,Y1,Y5,2026-11-28,14:00,UNILAG Sports Centre,1,FB-MD1-1`, withRef);
    expect(preview.rows[0].errors[0]).toContain("has started");
  });

  it("errors when a row matches several fixtures", () => {
    const twice = context({ fixtures: [fixtures[0], { ...fixtures[0], id: "f-dup" }] });
    const preview = previewFixturesCsv(`${header}\nFootball,,league,Y1,Y4,2026-11-28,14:00,,1`, twice);
    expect(preview.rows[0].errors[0]).toContain("Add a ref column");
  });
});
