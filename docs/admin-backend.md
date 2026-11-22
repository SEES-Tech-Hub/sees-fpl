# Admin backend: the contract

Owner: admin backend. This is what the admin portal pages (Tayo) and a few public pages (Fortune, Mary) call. Every function is listed with its input, output and error codes. Functions marked **planned** don't exist yet. The PR that adds each one updates this page.

CSV formats are in [`admin-csv-formats.md`](admin-csv-formats.md).

## Conventions

**Every action** is a Server Action in `lib/admin/actions/*` and:

1. checks `requireRole("admin")` first (non-admins get the not-found page);
2. validates its input with the schema of the same name in `lib/admin/schemas.ts`;
3. writes with the signed-in client (`lib/supabase/server.ts`), so row-level security applies and the audit log records the admin;
4. runs any write that touches several rows as one database function, all or nothing;
5. returns an `ActionResult` and never throws for expected failures.

```ts
import type { ActionResult } from "@/lib/admin/result";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: AdminErrorCode; message: string; retryable: boolean; fieldErrors?: Record<string, string[]> } };
```

This is the same shape as Bolu's live-scores actions, plus `fieldErrors`. Show `error.message` as it is. Show `fieldErrors[field]` next to form fields; the keys are the input's property names (`fullName`, `priceTenths`).

**Money** is always tenths of a million naira (`priceTenths: 55` = ₦5.5m), the same as `players.price_tenths`. Format it with `formatPrice()` from `lib/admin/domain/prices.ts`.

**Times** are ISO strings with an offset, stored as `timestamptz`. Show them in WAT. CSV kickoff times are typed in WAT and converted with `watToUtc()` (`lib/admin/domain/wat.ts`).

**Reads** (`lib/admin/queries/*`) are server-only and run as the signed-in admin. Call them from Server Components inside `<Suspense>`. Each is wrapped in React `cache()`, so one request asks the database once.

## Error codes

Defined in `lib/admin/errors.ts`.

| Code | When |
| --- | --- |
| `admin.invalid_input` | Validation failed; see `fieldErrors` |
| `admin.not_found` | The record doesn't exist |
| `admin.conflict` | A unique value is taken (a display name, slug or short name) |
| `admin.in_use` | Other records depend on it |
| `admin.forbidden` | The database refused the write for this account |
| `admin.own_role` | You can't change your own role |
| `admin.role_forbidden` | Admin is granted or removed only in the database (by Tayo) |
| `admin.last_admin` | The last admin account can't be demoted |
| `admin.price_locked` | Price change after the matchday 1 deadline |
| `admin.price_out_of_range` | Price outside `admin_price_rules()` (₦4.0m to ₦10.0m in steps of ₦0.5m) |
| `admin.player_ambiguous` | Two players share that name; give a display name |
| `admin.import_invalid` | The import has rows with errors; nothing was written |
| `admin.league_not_finished` | Knockout fill before every league fixture has finished |
| `admin.rule_violation` | Another database rule refused it |
| `admin.not_ready` | Depends on a teammate's function that hasn't landed |
| `admin.unavailable` | Network or database busy (`retryable: true`) |
| `admin.unexpected` | Anything else; logged on the server |
| `live.*` | One of Bolu's rules, such as `live.has_events` when postponing a fixture with events. Show the message |

## Cache tags

Defined in `lib/admin/tags.ts`. Admin actions expire these with `updateTag()`. Tag a public `'use cache'` read with them and admin changes show up on the next request.

| Tag | Expired when |
| --- | --- |
| `teams` | A team is edited |
| `players` | Players or prices change (forms or import) |
| `sports` | Sports or events change |
| `fixtures` | Any fixture is created, rescheduled, postponed, cancelled or imported |
| `fixture:{id}` | That fixture changes |
| `matchdays` | A deadline override is set or cleared |
| `announcements` | A banner is created, edited or ended |
| `dashboard` | Anything the dashboard counts changes |

Fixture changes will also expire Bolu's `liveTags.fixtureList` once `lib/live` is on `main`.

## Shared helpers (available now)

