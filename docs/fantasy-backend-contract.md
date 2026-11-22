# SEES Fantasy: backend contract (frontend ↔ backend)

Draft v1.1 · 20 Nov 2026 (v1: 19 Nov) · From Henry (fantasy frontend) to Mary (fantasy backend)

This is what the fantasy screens call and what they expect back. The frontend reaches the backend **only** through `lib/fantasy/api.ts`. Each function there is either already real (reads of `teams`, `players`, `matchdays`, `fixtures`) or a typed stub marked `// STUB: replace with Mary's RPC`. When a function below is ready, I swap that one stub for your RPC or table read and nothing else changes.

- All TypeScript types are in `lib/fantasy/types.ts`. That file is the source of truth for shapes; this doc explains them.
- Scoring examples the engine must match: `docs/fantasy-scoring-examples.md`.
- The table and column names below are **suggestions** that fit the base schema. The backend is yours: rename anything, and tell me so I update the adapter. I have not written any migrations for these tables.
- Function names are provisional until confirmed against the team task plan. They will only ever be renamed inside `lib/fantasy/api.ts`.

---

## 1. Conventions

**Money** is always tenths of a million naira (`Tenths`), the same as `players.price_tenths`: 55 = ₦5.5m, the budget 1000 = ₦100.0m.

**Positions, statuses**: the existing enums `player_position` (GK, DEF, MID, FWD), `player_status`, `matchday_status` (upcoming, open, locked, finalised) and `fixture_status`.

**Times**: `timestamptz` in the database, ISO strings in TypeScript. The UI shows them in WAT.

**Which matchday a write is for.** Picks and transfers are always for the *next* matchday: the one with the earliest `deadline_at` still in the future. The server decides this from its own clock (`now()`), never from anything the browser sends.

**Write results.** Every write returns

```ts
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: FantasyErrorCode; message: string; playerIds?: string[] } };
```

From an RPC, the simplest form is: on success return the data; on failure `raise exception` with the message `'<CODE>: <human message>'`, for example `'OVER_BUDGET: Your squad costs ₦101.5m. The budget is ₦100.0m.'`. The adapter splits on the first `:`. If you'd rather return a JSON `{ ok, error }`, that works too; tell me which.

**Who calls.** Every function runs on the server (Server Components and Server Actions) with the user's session (`lib/supabase/server.ts`), so `auth.uid()` is the caller and RLS applies. No function needs the secret key except your scheduled or finalise jobs.

---

## 2. Reads

| Function | Returns | Source | Who may read | Status |
| --- | --- | --- | --- | --- |
| `getFantasyRules()` | `FantasyRules` | rules config | anyone | STUB |
| `getTeams()` | `Team[]` | `teams` | anyone | real |
| `getPlayers()` | `Player[]` | `players` + `teams` + your stats | anyone | real, `totalPoints` and `selectedByPct` STUB |
| `getMatchdayState()` | `MatchdayState` | `matchdays` + `fixtures` | anyone | real |
| `getMyManager()` | `Manager \| null` | `managers` | the caller | STUB |
| `getMyTeam()` | `MyTeam \| null` | squad + picks | the caller | STUB |
| `getTransferState()` | `TransferState \| null` | transfers, chips | the caller | STUB |
| `getTransferHistory()` | `TransferRecord[]` | `transfers` | the caller | STUB |
| `getManagerPoints(managerId, matchdayNumber)` | `ManagerMatchdayPoints \| null` | points tables | owner always; others after that matchday's deadline | STUB |
| `getMatchdayHistory(managerId)` | `MatchdayHistoryRow[]` | `manager_matchday_points` | anyone | STUB |
| `getRankings(scope, page, pageSize)` | `RankingPage` | rankings | anyone (PRD: viewers can see rankings) | STUB |
| `getMyLeagues()` | `League[]` | `leagues`, `league_members` | the caller | STUB |
| `getLeagueStandings(leagueId)` | `LeagueStandings \| null` | leagues + points | members of that league | STUB |

### 2.1 `getFantasyRules(): FantasyRules`

Every number the UI shows or checks against comes from here: budget, squad shape, per-year limit, formation ranges, bench size, captain multiplier, transfer rules, Wildcard count, deadline offset, league code length, team name length, and the scoring table (`scoring: ScoringRule[]`, one row per event with points for each position). The rules page is generated from it, so `label` and `note` should read well to a student.

Values the frontend expects for SEES 2026 (PRD):

