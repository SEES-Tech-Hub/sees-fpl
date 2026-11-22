# Live scores backend: team guide

Owner: Bolu. Questions, or something here doesn't match the code? Post in the dev group and tag me.

This guide is for everyone who builds on live scores:

- **Samuel** (match console): [Console API](#console-api-samuel)
- **Fortune** (match, sport and home pages): [Reading data](#reading-data-fortune) and [Realtime guide](#realtime-guide)
- **Fortune** (table and stats pages): [Football table and stats](#football-table-and-stats-fortune)
- **Mary** (fantasy engine): [player_match_stats](#player_match_stats-mary)
- **Henry and Tayo** (admin and database): [What changed on fixtures](#what-changed-on-fixtures-henry-and-tayo) and [Knockouts and bans](#knockouts-and-bans-henry)

## The idea in one paragraph

An official taps a button on the console. That calls one server action, which calls one database function, which adds one row to `match_events`. A trigger then recalculates the fixture's score, status, period and winner from all of that match's events, and Realtime pushes the change to every open page. **Nothing is ever typed in twice and no score is ever written by hand.** A mistake is never deleted: it's *voided*, and the fixture is recalculated as if it never happened.

```
console button
   -> recordMatchEvent()            lib/live/actions.ts   (checks the request)
   -> record_match_event()          database function     (checks who you are and what the match allows)
   -> match_events (new row)        append-only log
   -> trigger: refresh_fixture_state()
   -> fixtures (score, status, period, clock, winner)
   -> Realtime -> open pages and consoles update
```

## Words we use

| Word | Meaning |
| --- | --- |
| Fixture | One match, race or game (`fixtures` table). |
| Event | A competition inside a sport, like "Football (men)" or "100 m men" (`events` table). Not to be confused with... |
| Match event | Something that happened in a match: kickoff, goal, card, sub (`match_events` table). |
| Console holder | The one official account allowed to record a fixture (`fixtures.console_holder`). The admin can always record too. |
| Void | Undo. The row stays, with `voided_at` set, and is ignored everywhere. |
| Period | `first_half`, `second_half`, `extra_first`, `extra_second`, `penalties`. |

## Where things live

| File | What it is | Use from |
| --- | --- | --- |
| `supabase/migrations/20261119203500_live_match_events.sql` | Phase 1: tables, rules, console functions, Realtime | — |
| `supabase/migrations/20261122113000_live_stats_standings.sql` | Phase 2: player stats, table, totals, bans, knockout fill | — |
| `lib/live/types.ts` | Shared types: requests, results, errors, stats and table rows | Anywhere |
| `lib/live/actions.ts` | Console API (server actions) | Client or server |
| `lib/live/queries.ts` | Reads for the match page and console | Server Components |
| `lib/live/realtime.ts` | Realtime subscriptions | Client Components |
| `lib/live/clock.ts` | Live clock and match minute | Anywhere |
| `lib/live/stats.ts` | Player match stats, football table, top scorers, totals, bans | Server |
| `lib/live/commands.ts`, `errors.ts`, `stats-rows.ts` | Request checking, error mapping, row mapping (internal) | — |
| `lib/live/*.test.ts` | Unit tests: `pnpm test` | — |

---

## Console API (Samuel)

Import from `@/lib/live/actions`. Every action returns:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: LiveErrorCode; message: string; retryable: boolean } };
```

`error.message` is written for the official, so show it as it is (for example in a toast). The actions never throw for expected problems. If one throws, the network is down.

### The actions

| Action | Input | Who |
| --- | --- | --- |
| `takeFixture(fixtureId)` | "Take this match" | Officials, when nobody holds it |
| `releaseFixture(fixtureId)` | "Hand over" | The holder (or admin) |
| `setLineup({ fixtureId, teamId, starters, bench })` | Ticked starters (1 to 11) and the rest of the squad as bench | Holder before kickoff; admin any time |
| `recordMatchEvent(input)` | One event (table below) | Holder or admin |
| `undoMatchEvent({ clientEventId, reason? })` | Undo | Holder: own latest event, within 30 s. Admin: any event, reason required |

**Hand-over** is two steps: `releaseFixture` on the old phone, then `takeFixture` on the new one. If the old phone is dead, the admin clears or reassigns `console_holder` in the admin portal. The new holder carries on from the same event log.

### Recording events

Every event needs `fixtureId`, `clientEventId` and `type`. `occurredAt` is optional.

- **`clientEventId`**: make it with `crypto.randomUUID()` *when the button is tapped*, and keep it with the queued action. Sending the same event twice records it once, so retrying is always safe.
- **`occurredAt`**: the tap time as an ISO string (`new Date().toISOString()`). Send it when replaying the offline queue, so minutes are right. The server never accepts a time in the future or before the previous event, and refuses anything more than 6 hours old from an official.

| `type` | Extra fields | Notes |
| --- | --- | --- |
| `period_start` | `period` | Kick off. Order: first_half → second_half → (knockouts, if level) extra_first → extra_second → penalties. Penalties can also follow the second half. |
| `period_end` | — | Half time or end of a period. Status becomes `half_time` (a break). |
| `goal` | `teamId`, `scorerId?`, `assistId?`, `penalty?`, `ownGoal?` | `teamId` is the team the goal counts for. For an own goal, `scorerId` is the opponent who put it in their own net, and there's no assist. |
| `card` | `teamId`, `playerId`, `colour` | A second yellow: record a `red` (the console can warn using `yellowCards` from the lineup). |
| `substitution` | `teamId`, `playerOffId`, `playerOnId` | Allowed at half time too. No re-entry: a player who came off can't come back on. |
| `penalty_miss` | `teamId`, `takerId`, `savedById?` | Normal or extra time only. `savedById` is the goalkeeper if they saved it. |
| `shootout_kick` | `teamId`, `takerId?`, `scored` | During `penalties` only. |
| `man_of_the_match` | `playerId` | Once per match, during or after it. Undo it to change it. |
| `full_time` | — | After the second half (league), or once there's a winner (knockout). |
| `walkover` | `teamId` (awarded), `points?` (default 3) | Admin only, instead of playing. Gives 3–0 and no player points. |

Example:

```ts
const result = await recordMatchEvent({
  fixtureId,
  clientEventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  type: "goal",
  teamId: homeTeamId,
  scorerId,
  assistId, // or null
});
if (!result.ok) toast.error(result.error.message);
```

### Offline queue rules

1. Store each action with its `clientEventId` and `occurredAt` from the moment of the tap.
2. Send them **one at a time, in order**.
3. The action **throws** (no network) or returns `retryable: true`: stop, keep it and the rest of the queue, and try again later.
4. It returns `retryable: false`: drop that action, show `error.message`, and carry on with the next one.
5. `ok: true`: remove it from the queue.

**Undo:** if the action is still in the queue, just remove it. If it was sent, call `undoMatchEvent({ clientEventId })`. The server allows the holder's undo for 30 s after the event reached it, so the console's 10-second button always works even on a slow connection. After that it returns `undo_expired`: tell the official to ask the admin.

### Who's on the pitch

`getFixtureLineups(fixtureId)` (in `queries.ts`) returns each lineup player with `onPitch`, `appeared`, `sentOff` and `yellowCards`. Use it for the substitution picker (off: `onPitch`; on: bench players with `!appeared && !sentOff`) and to warn on a second yellow. When a team has a lineup, the server refuses goals, assists, cards and subs by players who aren't in the right place. With no lineup it only checks the player is in that team's squad.

### Error codes

| Code | When |
| --- | --- |
| `not_signed_in`, `forbidden` | Not signed in, or the account isn't allowed to call this |
| `not_official` | Only officials can take a match |
| `not_holder` | Someone else holds this match (or you lost the official role) |
| `already_held` | Take failed: another official holds it |
| `admin_only` | Walkovers are admin only |
| `fixture_not_found`, `fixture_closed`, `teams_not_set`, `wrong_format` | The fixture doesn't exist, is over/postponed/cancelled, has no teams yet (knockouts), or isn't a timed match |
| `invalid_state` | Not allowed right now (a goal at half time, full time before the second half) |
| `invalid_period` | That period can't start now (extra time in a league match, or not level) |
| `needs_winner` | Knockout full time while level: go to extra time or penalties |
| `wrong_team`, `player_not_found`, `player_left`, `player_suspended` | The player isn't in that team, doesn't exist, has left, or is suspended |
| `player_banned` | Lineup: the player was sent off in the team's last match (1-match ban). The admin can override |
| `invalid_lineup`, `lineup_locked` | Duplicates or wrong count; lineups lock at kickoff |
| `not_on_pitch`, `not_in_lineup`, `not_on_bench`, `sent_off` | Lineup checks |
| `duplicate_motm` | Man of the Match is already picked |
| `undo_expired`, `undo_not_latest`, `undo_not_allowed`, `event_not_found` | Undo checks |
| `reason_required` | Admin corrections need a reason |
| `too_old`, `invalid_time` | Event time more than 6 hours ago; correction time before kickoff |
| `league_not_finished`, `standings_tied` | Knockout fill: league matches still to play, or a tie on every tie-breaker decides who qualifies |
| `invalid_input`, `duplicate_id` | The request itself is malformed |
| `unavailable` (retryable) | Network or database busy: try again |
| `unknown` | Unexpected: it's logged on the server. Tell Bolu |

---

## Reading data (Fortune)

Import from `@/lib/live/queries` in Server Components (inside `<Suspense>`, as with any data):

| Function | Returns |
| --- | --- |
| `getLiveFixture(fixtureId)` | `LiveFixture`: teams, score, shootout score, status, current period, `periodStartedAt`, winner, period lengths, sport. `null` if not found |
| `getMatchTimeline(fixtureId)` | `TimelineEntry[]` in order, each with `minute`/`addedMinutes` and player and team names |
| `getFixtureLineups(fixtureId)` | `LineupPlayer[]`: starters first, with on-pitch state |

They read public data as an anonymous visitor and are **not cached on the server**, on purpose: when Realtime reports a goal and the page refreshes, it must get the goal. (A server cache lives on one Vercel instance, so expiring it can't guarantee that.) Within one request each result is shared, so calling `getLiveFixture` from both `generateMetadata` and the page costs one query.

For lists that can be a few seconds stale (sport pages, fixtures by date), caching with `'use cache'` is fine: tag them with `liveTags.fixtureList` (in `lib/live/tags.ts`). Every console action expires that tag.

### The live clock

```ts
import { getClockState, msUntilNextMinute } from "@/lib/live/clock";

const clock = getClockState({
  status: fixture.status,
  currentPeriod: fixture.currentPeriod,
  periodStartedAt: fixture.periodStartedAt,
  periodMinutes: fixture.event.periodMinutes,
  extraPeriodMinutes: fixture.event.extraPeriodMinutes,
});
// clock.label: "13'", "25+2'", "HT", "End of normal time", "Penalties", "FT", "W/O", "Postponed"...
```

The clock runs from `periodStartedAt` on each phone, so nothing is sent every second. Use `msUntilNextMinute()` to schedule the next re-render once a minute instead of every second (better for phone batteries). Timeline minutes come from the database's `match_minute()`, which uses the same rules, so the clock and the timeline always agree.

Status and period together say what to show:

| `status` | `currentPeriod` | Show |
| --- | --- | --- |
| `scheduled` | — | Kickoff time (WAT) |
| `live` | `first_half` … `extra_second` | Running clock |
| `half_time` | the period that just ended | HT / End of normal time / ET half time / End of extra time |
| `live` | `penalties` | Shootout score (`homeShootout`–`awayShootout`) |
| `full_time` | — | FT, plus "(pens)" when `homeShootout` is not null |
| `walkover` | — | W/O, score 3–0 |

---

## Realtime guide

Realtime is on for `fixtures`, `match_events` and `lineups`. Anyone can subscribe (the data is public). Use the helpers in `lib/live/realtime.ts` with the browser client:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { subscribeToFixture, type ConnectionStatus } from "@/lib/live/realtime";

export function LiveFixtureUpdater({ fixtureId }: { fixtureId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(
    () =>
      subscribeToFixture(createClient(), fixtureId, {
        onFixture: () => router.refresh(), // or apply the new score straight from the row
        onEvent: () => router.refresh(),   // timeline: new event, or one undone
        onLineup: () => router.refresh(),
        onStatus: setStatus,               // show "Reconnecting..." when not "live"
      }),
    [fixtureId, router],
  );

  return status === "live" ? null : <p role="status">Reconnecting...</p>;
}
```

- `onFixture` gets the whole new fixtures row (snake_case). For the score header you can apply it directly without a refresh.
- `onEvent` gets the event in camelCase with `{ voided }`. Rows from Realtime have no minute or names, so `router.refresh()` is the simple, correct way to update the timeline.
- `subscribeToFixtures(client, { onFixture })` listens to every fixture. Use it for the home page "Live now" cards.
- Always return the unsubscribe function from `useEffect` (as above), or channels pile up.
- Accessibility: put the score in an element with `aria-live="polite"` so screen readers announce changes.

---

## Football table and stats (Fortune)

Import from `@/lib/live/stats` in Server Components. Like the match reads, these aren't cached on the server, so a page refreshed after a goal shows the new table. Football has one event today; leave `eventId` out to use it.

| Function | Returns |
| --- | --- |
| `getFootballStandings(eventId?)` | `StandingRow[]` in order: position, team, P W D L, GF GA GD, points. `live: true` while that team is playing; `positionShared: true` when two teams are level on every tie-breaker |
| `getTopScorers(limit?, { eventId? })` | Most goals first (then assists, then fewer minutes). Own goals don't count |
| `getTopAssisters(limit?, { eventId? })` | Most assists first |
| `getPlayerTotals(eventId?)` | `PlayerTotalsRow[]`: appearances, minutes, goals, assists, clean sheets, cards, Man of the Match per player |
| `getSuspensions(eventId?)` | `SuspensionRow[]`: who is banned, the fixture they miss, and whether the ban is served |

The table follows the rulebook: win 3, draw 1, loss 0, then goal difference, goals scored, then head-to-head among the teams still level. It counts matches in progress at their current score, and a walkover at its awarded score.

**Keeping the table live:** subscribe with `subscribeToFixtures` (it fires on every score change) and call `router.refresh()`, as on the match page. There's no separate standings channel: the table is worked out from fixtures every time it's read.

A clean sheet in the totals is a finished match (not a walkover) with 30 minutes or more on the pitch and nothing conceded while on it, as the PRD defines it.

---

## player_match_stats (Mary)

`getPlayerMatchStats({ matchdayId })` or `getPlayerMatchStats({ fixtureId })` in `lib/live/stats.ts` returns `PlayerMatchStats[]` (in `lib/live/types.ts`). It has every field of your `PlayerMatchStats` in `lib/fantasy/engine-types.ts` with the same names, so it can replace `loadMatchdayPlayerStats`. A test fails if the two shapes drift apart. You can also read the `player_match_stats` view directly with any Supabase client; it's public.

It holds **facts only**. Rule values like "clean sheet needs 30 minutes" or "a goal is worth 6" stay in your rules table, so a rule change never needs a stats change.

**Who gets a row:** everyone in the fixture's lineups (unused subs too, with `appeared: false`), plus anyone named in an event. A walkover with no lineups has no rows, so every player counts as not having played.

**Minutes** use the match clock, the minute the referee would call (Akeem's Q11). Half time and stoppage time don't count; extra time does. A starter is on from 0'; a substitute from the minute they came on; a player stops at the minute they're subbed off or sent off, otherwise at the end of the last period played (50', or 64' after extra time). During a match, minutes run up to the current clock minute, so live points work.

| Case | `minutesPlayed` |
| --- | --- |
| Starts and plays to full time (with 3 minutes of stoppage) | 50 |
| Comes on at 20' | 30 |
| Subbed off at 29' | 29 |
| Subbed at half time (off and on) | 25 and 25 |
| Sent off at 35' | 35 |
| Unused substitute | 0 (`appeared: false`) |

**Goals conceded on the pitch** are goals for the other team while the player was on, in the order events were recorded. A substitution and a goal in the same minute are told apart by which was recorded first.

**Open questions, answered by the data either way:**

- Q2 (second yellow): a second yellow is recorded as a red, so the row has `yellowCards: 1, redCards: 1` and `redFromSecondYellow: true`. Version A counts both cards; version B ignores the yellow when `redFromSecondYellow` is set. (A straight red for a player already on a yellow looks the same. That's rare enough to correct by hand.)
- Q4 (own goals and clean sheets): `goalsConcededOnPitch` includes own goals by teammates, and `ownGoalsConcededOnPitch` says how many there were. Version B subtracts them.
- Q10: an own goal gives no goal or assist to anyone. Only `ownGoals` for the player who scored it.

**Corrections:** the view is worked out when it's read, so a void or correction changes the stats at once. Recalculate the matchday's points after an admin correction, as `recalculateMatchdayAndRankings` already does.

**If a team has no lineup**, a player named in an event is assumed to have started (`lineupSet: false`), so minutes are a guess. The console should always set lineups before kickoff.

---

## What changed on fixtures (Henry and Tayo)

The migration adds two columns, `fixtures.home_shootout` and `away_shootout`, and `events.extra_period_minutes` (football: 7). It also adds a guard on `fixtures` for requests from the app:

- `home_score`, `away_score`, the shootout scores, `current_period`, `period_started_at` and `winner_team_id` **can't be written by hand**. They come from match events.
- `status` can only move between `scheduled`, `postponed` and `cancelled`, and only while the fixture has no active match events. Live, half time, full time and walkover come from match events.
- Once a fixture has match events, its teams and event can't change.
- `console_holder` can only be set to an official or admin account.

The SQL editor (no signed-in user) isn't restricted, as with the role guard.

**For the admin portal:**

- A walkover is `recordMatchEvent({ type: "walkover", teamId })`, not a status change.
- A correction is `undoMatchEvent({ clientEventId, reason })` (the admin can void any event), then `recordMatchEvent` with the right details. After full time the admin may pass an earlier `occurredAt` for goals, cards, subs, missed penalties and Man of the Match. The admin can also enter a whole match afterwards from the referee's sheet, with the real times.
- Every voided event keeps who voided it, when and why (`voided_by`, `voided_at`, `void_reason`). The audit log can read straight from `match_events`.

**For the reset script:** match events can't be deleted from the app, but they can be from the SQL editor or with the secret key (no signed-in user).

---

## Knockouts and bans (Henry)

**Filling the final and third-place match.** Henry's `fillKnockouts({ eventId })` calls the database function:

```ts
const { data, error } = await supabase.rpc("fill_football_knockouts", { p_event_id: eventId });
// data: the two fixtures with their new teams. Map error with toLiveError() from lib/live/errors.ts.
```

It puts 1st v 2nd into the final and 3rd v 4th into the third-place match (the higher-placed team at home). It's admin only and safe to call again. It refuses with:

| Code | Meaning |
| --- | --- |
| `league_not_finished` | A league match isn't at full time, a walkover or cancelled yet |
| `standings_tied` | 2nd and 3rd, or 4th and 5th, are level on every tie-breaker. The organisers decide; the admin then sets those teams by hand with `updateFixture` |
| `has_events` | A knockout fixture already has match events, so its teams can't change |

It doesn't run by itself when the last league match ends, because a late correction could still change the table. The admin dashboard can show a "Fill the final" button once the league is finished.

**Red-card bans.** The rulebook gives a 1-match ban for a red card. `football_suspensions` (and `getSuspensions()`) lists each ban with the fixture it's served in: the team's next fixture in the same event by kickoff time, ignoring cancelled ones. `set_lineup` refuses a banned player for that fixture (`player_banned`), except for the admin, so an appeal can be honoured. Voiding the red card removes the ban. `players.status = 'suspended'` is still there for longer bans the organisers hand out.

---

## Rules the database enforces

These rules hold whatever the app does. They're tested in 170+ database scenarios:

- Only the console holder (or the admin) writes to a fixture, and only while they still have the official role.
- Events are append-only: no edits, no deletes from the app. Undo is a void.
- The same `clientEventId` is never recorded twice.
- Event times are never in the future and never before the previous event.
- Periods run in order. Extra time and penalties happen only in knockouts, only when level. A knockout can't finish level.
- Players must belong to the team, and (with lineups) be on the pitch or the bench as the event needs. A sent-off player does nothing more.
- Officials undo only their own latest event, within 30 s. The admin's corrections need a reason.
- A player sent off misses the team's next fixture (the admin can override).
- Stats, the table, totals and bans are views: they can't be written to, and they always match the events.

---

## Roadmap

### Phase 1: timed match core and console API (merged 20 Nov)

Football works end to end on the database side: `match_events` and `lineups`, the one-holder lock (take and hand over), recording every football event with offline-safe retries, undo and admin corrections, walkovers, the derived score/status/clock/winner, the timeline with match minutes, Realtime, and the TypeScript API above. Also the agreed phase 2 shapes, so Mary and Fortune aren't blocked.

### Phase 2: derived football data (22 Nov)

- `player_match_stats`: match-clock minutes (subs, red cards, extra time), goals conceded while on the pitch, the second-yellow flag, every stat in the contract. Checked against Akeem's minutes and clean-sheet examples (E4, E5).
- Football table in rulebook order: 3/1/0, then goal difference, goals scored, head-to-head. Live during matches.
- Knockout fill: the final and third-place match get their teams from the final table (`fill_football_knockouts`, called by Henry's `fillKnockouts`).
- Top scorers, top assisters, clean sheets, cards, and 1-match bans enforced on lineups.
- Corrections: everything is a view, so a void updates stats, the table and totals at once. Voids are already in Henry's audit feed.

### Phase 3: other formats and the championship (21 Nov, hardened on the 22–23 Nov test days)

- Sets match (volleyball, badminton, table tennis, lawn tennis): set scores, set and match winner, best-of-3. Volleyball's group stage and best-loser match.
- Head-to-head (board games, mobile games, Mortal Kombat): winner, optional score, round, brackets.
- Ranked result (athletics, swimming): entrants, finishing order, times or marks, DQs, heats feeding finals.
- Basketball and handball periods (quarters) on the timed format.
- Medal table or overall points, once the organisers decide the rule.
- Load check for 1,000 viewers at the final (moving hot paths from postgres changes to Realtime broadcast if needed), and a results export for the admin.

## Open questions (need answers from the organisers)

- Volleyball: ranking points, tie-breakers, team size and the forfeit rule are blank in the rulebook.
- How the overall champion is decided: medal count or points per placing.
- Basketball and handball: period lengths and counts.