| Import | What |
| --- | --- |
| `lib/admin/result.ts` | `ActionResult`, `ok()`, `fail()` |
| `lib/admin/errors.ts` | `AdminErrorCode`, `mapDatabaseError()` |
| `lib/admin/schemas.ts` | Input schemas for every action, and `parseInput()` |
| `lib/admin/domain/prices.ts` | `parsePrice`, `formatPrice`, `checkPriceTenths`, `isPriceLocked`, `lateAdditionPrice` |
| `lib/admin/domain/wat.ts` | `watToUtc`, `utcToWat` |
| `lib/admin/domain/display-names.ts` | `assignDisplayNames` |
| `lib/admin/domain/deadlines.ts` | `computeDeadline`, `checkDeadlineOverride` |
| `lib/admin/domain/fixtures.ts` | `findScheduleWarnings`, `estimateDurationMinutes` |
| `lib/admin/csv/*` | `previewPlayersCsv`, `previewPricesCsv`, `previewFixturesCsv` (pure; the preview actions wrap them), and `commitRows(preview)` for commits |

## Database functions

The server actions call these. They're listed so the rules are easy to find; pages never call them directly.

| Function | What it does | Migration |
| --- | --- | --- |
| `admin_price_rules()` | The allowed price range and step: min 40, max 100, step 5 (tenths). The single source; when Mary adds price columns to `fantasy_rules`, only this function changes | `admin_players_prices` |
| `admin_deadline_rules()` | How many minutes before a matchday's first kickoff its deadline should be (30). The single source for the admin backend; when Mary adds a column to `fantasy_rules`, only this function changes | `admin_deadline_rules` |
| `admin_price_lock_at()` | Matchday 1's `deadline_at`. Prices lock at that moment; null means no lock | `admin_players_prices` |
| `players_price_lock` (trigger) | From the app: prices must fit the rules (`admin.price_out_of_range`). After the lock: no price changes, and new players only at the lowest price (`admin.price_locked`). Status changes are always allowed | `admin_players_prices` |
| `admin_import_players(import_id, rows)` | Players CSV commit: re-checks every row, all or nothing, never renames existing players, tags audit rows with the import id. Returns `{ inserted, updated, unchanged, alreadyApplied }` | `admin_players_prices` |
| `admin_set_prices(import_id, rows)` | Prices CSV commit, same guarantees | `admin_players_prices` |
| `admin_import_fixtures(import_id, rows)` | Fixtures CSV commit, same guarantees. Existing fixtures only get a new kickoff, venue and matchday; their event, stage and teams must match. Deadlines aren't recalculated: the admin sets them | `admin_fixtures_import` |
| `admin_set_role(profile_id, role)` | Promote to official or back to user. Demoting releases the account's unfinished console holds and returns them. Refuses your own role (`admin.own_role`), anything involving admin (`admin.role_forbidden`) and the last admin (`admin.last_admin`). Safe to retry | `admin_set_role` |
| `admin_audit_page(...)` | The audit feed: `audit_log` plus match event voids and admin-recorded events, keyset-paginated | `admin_audit_announcements` |

Every import records its `import_id` in `admin_imports`. Committing the same import again returns the first run's counts with `alreadyApplied: true` and writes nothing.

## Functions by area

Each section is filled in by the PR named. Inputs are the schemas in `lib/admin/schemas.ts`.

### Audit log and announcements

Audit log (`lib/admin/queries/audit.ts`):

| Function | Input | Output |
| --- | --- | --- |
| `getAuditLog(filter?)` | `{ table?, actorId?, from?, to?, cursor?, limit? }` (limit up to 99, default 50; `table` is e.g. `players`, `fixtures`, `profiles`, `match_events`) | `{ entries, nextCursor }`, newest first |

- Each entry is `{ key, source, occurredAt, actorId, actorName, tableName, rowId, action, old, new, context, summary }`.
- `summary` is one line in plain words ("Player: status available → injured", "Match event voided: Wrong scorer").
- `action` is `insert`, `update`, `delete`, `void` or `record`.
- For updates, `old` and `new` hold only the changed columns. `context` carries an `importId`, a `reason` or `{ action: "set_role" }`.
- For the next page, pass `nextCursor` back as `cursor`; it's null on the last page. Paging is keyset, so new rows never shift a page.
- `lib/admin/domain/audit.ts` also exports `auditChanges(old, new)`, for a field-by-field view.

Announcements, admin side (`lib/admin/queries/announcements.ts` and `lib/admin/actions/announcements.ts`):