```ts
{
  budgetTenths: 1000, squadSize: 15, squadPositions: { GK: 2, DEF: 5, MID: 5, FWD: 3 },
  maxPerTeam: 4, startingSize: 11,
  formation: { GK: {min:1,max:1}, DEF: {min:3,max:5}, MID: {min:2,max:5}, FWD: {min:1,max:3} },
  benchSize: 4, captainMultiplier: 2,
  freeTransfersPerMatchday: 1, maxSavedFreeTransfers: 2, transferHitPoints: 4,
  unlimitedTransferMatchdays: [1, 6], wildcardsPerManager: 1,
  deadlineMinutesBeforeKickoff: 30, leagueCodeLength: 6, teamNameMaxLength: 20,
  scoring: [ { key: "goal", label: "Goal", points: { GK: 6, DEF: 6, MID: 5, FWD: 4 } }, /* … all 12 rows */ ],
}
```

`ScoringKey` values: `appeared, played_30, goal, assist, clean_sheet, goals_conceded_2, penalty_saved, penalty_missed, yellow_card, red_card, own_goal, man_of_the_match`. Please use the same keys in points breakdowns (§2.7).

### 2.2 `getPlayers(): Player[]`

All players (about 103), including those marked injured, suspended or left, so the builder can show a flag. Already read from `players` joined to `teams`. Two fields need you:

- `totalPoints`: the player's fantasy points so far (finalised plus provisional).
- `selectedByPct`: the percentage of managers whose current squad holds the player, 0–100, one decimal place.

Suggested: a view `player_fantasy_stats (player_id, total_points, selected_by_pct)` readable by anyone.

### 2.3 `getMatchdayState(): MatchdayState`

Already real: all `matchdays` with their `fixtures`, ordered by number. `next` = the earliest matchday whose `deadline_at > now()`; `current` = the latest one whose deadline has passed. `serverNow` is the server's clock when it was read: countdowns use it to correct a wrong phone clock (design system §11.1). The frontend only needs you to keep `deadline_at` correct (30 min before the first kickoff, your M5 trigger) and to move `status` through upcoming → open → locked → finalised.

### 2.4 `getMyManager(): Manager | null`

`null` means the caller hasn't joined fantasy yet, so the UI sends them to onboarding. `managerName` is the profile's `display_name`; `yearGroup` is `profiles.year_group`.

### 2.5 `getMyTeam(): MyTeam | null`

The caller's squad for the next matchday, or `null` if they haven't picked one.

- `picks`: exactly 15 rows. **Slots 1–11 are the XI**, **slot 12 is the bench GK**, **slots 13–15 are the outfield bench in auto-sub order** (see Q8 in the scoring doc).
- Exactly one `isCaptain` and one `isViceCaptain`, both in the XI, different players.
- `bankTenths` = budget − cost of the squad. `squadValueTenths` = cost of the squad. (Prices never change, so buy and sell prices are equal.)
- `locked`: true once there is no next matchday (the season is over). Before any deadline it is false.

### 2.6 `getTransferState(): TransferState | null`

For the next matchday:

- `freeTransfers`: how many free transfers are left, or `null` for unlimited (no squad deadline passed yet, MD6, or Wildcard active).
- `made`: transfers already made for this matchday. `costPoints`: points already charged for it, as a positive number (8 = −8).
- `bankTenths`, and `wildcard: { available, activeThisMatchday, usedOnMatchday }`.
- `locked`: true if no matchday is open for transfers.

### 2.7 `getManagerPoints(managerId, matchdayNumber): ManagerMatchdayPoints | null`

The points breakdown screen. `null` if that manager has no picks snapshot for that matchday.

- One `PlayerPoints` row for each of the 15 picks, with its `slot`, `multiplier` (0 bench, 1, 2 captain or vice standing in), `autoSubIn` / `autoSubOut`, `minutes`, a `fixtureLabel` like `"Y1 v Y4"` (`null` if the team didn't play or it was a walkover), and `items`.
- `items` explains every point: `{ key, label, count, points }`, for example `{ key: "goal", label: "Goals", count: 2, points: 10 }`. The items must add up to `basePoints`, and `totalPoints = basePoints × multiplier`. Don't send zero-point items.
- `pointsBeforeCost` = sum of `totalPoints`; `total = pointsBeforeCost − transferCost`.
- **Added 20 Nov for the design system's points hero (§11.3):** `averagePoints` and `highestPoints` (the average and highest manager `total` that matchday, `null` if none), and `overallRank` / `previousOverallRank` (overall rank after this matchday and after the one before, `null` when there isn't one). The UI shows "▲ 1,204 → 312".
- `provisional` = true until you finalise the matchday.
- **RLS:** the owner can always read their own; anyone can read other managers' picks and points only after that matchday's deadline (PRD: "after it, squads lock and everyone's picks become visible").

