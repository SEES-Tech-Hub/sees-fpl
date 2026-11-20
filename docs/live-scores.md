# Live scores backend: team guide

Owner: Bolu. Questions, or something here doesn't match the code? Post in the dev group and tag me.

This guide is for everyone who builds on live scores:

- **Samuel** (match console): [Console API](#console-api-samuel)
- **Fortune** (match, sport and home pages): [Reading data](#reading-data-fortune) and [Realtime guide](#realtime-guide)
- **Mary** (fantasy engine): [player_match_stats](#player_match_stats-mary)
- **Henry and Tayo** (admin and database): [What changed on fixtures](#what-changed-on-fixtures-henry-and-tayo)

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
| `supabase/migrations/20261119184500_live_match_events.sql` | Tables, rules, database functions, Realtime | — |
| `lib/live/types.ts` | Shared types: requests, results, errors, phase 2 contracts | Anywhere |
| `lib/live/actions.ts` | Console API (server actions) | Client or server |
| `lib/live/queries.ts` | Reads for the match page and console | Server Components |
| `lib/live/realtime.ts` | Realtime subscriptions | Client Components |
| `lib/live/clock.ts` | Live clock and match minute | Anywhere |
| `lib/live/stats.ts` | Standings, top scorers, player stats (phase 2 placeholders) | Server |
| `lib/live/commands.ts`, `errors.ts` | Request checking and error mapping (internal) | — |
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
| `goal` | `teamId`, `scorerId?`, `assistId?`, `penalty?`, `ownGoal?` | `teamId` is the team the goal counts for. For an own goal, `scorerId` is the opponent who put it in his own net, and there's no assist. |
| `card` | `teamId`, `playerId`, `colour` | A second yellow: record a `red` (the console can warn using `yellowCards` from the lineup). |
| `substitution` | `teamId`, `playerOffId`, `playerOnId` | Allowed at half time too. No re-entry: a player who came off can't come back on. |
| `penalty_miss` | `teamId`, `takerId`, `savedById?` | Normal or extra time only. `savedById` is the goalkeeper if he saved it. |
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
| `invalid_lineup`, `lineup_locked` | Duplicates or wrong count; lineups lock at kickoff |
| `not_on_pitch`, `not_in_lineup`, `not_on_bench`, `sent_off` | Lineup checks |
| `duplicate_motm` | Man of the Match is already picked |
| `undo_expired`, `undo_not_latest`, `undo_not_allowed`, `event_not_found` | Undo checks |
| `reason_required` | Admin corrections need a reason |
| `too_old`, `invalid_time` | Event time more than 6 hours ago; correction time before kickoff |
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

## player_match_stats (Mary)

The agreed row shape is `PlayerMatchStats` in `lib/live/types.ts`: one row per player per fixture, with minutes played (from kickoff, subs, red cards and full time, extra time included), goals, assists, own goals, goals conceded while on the pitch, cards, penalties missed and saved, Man of the Match, `walkover` and `fixtureFinished`.

It holds **facts only**. Rule values like "clean sheet needs 30 minutes" or "a goal is worth 6" stay in your rules table, so a rule change never needs a stats change. `getPlayerMatchStats()` in `lib/live/stats.ts` returns `[]` until phase 2 lands. Build against made-up rows until then. The shape won't change.

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

## Rules the database enforces

These rules hold whatever the app does. They're tested in 100+ scenarios:

- Only the console holder (or the admin) writes to a fixture, and only while they still have the official role.
- Events are append-only: no edits, no deletes from the app. Undo is a void.
- The same `clientEventId` is never recorded twice.
- Event times are never in the future and never before the previous event.
- Periods run in order. Extra time and penalties happen only in knockouts, only when level. A knockout can't finish level.
- Players must belong to the team, and (with lineups) be on the pitch or the bench as the event needs. A sent-off player does nothing more.
- Officials undo only their own latest event, within 30 s. The admin's corrections need a reason.

---

## Roadmap

### Phase 1: timed match core and console API (this PR, 19–20 Nov)

Football works end to end on the database side: `match_events` and `lineups`, the one-holder lock (take and hand over), recording every football event with offline-safe retries, undo and admin corrections, walkovers, the derived score/status/clock/winner, the timeline with match minutes, Realtime, and the TypeScript API above. Also the agreed phase 2 shapes, so Mary and Fortune aren't blocked.

### Phase 2: derived football data (20–21 Nov)

- `player_match_stats`: minutes from events (subs, red cards, extra time), goals conceded while on the pitch, every stat in the contract. Tested against Akeem's worked examples together with Mary.
- Football standings in rulebook order: 3/1/0, then goal difference, goals scored, head-to-head. Updates live during matches.
- Knockout fill: "1st v 2nd" and "3rd v 4th" fixtures get their teams from the final table (with Henry).
- Top scorers, top assisters, clean sheets, cards and suspensions (a red card flags a 1-match ban).
- Corrections: recalculating stats after a void, and audit log entries (with Henry).

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