| Function | Input | Output |
| --- | --- | --- |
| `listAnnouncements()` | none | `AdminAnnouncement[]`, newest first: `{ id, message, tone, startsAt, endsAt, createdBy, createdAt, state: "scheduled" \| "showing" \| "ended" }` |
| `createAnnouncement` | `{ message (1 to 280), tone: "info" \| "warning", startsAt, endsAt }` (ISO; `endsAt` after `startsAt`) | `Announcement` |
| `updateAnnouncement` | `{ announcementId, ...the same }` | `Announcement` |
| `endAnnouncement` | `{ announcementId }` | `{ id, removed }`. A scheduled banner is removed; a showing one ends now |

For Fortune's home page: `getActiveAnnouncement()` returns the `Announcement` showing now, or `null`.
- It reads as an anonymous visitor with `createPublicClient()`, so it's safe inside `'use cache'`.
- It's tagged `announcements` and cached for about a minute. Admin changes show at once; otherwise a banner appears or disappears within about a minute of its times.
- It never throws: on a database error it returns `null`, so the home page doesn't break.

### Players and prices

Queries (`lib/admin/queries/players.ts`):

| Function | Input | Output |
| --- | --- | --- |
| `listPlayers(filter?)` | `{ teamId?, position?, status?, search? }` (search matches full or display name) | `AdminPlayer[]`, by year, position, display name |
| `getPlayer(playerId)` | id | `AdminPlayer \| null` |
| `getPriceSettings()` | none | `{ rules: { minTenths, maxTenths, stepTenths }, lockAt, locked }`. Use `rules` for the price picker and `locked` to disable price inputs |

`AdminPlayer` is `{ id, teamId, teamYear, teamShortName, fullName, displayName, position, shirtNumber, priceTenths, status, updatedAt }`.

Actions (`lib/admin/actions/players.ts`):

| Action | Input (`schemas.ts`) | Output | Errors to expect |
| --- | --- | --- | --- |
| `createPlayer` | `createPlayerInput`: `teamId, fullName, displayName?, position, shirtNumber?, priceTenths?, status?` | `{ player, chosenDisplayName, lateAdditionPrice }` | `invalid_input`, `price_out_of_range`, `price_locked`, `conflict` (display name taken) |
| `updatePlayer` | `updatePlayerInput`: `playerId` and any of `fullName, displayName, position, shirtNumber` | `AdminPlayer` | `invalid_input`, `conflict`, `not_found` |
| `setPlayerStatus` | `{ playerId, status }` | `AdminPlayer` | `not_found`. Allowed after the price lock |
| `setPlayerPrice` | `{ playerId, priceTenths }` | `AdminPlayer` | `price_out_of_range`, `price_locked` |

- `createPlayer`: leave `displayName` empty to have one chosen. If the full name is taken in that year, the result's `chosenDisplayName` says what was picked ("Samuel (DEF)"), so show it.
- After the lock, leave `priceTenths` empty and the player joins at the lowest price (`lateAdditionPrice` is set).

Imports (`lib/admin/actions/imports.ts`). Formats: [`admin-csv-formats.md`](admin-csv-formats.md).

| Action | Input | Output |
| --- | --- | --- |
| `previewPlayersImport(csvText)` | the file's text (up to 1 MB) | `ImportPreview<PlayerImportRow>`: `fileErrors`, `rows` (each with `rowNumber, status, errors, warnings, changes, value`), `counts`, `canCommit`. Nothing is written |
| `commitPlayersImport({ importId, rows })` | `importId`: `crypto.randomUUID()` made when the admin opens the import; `rows`: `commitRows(preview)` from `lib/admin/csv/preview.ts` | `ImportCounts`: `{ inserted, updated, unchanged, alreadyApplied }` |
| `previewPricesImport(csvText)` | as above | `ImportPreview<PriceImportRow>` |
| `commitPricesImport({ importId, rows })` | as above | `ImportCounts` |

How to wire the import screen:
1. Read the file with `file.text()` and call `preview*Import`.
2. Show `fileErrors` if there are any. Otherwise show the rows: errors in red, warnings in amber, and `changes` as the "what will happen" column.
3. Enable **Import** only when `canCommit` is true.
4. On **Import**, call `commit*Import({ importId, rows: commitRows(preview) })`. Keep the same `importId` for retries.
5. A commit can still fail with `admin.import_invalid` if the data changed since the preview. Its `message` names the rows; preview again.

### Sports, events and teams

Queries (`lib/admin/queries/sports.ts`):

| Function | Output |
| --- | --- |
| `listSports()` | `AdminSport[]` in display order: `{ id, slug, name, resultFormat, sortOrder, events }`. Each event is `{ id, sportId, slug, name, periodMinutes, periodCount, extraPeriodMinutes, fixtureCount }` |
| `listTeams()` | `AdminTeam[]` by year: `{ id, year, name, shortName, classLabel, coaches }` |