The frontend **never** computes points. It only shows these numbers.

### 2.8 `getMatchdayHistory(managerId): MatchdayHistoryRow[]`

One row per matchday that has points: `matchdayNumber, points, transferCost, overallRank, provisional`.

### 2.9 `getRankings(scope, page, pageSize): RankingPage`

- `scope` is `{ kind: "overall" }` or `{ kind: "year", year: 1–5 }` (year from `profiles.year_group`).
- `page` starts at 1. `pageSize` is 50.
- `rows` sorted by `totalPoints` desc, then team name. **Ties share a rank**: 1, 2, 2, 4 (scoring doc E18).
- `me`: the caller's row in this scope (so the UI can pin it), or `null`.
- `lastMatchdayPoints`: points in the latest matchday with points.
- `provisional`: true while the latest matchday isn't finalised.

### 2.10 `getMyLeagues(): League[]` and `getLeagueStandings(leagueId): LeagueStandings | null`

- `League = { id, name, code, memberCount, isOwner, myRank }`.
- Standings rows use the same `RankingRow` shape and tie rule, ranked within the league.
- `null` (or `LEAGUE_NOT_FOUND`) if the caller isn't a member. The code itself is only shown to members.

---

## 3. Writes

All writes: caller must be signed in (`NOT_SIGNED_IN`), and every check below happens on the server even though the UI checks first. The UI's checks (`lib/fantasy/validate.ts`) are only for instant feedback.

### 3.1 `createManager({ teamName, yearGroup }): ActionResult<Manager>`

Onboarding after Google sign-in.

| Rule | Error code |
| --- | --- |
| Caller has no manager yet | `MANAGER_EXISTS` |
| `teamName` trimmed, 3 to `teamNameMaxLength` characters | `TEAM_NAME_INVALID` |
| Team name unique (case-insensitive) — your call, see open questions | `TEAM_NAME_INVALID` |
| `yearGroup` is 1–5 or `null` ("not in a year team") | `YEAR_GROUP_INVALID` |

