# Admin backend smoke test

A checklist to run once on a preview deployment, once the admin migrations (#15, #16 and #17) are applied (they are, as of 22 Nov). Each step gives the action, the input, and what you should see in the database or the audit feed. Contracts: [`admin-backend.md`](admin-backend.md). CSV formats: [`admin-csv-formats.md`](admin-csv-formats.md).

> **This runs against the real database.** There's one Supabase project, so a preview deployment writes to the same data as production.
> - Every step uses throwaway rows or restores what it changes, and **Cleanup** at the end lists what to undo.
> - Don't run step 9 (finalise) unless Tayo is there to reset the matchday.

## Before you start

- [ ] **Migrations:** #15, #16 and #17 are applied, and Tayo has confirmed their verify blocks. Step 4.2 also needs #31 (`admin_deadline_rules()`); without it, the warning comes back as `check_failed`.
- [ ] **Deployment:** a preview deployment of `main` (or of this branch until it merges). Points recalculation only works on a deployment, not on a laptop.
- [ ] **Admin account:** you're signed in as the admin. Call your profile id `ADMIN`.
- [ ] **Second account:** a second Google account has signed in once (call it `B`). It becomes an official in step 6.
- [ ] **How to run each step:** from its admin page. If a page isn't built yet, mark the step "not run" rather than skipping it silently.
- [ ] **How to check results:** in the Supabase **Table Editor** (browsing only, no SQL) and in the audit page (`getAuditLog`).
- [ ] **Record the start time.** You'll filter the audit feed from it in step 10.

All times below are WAT.

---

## 1. Players CSV: preview and commit

1. Make `players-smoke.csv` from [`samples/players.csv`](samples/players.csv):
   - change **Kolade**'s `price` from `6.0` to `7.5`;
   - add a row at the end: `Smoke Test Player,1,MID,,5.0,,`.
2. **Action:** `previewPlayersImport(<file text>)`

   **Expected:**
   - `fileErrors: []`, `canCommit: true`;
   - `counts`: `{ new: 1, update: 1, unchanged: 102, error: 0 }`;
   - Kolade's row: `status: "update"`, `changes: ["price ₦6.0m → ₦7.5m"]`;
   - the last row: `status: "new"`, `value.displayName: "Smoke Test Player"`, no warnings.

   If Kolade's row is `unchanged`, his price isn't 6.0 on the project; note the real value and carry on.
3. Make one id, `IMPORT_1 = crypto.randomUUID()`. **Action:** `commitPlayersImport({ importId: IMPORT_1, rows: commitRows(preview) })`

   **Expected:** `{ inserted: 1, updated: 1, unchanged: 102, alreadyApplied: false }`.
   - **Table Editor › players:** Kolade has `price_tenths = 75`; "Smoke Test Player" is in Year 1, MID, `price_tenths = 50`, `status = available`.
   - **Audit feed** (`getAuditLog({ table: "players" })`):
     - a `players` **update** (`price_tenths` 60 → 75) and a `players` **insert**;
     - `actorName` is your name on both;
     - `context.importId` is `IMPORT_1` on both.

## 2. The same import again: nothing changes

1. **Action:** `commitPlayersImport({ importId: IMPORT_1, rows: <the same rows> })`

   **Expected:**
   - `{ inserted: 1, updated: 1, unchanged: 102, alreadyApplied: true }`: the first run's counts;
   - no new `players` rows in the audit feed;
   - `updated_at` on Kolade unchanged.
2. **Action:** `previewPlayersImport(<players-smoke.csv again>)`

   **Expected:**
   - `counts: { new: 0, update: 0, unchanged: 104, error: 0 }` (the 103 originals, Kolade, and the new player now matching himself);
   - `canCommit: false`.

## 3. Prices CSV

1. Make `prices-smoke.csv` from [`samples/prices.csv`](samples/prices.csv) with **Kolade** at `8.0`.
2. **Action:** `previewPricesImport(<file text>)`

   **Expected:**
   - `counts: { new: 0, update: 1, unchanged: 102, error: 0 }`;
   - Kolade's row: `changes: ["price ₦7.5m → ₦8.0m"]`.
3. **Action:** `commitPricesImport({ importId: IMPORT_2, rows: commitRows(preview) })`

   **Expected:**
   - `{ inserted: 0, updated: 1, unchanged: 102, alreadyApplied: false }`;
   - Kolade has `price_tenths = 80`;
   - the audit feed shows the update with `context.importId = IMPORT_2`.
4. **A bad price.** **Action:** `setPlayerPrice({ playerId: <Kolade>, priceTenths: 105 })`

   **Expected:**
   - `ok: false`, `error.code: "admin.price_out_of_range"`, `error.message: "10.5 is above the maximum of 10.0."`;
   - nothing changes.

## 4. Edit a fixture's kickoff

Use the matchday 1 fixture **Y1 v Y4**. Note its current kickoff first (the seed placeholder is 28 Nov, 14:00).

1. **Action:** `rescheduleFixture({ fixtureId: <Y1 v Y4>, kickoffAt: "2026-11-28T15:30:00+01:00" })`

   **Expected:**
   - `ok: true`, and `data.fixture.kickoffAt` is `2026-11-28T14:30:00+00:00`;
   - **Table Editor › fixtures:** `kickoff_at` shows the same instant;
   - **Audit feed:** a `fixtures` update with only `kickoff_at` changed, old and new, by you;
   - `data.deadlineWarning` is null, because the first kickoff moved later.
2. **Deadline drift.** **Action:** `rescheduleFixture({ fixtureId: <Y1 v Y4>, kickoffAt: "2026-11-28T13:45:00+01:00" })` (the deadline is 13:30)

   **Expected:**
   - `ok: true`, and `data.deadlineWarning.kind` is `"drift"`, with `minutesBetween: 15` and `requiredMinutes: 30`;
   - the message ends "move it to Sat 28 Nov, 13:15 or earlier";
   - the matchday's deadline itself is unchanged.

   Then move the kickoff back to 15:30 with `rescheduleFixture` and check `deadlineWarning` is null again.
3. **Action:** `cancelFixture(<Y1 v Y4>)`, then `restoreFixture(<Y1 v Y4>)`

   **Expected:**
   - status goes `cancelled`, then back to `scheduled`;
   - two audit rows, each with only `status` changed.

## 5. setMatchdayDeadline

Matchday 1's first kickoff is now Y1 v Y4 at 15:30 (Y2 v Y3 is at 16:00).

1. **Action:** `setMatchdayDeadline({ matchdayId: <MD1>, deadlineAt: "2026-11-28T16:00:00+01:00" })`

   **Expected:**
   - `ok: false`, `admin.invalid_input`, "The deadline can't be after the matchday's first kickoff.";
   - nothing changes.
2. **Action:** `setMatchdayDeadline({ matchdayId: <MD1>, deadlineAt: "2026-11-28T15:00:00+01:00" })`

   **Expected:**
   - `{ number: 1, deadlineAt: "2026-11-28T14:00:00+00:00" }`;
   - `getPriceSettings().lockAt` is the same instant, with `locked: false`;
   - an audit `matchdays` update showing `deadline_at` old and new.

   ⚠️ Never set matchday 1's deadline in the past: that locks every price.

## 6. Promote an official and assign a holder

1. **Action:** `listProfiles({ search: "<part of B's name or email>" })`

   **Expected:** B's profile, with `role: "user"`.
2. **Action:** `setRole({ profileId: B, role: "official" })`

   **Expected:**
   - `{ role: "official", releasedFixtures: [] }`;
   - **Table Editor › profiles:** B's `role = official`;
   - **audit:** a `profiles` update, `role` user → official, by you, `context.action = "set_role"`;
   - `getDashboard().counts.officials` has gone up by 1.
3. **Action:** `setConsoleHolder({ fixtureId: <Y2 v Y3, matchday 1>, profileId: B })`

   **Expected:**
   - the returned fixture has `holderName` set to B's name;
   - **audit:** a `fixtures` update with only `console_holder` changed (null → B).
4. **Demote, and see the hold released.** **Action:** `setRole({ profileId: B, role: "user" })`

   **Expected:**
   - `releasedFixtures` lists Y2 v Y3;
   - its `console_holder` is null again;
   - two audit rows: the role change, and `console_holder` B → null.
5. If B really will be an official, promote them again (`setRole` → `"official"`).
6. **Action:** `setRole({ profileId: ADMIN, role: "user" })`

   **Expected:** `admin.own_role`.

## 7. An announcement showing, then expiring

1. **Action:** `createAnnouncement({ message: "Smoke test banner, please ignore", tone: "info", startsAt: <now>, endsAt: <now + 3 minutes> })`

   **Expected:**
   - `ok: true`;
   - the audit feed shows an `announcements` insert, by you;
   - `listAnnouncements()` shows it with `state: "showing"`.
2. Open the home page in a signed-out window. `getActiveAnnouncement()`, wired by Fortune, returns the banner.

   **Expected:** the banner is visible within about a minute (it's cached for up to 60 seconds).
3. Wait until 3 minutes have passed, plus up to a minute for the cache.

   **Expected:**
   - the banner is gone from the signed-out home page;
   - `listAnnouncements()` shows `state: "ended"`.

## 8. A correction after full time

This uses a throwaway fixture with **no matchday**, so no fantasy points or standings are affected.

1. **Create the fixture.** **Action:** `createFixture({ eventId: <Football (men)>, stage: "smoke_test", homeTeamId: <Y1>, awayTeamId: <Y2>, kickoffAt: <now − 60 min> })`

   **Expected:** a new fixture, `status: "scheduled"`, `label: "Y1 v Y2"`.
2. **Record a short match as the admin**, through the console or Bolu's `recordMatchEvent`, each with a new `clientEventId`:
   - `period_start` `first_half` at now − 55 min;
   - `goal` for Y1, scorer **P1** (any Y1 player), at now − 50 min. Keep its `clientEventId`; call it `GOAL_1`;
   - `period_end`;
   - `period_start` `second_half`;
   - `full_time`.

   **Expected:** the fixture is `full_time`, 1–0.
3. **Correct the scorer.** **Action:**

   ```text
   correctMatchEvent({
     voidClientEventId: GOAL_1,
     reason: "Smoke test: wrong scorer on the sheet",
     replacement: {
       type: "goal", fixtureId, clientEventId: <new uuid>, teamId: <Y1>,
       scorerId: <P2, another Y1 player>, occurredAt: <same time as GOAL_1>
     }
   })
   ```

   **Expected:**
   - `ok: true`, `voided.voidedAt` is set, `recorded.playerId = P2`;
   - `recalculation: { status: "skipped", reason: "no_matchday" }`;
   - **Table Editor › fixtures:** the score is still 1–0;
   - **Table Editor › match_events:** `GOAL_1` has `voided_at`, `voided_by = ADMIN` and `void_reason` set, and a new goal row has `player_id = P2`;
   - **Audit feed** (`getAuditLog({ table: "match_events" })`):
     - a `match_void` entry, summary "Match event voided: Smoke test: wrong scorer on the sheet", by you;
     - a `match_record` entry for each event you recorded, including the new goal.
4. **The reason is required.** **Action:** `voidMatchEvent({ clientEventId: <the new goal>, reason: "" })`

   **Expected:**
   - `admin.invalid_input`, "Give a short reason (at least 5 characters)";
   - nothing changes.

## 9. Finalise and recalculate

1. **Recalculate.** It leaves the matchday's status alone. But it does write a provisional `manager_matchday_points` row for every manager, so before the tournament managers could see "Matchday 1: 0 pts (provisional)".
   - Run it during a test matchday;
   - or ask Mary or Tayo to clear MD1's rows afterwards (see Cleanup).

   **Action:** `recalculateMatchday({ matchdayId: <MD1> })`

   **Expected:**
   - `{ managersUpdated: <number of managers>, finalised: false }`;
   - **Table Editor › matchdays:** MD1's `status` is unchanged;
   - **manager_matchday_points** has rows for MD1 with `is_provisional = true`.

   If it returns `admin.unavailable` "Points can only be recalculated on the deployed site", you're on a laptop, not a deployment.
2. **Finalise.** ⚠️ Only with Tayo present: there's no un-finalise action, so Tayo resets it in SQL afterwards (`update matchdays set status = 'upcoming' where number = 1`).

   **Action:** `finaliseMatchday({ matchdayId: <MD1> })`

   **Expected:**
   - `{ managersUpdated: <n> }`;
   - MD1 `status = finalised`;
   - its points rows have `is_provisional = false`.

   Then Tayo resets the status.

## 10. Every change in the audit feed, with your name

**Action:** `getAuditLog({ from: <start time>, actorId: ADMIN, limit: 99 })`, following `nextCursor` until it's null.

Expected, at least the following, every one with `actorName` = your name:

| Step | Table | Action | Shows |
| --- | --- | --- | --- |
| 1 | players | update | Kolade `price_tenths` 60 → 75, `importId` IMPORT_1 |
| 1 | players | insert | Smoke Test Player, `importId` IMPORT_1 |
| 3 | players | update | Kolade 75 → 80, `importId` IMPORT_2 |
| 4 | fixtures | update ×5 | `kickoff_at` three times; then `status` → cancelled; then → scheduled |
| 5 | matchdays | update | `deadline_at` |
| 6 | profiles | update ×2 (or ×3) | `role` user → official, then → user, `context.action` set_role |
| 6 | fixtures | update ×2 | `console_holder` null → B, then B → null |
| 7 | announcements | insert | the banner |
| 8 | fixtures | insert | the smoke_test fixture |
| 8 | match_events | match_record ×6, match_void ×1 | the events, and the void with its reason |

None should be missing, and none should have an empty `actorName`. Two things must **not** appear:
- fixture rows with `home_score` or `current_period` (the live refresh isn't audited);
- anything from step 2's repeated commit.

---

## Cleanup

Do these through the actions, so they're audited too:

- [ ] **Kolade's price:** `setPlayerPrice({ playerId: <Kolade>, priceTenths: 60 })`, or whatever it was before step 1.
- [ ] **Smoke Test Player:** `setPlayerStatus({ ..., status: "left" })`. Ask Tayo to delete the row if no manager has picked him.
- [ ] **Y1 v Y4 kickoff:** `rescheduleFixture` back to its original time (28 Nov, 14:00).
- [ ] **MD1 deadline:** `setMatchdayDeadline` back to 30 minutes before the first kickoff (28 Nov, 13:30).
- [ ] **Smoke test fixture:**
  - void its remaining events with `voidMatchEvent` (reason "Smoke test cleanup");
  - then `cancelFixture`.
  
  It stays in the table as cancelled; match events can't be deleted from the app.
- [ ] **Officials:** B stays an official only if they really are one.
- [ ] **Matchday 1** (if you ran step 9):
  - Mary or Tayo has cleared MD1's `manager_matchday_points` rows, unless this was a test matchday whose points should stay;
  - if you ran 9.2, Tayo has reset its status to `upcoming`.

Write down any step that didn't match, with the actual result, and post it in the dev group.