Actions (`lib/admin/actions/sports.ts`):

| Action | Input | Errors to expect |
| --- | --- | --- |
| `createSport` | `{ name, slug, resultFormat, sortOrder? }` | `conflict` (slug taken) |
| `updateSport` | `{ sportId, ...any of those }` | `rule_violation` if the result format changes after any of its fixtures has match events |
| `createEvent` | `{ sportId, name, slug, periodMinutes?, periodCount?, extraPeriodMinutes? }` | `conflict` (slug taken in that sport) |
| `updateEvent` | `{ eventId, ...any of those but sportId }` | |
| `updateTeam` | `{ teamId, name?, shortName?, classLabel?, coaches? }` (up to 6 coaches) | `conflict` |

- Slugs are lowercase words joined by hyphens, like `table-tennis`.
- Venues are set per fixture, because events have no venue column.
- `shortName` is what the fixtures CSV uses (`Y1` to `Y5`). Changing it changes what the CSV expects.

### Fixtures and matchdays

Queries (`lib/admin/queries/fixtures.ts`):

| Function | Input | Output |
| --- | --- | --- |
| `listFixtures(filter?)` | `{ eventId?, matchdayId?, status?, from?, to? }` (ISO times; use `watDayBounds` for a WAT day) | `AdminFixture[]` by kickoff, fixtures with no time last |
| `getFixture(fixtureId)` | id | `AdminFixture \| null` |
| `listMatchdays()` | none | `AdminMatchday[]`: `{ id, number, name, deadlineAt, status, firstKickoffAt, fixtureCount }` |

`AdminFixture` is `{ id, eventId, eventName, sportId, sportName, sportSlug, stage, homeTeamId, awayTeamId, home, away, label, kickoffAt, venue, status, matchdayId, matchdayNumber, consoleHolderId, holderName, homeScore, awayScore, updatedAt }`. `label` reads like "Y1 v Y4" or "Final (teams to be confirmed)", the same as the dashboard.

Actions (`lib/admin/actions/fixtures.ts`), each returning the updated `AdminFixture`:

| Action | Input | Errors to expect |
| --- | --- | --- |
| `createFixture` | `createFixtureInput`: `eventId, stage?, homeTeamId?, awayTeamId?, kickoffAt?, venue?, matchdayId?` | `invalid_input` (one team without the other, a team playing itself) |
| `updateFixture` | `updateFixtureInput`: `fixtureId` and any of `stage, homeTeamId, awayTeamId, venue, matchdayId` | `live.has_events` (teams can't change once it has events) |
| `rescheduleFixture` | `{ fixtureId, kickoffAt }`: ISO, or null for "to be confirmed". Convert WAT input with `watToUtc` | `not_found` |
| `postponeFixture(fixtureId)` / `cancelFixture(fixtureId)` / `restoreFixture(fixtureId)` | id | `live.has_events` (void its events first), `live.derived_status` (it's live or over) |

Walkovers are `recordWalkover`, under Corrections.

Matchdays (`lib/admin/actions/matchdays.ts`):

| Action | Input | Output |
| --- | --- | --- |
| `setMatchdayDeadline` | `{ matchdayId, deadlineAt }` | `{ matchdayId, number, deadlineAt }`. `invalid_input` if it's after the matchday's first kickoff |

Deadlines are **never recalculated automatically**. Moving a kickoff doesn't move its matchday's deadline. Show `firstKickoffAt` next to each deadline so the admin can set it. Matchday 1's deadline is also when prices lock.

Fixtures import (`lib/admin/actions/imports.ts`): `previewFixturesImport(csvText)` and `commitFixturesImport({ importId, rows })` work like the players import. A file with a `ref` column is refused until `fixtures.ref` exists.

### Officials and console holders

Queries (`lib/admin/queries/officials.ts`):

| Function | Input | Output |
| --- | --- | --- |
| `listProfiles(filter?)` | `{ search?, role?, limit? }` (search matches name or email; up to 100, newest first) | `AdminProfile[]`: `{ id, displayName, email, role, createdAt }` |
| `listOfficials()` | none | every official and admin account, by name (the console holder picker) |

Actions (`lib/admin/actions/officials.ts`):

| Action | Input | Output | Errors to expect |
| --- | --- | --- | --- |
| `setRole` | `{ profileId, role: "user" \| "official" }` | `{ profileId, role, releasedFixtures }`. When demoting, `releasedFixtures` lists the unfinished fixtures that lost their holder (`{ id, kickoffAt, stage, status, eventName, home, away }`); show them | `own_role`, `role_forbidden`, `last_admin`, `not_found` (they haven't signed in yet) |
| `setConsoleHolder` | `{ fixtureId, profileId \| null }` | `AdminFixture` | `live.holder_not_official` |

Both are "set to", so a retry does nothing new.

### Dashboard

`getDashboard()` (`lib/admin/queries/dashboard.ts`) returns the same `DashboardData` as `app/admin/dashboard-data.ts`. To switch, change the import in `app/admin/page.tsx` to `import { getDashboard, type DashboardFixture } from "@/lib/admin/queries/dashboard"`, call `getDashboard()`, and delete `dashboard-data.ts`.

Its "needs a holder" rule is unchanged: scheduled, no console holder, and kicking off within the next 2 hours.

### Corrections, walkovers and fantasy points

`lib/admin/actions/corrections.ts` wraps Bolu's `recordMatchEvent` and `undoMatchEvent` (`lib/live/actions.ts`) and Mary's `recalculateMatchdayAndRankings` (`lib/fantasy/actions.ts`). Nothing here writes `match_events` directly. Bolu's errors come back as `live.<his code>` with his message.

| Action | Input | Output |
| --- | --- | --- |
| `recordWalkover` | `{ fixtureId, awardedTeamId, clientEventId, points? }`. Make `clientEventId` with `crypto.randomUUID()` when the admin confirms | `{ event, recalculation }`. Only before the fixture has events (`live.invalid_state`) |
| `voidMatchEvent` | `{ clientEventId, reason }` (reason: 5 to 300 characters) | `{ voided, recorded: null, recalculation }` |
| `correctMatchEvent` | `{ voidClientEventId, reason, replacement? }`. `replacement` is a `RecordEventInput` (see `docs/live-scores.md`) for the same fixture, with a new `clientEventId`; after full time it can carry the real `occurredAt` | `{ voided, recorded, recalculation }` |
| `finaliseMatchday` | `{ matchdayId }` | `{ managersUpdated }`. Final points and rankings; safe to repeat |
| `recalculateMatchday` | `{ matchdayId }` | `{ managersUpdated, finalised }`. Leaves the finalised flag as it was |

How each piece behaves:
- **`recalculation`** is `{ status: "done", managersUpdated, finalised }`, or `{ status: "skipped", reason: "no_matchday" | "before_deadline" }`, or `{ status: "failed", error }`. A correction that worked but couldn't recalculate still returns `ok: true`, so show `recalculation.error.message` and offer **Recalculate**.
- **Corrections take two calls**, because Bolu's API has no single void-and-record. If the void works and the replacement is refused, `correctMatchEvent` returns an error that starts "The old event was voided, but the corrected one wasn't recorded". Fix it and send the same input again (same ids): the void isn't repeated, and the replacement is recorded once.
- **Points only recalculate on the deployed site.** Mary's engine uses the secret key, which exists only on Vercel. Locally, `finaliseMatchday` and `recalculateMatchday` return `admin.unavailable` with "Points can only be recalculated on the deployed site."

### Knockout fill

| Function | Input | Output |
| --- | --- | --- |
| `getKnockoutPreview(eventId)` (`lib/admin/queries/knockouts.ts`) | event id | `{ ready: true, standings, final: { home, away }, thirdPlace }`, or `{ ready: false, reason: "not_football" \| "league_not_finished" \| "too_few_teams" \| "standings_tied", unfinished, standings }`. Show it on the confirm screen |
| `fillKnockouts` (`lib/admin/actions/knockouts.ts`) | `{ eventId }` | `{ fixtures: [{ fixtureId, stage, homeTeamId, awayTeamId }] }` |

- `fillKnockouts` calls Bolu's `fill_football_knockouts(event_id)`. It reads the final order from `football_standings`, so the database decides who plays in the final and the third-place match.
- His errors come through as `live.league_not_finished`, `live.standings_tied` and `live.has_events` (see "Knockouts and bans" in `docs/live-scores.md`). On `standings_tied`, the organisers decide and the admin sets those teams with `updateFixture`.
- Running it again with the same table changes nothing.

## Smoke test

[`admin-smoke-test.md`](admin-smoke-test.md) is a step-by-step check of all of the above on a preview deployment.