Also sets `profiles.year_group` (the user can already update their own profile under the base schema's RLS).

### 3.2 `saveSquad({ playerIds }): ActionResult<MyTeam>`

The first 15 players. After this, changes go through `makeTransfers`.

| Rule | Error code | Example message |
| --- | --- | --- |
| Caller is a manager | `NO_MANAGER` | Create your team first. |
| No squad yet | `SQUAD_EXISTS` | You already have a squad. Use Transfers to change it. |
| There is a next matchday and its deadline hasn't passed | `DEADLINE_PASSED` / `NO_OPEN_MATCHDAY` | The Matchday 2 deadline has passed. |
| Every id is a real player | `PLAYER_UNKNOWN` | |
| No duplicates | `PLAYER_DUPLICATE` | |
| Exactly `squadSize` players | `SQUAD_SIZE` | Pick 15 players. You have 14. |
| Exactly `squadPositions` per position | `SQUAD_POSITIONS` | You need 2 GK, 5 DEF, 5 MID, 3 FWD. You have 3 FWD too few. |
| Total cost ≤ `budgetTenths` | `OVER_BUDGET` | Your squad costs ₦101.5m. The budget is ₦100.0m. |
| At most `maxPerTeam` from one year | `TEAM_LIMIT` (with `playerIds`) | You have 5 players from Year 2. The limit is 4. |

Injured, suspended or left players are **allowed** (the PRD only asks for a flag). Tell me if you want to block `left`.

On success, the server picks a default lineup so the team is valid straight away. Suggested: GK slot 1 = the dearer GK, then the most expensive valid 4-4-2 (ties by name), captain = the dearest starter, vice = the next. The UI then sends the manager to My team to change it.

### 3.3 `saveLineup(LineupInput): ActionResult<MyTeam>`

```ts
type LineupInput = { starters: string[] /* 11 */; bench: string[] /* [GK, out1, out2, out3] */; captainId: string; viceCaptainId: string };
```

| Rule | Error code |
| --- | --- |
| Deadline of the next matchday hasn't passed (server clock) | `DEADLINE_PASSED` |
| `starters` + `bench` are exactly the 15 squad players, each once | `LINEUP_NOT_IN_SQUAD` |
| XI counts within `formation` (1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD) | `FORMATION_INVALID` |
| `bench[0]` is a GK | `BENCH_GK_INVALID` |
| Captain and vice are in the XI and are different players | `CAPTAIN_INVALID` |

Saves to the live squad. At the deadline you copy it into the matchday's snapshot (F4). Later edits must never change a snapshot.

### 3.4 `makeTransfers({ out, in }): ActionResult<TransferState>`

Several transfers in one confirm. `out[i]` is replaced by `in[i]`, and the new player takes the old one's slot (and captaincy, which the UI then asks the manager to check).

| Rule | Error code |
| --- | --- |
| Deadline not passed | `DEADLINE_PASSED` |
| Manager has a squad | `NO_SQUAD` |
| `out` and `in` same length, ≥ 1; every `out` in the squad, no `in` already in it, no duplicates | `TRANSFER_INVALID` |
| `in[i]` has the same position as `out[i]` | `TRANSFER_POSITION` |
| Bank after the swap ≥ 0 | `OVER_BUDGET` |
| Per-year limit still holds | `TEAM_LIMIT` |

Cost: for each transfer beyond the free ones, `transferHitPoints` (4) is charged to **this** matchday. No cost when transfers are unlimited (before the MD1 deadline, MD6) or the Wildcard is active. Saved free transfers follow `maxSavedFreeTransfers` (see Q1 in the scoring doc).

The UI shows the cost before the manager confirms (from `getTransferState`), so please return the new `TransferState` so the numbers match what was charged.

Undo: not supported. If a manager transfers a player in and back out, that counts as two transfers (FPL behaviour). Tell me if you'd rather net them off.

### 3.5 `activateWildcard(): ActionResult<TransferState>`

| Rule | Error code |
| --- | --- |
| Deadline not passed | `DEADLINE_PASSED` |
| Not already used (`wildcardsPerManager`) | `WILDCARD_USED` |
| Allowed for this matchday (Q7: maybe not MD1 or MD6) | `WILDCARD_NOT_ALLOWED` |

Effect: all transfers for this matchday are free, including any already charged (refund them, FPL behaviour), and it can't be cancelled. Ask me if you want it different: the UI says "This can't be undone".

### 3.6 `createLeague({ name }): ActionResult<League>`

- Name 3–30 characters → `LEAGUE_NAME_INVALID`.
- Server generates a unique `leagueCodeLength` code from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O, 1/I, to avoid typos).
- The creator joins automatically. Needs a manager (`NO_MANAGER`).

### 3.7 `joinLeague({ code }): ActionResult<League>`

- The UI uppercases and trims. Wrong length or characters → `LEAGUE_CODE_INVALID`.
- No such code → `LEAGUE_NOT_FOUND`. Already in → `LEAGUE_ALREADY_MEMBER`.
- Joining after matchday 1 is fine; members are ranked on total points.

### 3.8 Error messages the UI shows

The UI shows your `message` as is, so please write it for a student on a phone: one short sentence, naira amounts as `₦100.0m`, matchdays as "Matchday 2". If `message` is empty, the UI falls back to its own copy for the code (`lib/fantasy/errors.ts`). `UNKNOWN` covers anything else; the UI says "Something went wrong. Try again."

---

## 4. Suggested tables

These fit the base schema (`profiles`, `players.price_tenths`, `player_position`, `matchdays.status`). RLS on every table, every foreign key indexed, per AGENTS.md.

