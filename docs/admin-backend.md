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
| `admin.price_locked` | Price change after the matchday 1 deadline |
| `admin.price_out_of_range` | Price outside the allowed range (today the `players` check constraint, ₦4.0m to ₦10.0m in steps of ₦0.5m; from PR 3, `admin_price_rules()`) |
| `admin.player_ambiguous` | Two players share that name; give a display name |
| `admin.import_invalid` | The import has rows with errors; nothing was written |
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
| `lib/admin/csv/*` | `previewPlayersCsv`, `previewPricesCsv`, `previewFixturesCsv` (pure; the preview actions wrap them) |

## Functions by area

Each section is filled in by the PR named. Inputs are the schemas in `lib/admin/schemas.ts`.

### Audit log and announcements (PR 2, planned)

| Function | Input | Output |
| --- | --- | --- |
| `getAuditLog(filter)` | `auditLogFilter`: table, actor, from, to, cursor, limit | `{ entries, nextCursor }`, newest first, keyset-paginated |
| `listAnnouncements()` | none | all banners, newest first |
| `getActiveAnnouncement()` | none | the banner showing now, or `null` (for Fortune's home page) |
| `createAnnouncement` / `updateAnnouncement` / `endAnnouncement` | `announcementInput` and friends | the banner |

### Players and prices (PR 3, planned)

`listPlayers`, `createPlayer`, `updatePlayer`, `setPlayerStatus`, `setPlayerPrice`, `getPriceRules`, `previewPlayersImport(csvText)`, `commitPlayersImport({ importId, rows })`, `previewPricesImport`, `commitPricesImport`.

### Sports, events, teams and fixtures (PR 4, planned)

`listSports`, `createSport`, `updateSport`, `createEvent`, `updateEvent`, `updateTeam`, `listFixtures`, `createFixture`, `updateFixture`, `rescheduleFixture`, `setFixtureStatus` (scheduled, postponed or cancelled), `previewFixturesImport`, `commitFixturesImport`, `setMatchdayDeadline`, `clearDeadlineOverride`.

### Officials and dashboard (PR 5, planned)

`listProfiles(search)`, `setRole({ profileId, role })`, which returns the fixtures released from a demoted official; `setConsoleHolder({ fixtureId, profileId | null })`; and `getDashboard()`, which returns the same `DashboardData` shape as `app/admin/dashboard-data.ts`.

### Corrections, walkovers and fantasy (PR 6, planned; needs `lib/live` and Mary's functions)

`recordWalkover`, `voidMatchEvent`, `correctMatchEvent`, `finaliseMatchday` and `recalculateMatchday`. The last two return `admin.not_ready` until Mary's functions exist.

### Knockout fill (PR 7, planned; needs Bolu's standings)

`fillKnockouts({ eventId })`.