| Table | Suggested columns | RLS |
| --- | --- | --- |
| `fantasy_rules` (one row) | `id smallint pk check (id = 1)`, `budget_tenths smallint`, `squad_size`, `squad_gk`, `squad_def`, `squad_mid`, `squad_fwd`, `max_per_team`, `starting_size`, `xi_def_min/max`, `xi_mid_min/max`, `xi_fwd_min/max`, `bench_size`, `captain_multiplier`, `free_transfers_per_matchday`, `max_saved_free_transfers`, `transfer_hit_points`, `unlimited_transfer_matchdays smallint[]`, `wildcards_per_manager`, `deadline_minutes_before_kickoff`, `league_code_length`, `team_name_max_length` | read: anyone · write: `is_admin()` |
| `fantasy_scoring_rules` | `key text pk`, `label`, `note`, `gk smallint`, `def`, `mid`, `fwd`, `sort_order` | read: anyone · write: `is_admin()` |
| `managers` | `id uuid pk references profiles(id)`, `team_name text not null`, `bank_tenths smallint not null`, `created_at` (unique index on `lower(team_name)` if names must be unique) | read: anyone (rankings) · insert/update: `id = auth.uid()` (team name only) |
| `squad_players` (live squad) | `manager_id → managers`, `player_id → players`, `slot smallint 1–15`, `is_captain bool`, `is_vice bool`, `price_tenths smallint` (price paid), pk `(manager_id, player_id)`, unique `(manager_id, slot)` | read: own · writes only through your RPCs (`security definer`) |
| `picks` (snapshot per matchday, F4) | `manager_id`, `matchday_id → matchdays`, `player_id`, `slot`, `is_captain`, `is_vice`, `multiplier smallint`, `auto_sub_in bool`, `auto_sub_out bool`, pk `(manager_id, matchday_id, player_id)` | read: own always; others when the matchday's `deadline_at <= now()` · write: snapshot job only |
| `transfers` | `id`, `manager_id`, `matchday_id`, `player_out_id`, `player_in_id`, `price_out_tenths`, `price_in_tenths`, `is_free bool`, `made_at` | read: own · write: RPC only |
| `chips` | `manager_id`, `chip text check (chip = 'wildcard')`, `matchday_id`, `played_at`, unique `(manager_id, chip)` | read: own (others after the deadline) · write: RPC only |
| `player_matchday_points` | `player_id`, `matchday_id`, `fixture_id null`, `minutes`, `items jsonb` (the `PointsItem[]`), `total smallint`, `provisional bool`, pk `(player_id, matchday_id)` | read: anyone · write: engine only |
| `manager_matchday_points` | `manager_id`, `matchday_id`, `points_before_cost`, `transfer_cost`, `total`, `provisional bool`, `overall_rank int`, `year_rank int`, `calculated_at`, pk `(manager_id, matchday_id)` | read: anyone · write: engine only |
| `leagues` | `id`, `name`, `code char(6) unique`, `owner_id → managers`, `created_at` | read: members (and the RPC for joining by code) · write: RPC only |
| `league_members` | `league_id → leagues`, `manager_id → managers`, `joined_at`, pk `(league_id, manager_id)` | read: members of the same league · write: RPC only |

Helpful views: `player_fantasy_stats` (§2.2) and `manager_rankings (manager_id, total_points, last_matchday_points, overall_rank, year_rank)`.

---

## 5. What the frontend assumes

1. **Server is the source of truth.** The UI checks squads, formations and transfer costs only for instant feedback. If the server says no, the UI shows the server's message.
2. **Deadline from the server clock.** The UI shows a countdown from `matchdays.deadline_at` and disables saving at zero, but the server's rejection (`DEADLINE_PASSED`) is what counts. The UI then reloads and shows the locked view.
3. **One team per Google account.** `managers.id = profiles.id`.
4. **Slots describe the lineup**: 1–11 XI, 12 bench GK, 13–15 bench order. The UI orders the XI by position itself, so the order inside 1–11 doesn't matter.
5. **Transfers are like-for-like by position**, so the squad shape never changes.
6. **Points arrive pre-calculated**, with a per-player `items` breakdown. The UI never adds rule values together.
7. **Ranks arrive pre-calculated**, ties already shared.
8. **Rankings and rules are public**, as in the PRD's role table. All other fantasy pages need a signed-in user.
9. **Realtime is not needed for v1.** The points pages reload on navigation. If you add live provisional points later, a Realtime channel on `manager_matchday_points` would be enough.
10. **Matchday 6 teams** may be unknown (TBD v TBD) until the league ends. Fixtures with no teams are shown as "TBD".

---

## 6. Open questions for Mary

1. RPCs or direct table writes for the writes? I've assumed one `security definer` RPC per write, named like the functions above in snake_case (`save_squad`, `save_lineup`, `make_transfers`, `activate_wildcard`, `create_manager`, `create_league`, `join_league`).
2. Error format: `raise exception 'CODE: message'` (my default) or a returned JSON?
3. Must team names be unique?
4. Default lineup after `saveSquad`: do you pick it (my suggestion) or should the UI send one?
5. Block players marked `left` from new squads, or only flag them?
6. Wildcard: refund transfer costs already charged that matchday when it's played?
7. Transfers in and back out in one matchday: two transfers, or net off?
8. Does `getManagerPoints` include bench players' points (`multiplier = 0`)? I'd like it to, so the UI can show them greyed out.
9. The scoring-rule questions Q1–Q13 in `docs/fantasy-scoring-examples.md`, especially Q1 (saved transfers), Q6 (auto-sub maximums), Q7 (Wildcard with MD1 and MD6) and Q8 (bench GK slot), which also change this contract.
