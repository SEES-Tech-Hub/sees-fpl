# SEES Games 2026 Hub — Product Requirements

Nov 18, 2026 · Eyitayo Obembe · Status: Draft v0.1

> Exported from the live doc: https://claude.ai/artifact/5vxb7y7RGNfRDWwYuVbFuR. The two diagrams (data flow, release timeline) are only in the live doc. If this file and the doc disagree, the doc is correct.

## Summary

We are building one web app for SEES Games 2026, the inter-year sports festival of the Society of Electrical and Computer Engineering Students (UNILAG). The first matches are on 28 Nov 2026 and the last on 9 Dec 2026. It has three parts:

1. **Live scores and results** for every event: fixtures, live updates, results, tables and standings. Anyone can view them without signing in.
2. **SEES Fantasy (FPL)** for the football tournament. Students pick 15 real players from the five year teams and earn points from how those players perform.
3. **Admin portal**: organisers manage sports, teams, players, fixtures and kickoff times. Match officials enter scores and events live from their phones.

Why: most students can't be at every match. Live scores bring the whole department along, and fantasy gives everyone a reason to follow matches their own year isn't in. The model is CampusXI (campusxi.com), which sells fantasy and live scores for campus tournaments as a paid mobile app. Ours is free, web-based and SEES-branded.

The working name is **SEES Games Hub** (repo: `sees-fpl`).

## Goals, non-goals and success metrics

**Goals**

- Every SEES Games event has its fixtures, live status and final results published in the app on the day it happens.
- Football scores and events reach viewers within 10 seconds of an official entering them.
- Fantasy sign-up and squad selection open on 24 Nov, before the matchday 1 deadline (first kickoff on 28 Nov).
- Organisers run the whole event from the admin portal, with no developer needed on matchdays.

**Non-goals for this release**

- Native iOS or Android apps. The web app works on phones and can be installed to the home screen.
- Fantasy games for sports other than football.
- Payments, paid tiers, betting or prizes handled inside the app.
- Video, live commentary text or player ratings.
- Detailed stats such as possession, shots or saves. We record only what one official can track by eye.

**Success metrics**

| Metric | Target |
| --- | --- |
| Fantasy managers registered before the matchday 1 deadline | 300 |
| Unique viewers of live scores across the event | 1,000 |
| Events with results published on the same day | 100% |
| Score entry to viewer delay (football) | under 10 s |
| Matchday points finalised after the last match | within 2 h |

The targets are first guesses for the team to agree on. SEES membership numbers will set the real ones.

## Users and roles

There are three account roles, plus anyone viewing without signing in. The database checks the role on every write.

| Role | Who | How they get it | Can do |
| --- | --- | --- | --- |
| Viewer (no account) | Anyone | Nothing needed | View fixtures, live scores, results, tables, stats, fantasy rankings |
| User | Anyone who signs in with Google | Signs in | Play fantasy (one team, mini-leagues), turn on push alerts |
| Official | Sideline volunteers. Who they are doesn't matter, only the account | The admin promotes a signed-in account | Everything a user can, plus run the match console for fixtures they hold |
| Admin | The Games tech lead: one active account, plus one backup account kept unused in case it's needed | Set in the database | Everything: sports, teams, players, prices, fixtures and kickoff times, officials, console holders, corrections, finalising matchdays, announcements, audit log |

**One account updates each match.** Each fixture has a single *console holder*, which is one official account.

- The admin assigns the holder before kickoff. If no one holds a fixture, an official can tap "Take this match".
- The database accepts match events only from the holder (and from the admin as a fallback). Everyone else sees the console read-only.
- To swap phones (for example, a battery dies), the holder taps "Hand over", or the admin reassigns it. The new holder carries on from the same event log.
- This also stops two people recording the same goal twice.

The main journeys:

- **A student checks the score from a lecture:** opens the link, sees the LIVE card, taps it, and sees the score and timeline.
- **A manager picks a team:** signs in with Google, names the team, picks 15 players within budget, sets the captain, and saves before the deadline.
- **An official runs a match:** opens the console on a phone, taps Kick off, records a goal with scorer and assister, taps Full time, and the result appears for everyone.
- **An admin closes a matchday:** checks each match's events, taps Finalise, points and rankings update, and the next deadline opens.

## Tournament facts

The five year groups compete in 12 events. The rulebooks are in the SEES GAMES 2026 Drive folder.

| Year | Class | Football squad |
| --- | --- | --- |
| Year 1 | SEES 31 | 12 players |
| Year 2 | SEES 30 | 22 players, coaches Dips and Feolami |
| Year 3 | SEES 29 | 22 players, head coach Justin |
| Year 4 | SEES 28 | 24 players, head coach Busayo |
| Year 5 | SEES 26 | 23 players, coaches Moyo and Alfred |

There is no SEES 27 because of a gap year. The full squads are in `docs/football-team-listing.md`.

**Events:** athletics, badminton, basketball, board games, football, handball, lawn tennis, mobile games, Mortal Kombat, swimming, table tennis, volleyball.

**Football rules (from FOOTBALL.pdf)**

- Every team plays every other team once (10 matches), followed by a third-place match and a final (12 matches in total). Venue: UNILAG Sports Centre.
- Points: win 3, draw 1, loss 0. Ties are split by goal difference, then goals scored, then the head-to-head result. 1st and 2nd go to the final, 3rd and 4th to the third-place match, and 5th is out.
- Matches are 50 min (2 × 25). A knockout draw goes to 14 min of extra time (2 × 7), then penalties.
- Squads: up to 23 players and 2 coaches. A red card means a 1-match ban. A team not ready 15 min after kickoff loses 3–0.

**Football fixtures**

| Matchday | Date | Matches | Sits out |
| --- | --- | --- | --- |
| 1 | Sat 28 Nov | Y1 v Y4, Y2 v Y3 | Y5 |
| 2 | Mon 30 Nov | Y5 v Y3, Y1 v Y2 | Y4 |
| 3 | Wed 2 Dec | Y2 v Y4, Y5 v Y1 | Y3 |
| 4 | Fri 4 Dec | Y3 v Y1, Y4 v Y5 | Y2 |
| 5 | Sun 6 Dec | Y2 v Y5, Y3 v Y4 | Y1 |
| 6 | Wed 9 Dec | Third place (3rd v 4th), Final (1st v 2nd) | 5th |

Kickoff times are not yet set. Admins enter them in the portal. The rulebook says the league has "6 matches", but it is 10. This needs correcting with the organisers.

## Feature: Live scores and results (all sports)

Every event uses one of four **result formats**. This lets us build four screens instead of twelve. An admin picks the format when setting up each sport. The formats below are drafts until checked against the other 11 rulebooks.

| Format | Events | What is recorded | What viewers see |
| --- | --- | --- | --- |
| Timed match | Football, handball, basketball | Score, clock and periods, events (goal or points, card, sub) linked to players | Live score and minute, event timeline, lineups, league table |
| Sets match | Volleyball, badminton, table tennis, lawn tennis | Score per set or game, set winner, match winner | Live set scores, match result, table or bracket |
| Head-to-head | Board games, mobile games, Mortal Kombat | Who played (player or year), winner, optional score, round | Result list and bracket per game |
| Ranked result | Athletics, swimming | Per race or event: entrants in finishing order with time or distance, heats and finals | Finishing order, medal positions, winners list |

One sport can hold several **events**, for example athletics 100 m men, 4×100 m relay, swimming 50 m freestyle, and chess or ludo under board games. Each event belongs to one format.

**Requirements**

1. **Home:** "Live now" cards at the top, then today's fixtures by sport, then the latest results. Each card shows the teams or entrants, the score or status (scheduled, live with minute, HT, FT, postponed, walkover) and the venue.
2. **Sport page:** fixtures and results by date, plus the sport's table or bracket.
3. **Match page (timed match):** the score header, a live clock that runs off the kickoff time, a timeline (goal with assister, yellow or red card, sub, HT and FT), both lineups, and head-to-head records. Football also shows extra time and the penalty shootout.
4. **Event page (ranked result):** the finishing order with times or marks and gold, silver and bronze marked. Heats link to their finals.
5. **Standings:** the football table follows the rulebook (3/1/0, then goal difference, goals scored, head-to-head) and updates live while matches are on. Other sports show a table or bracket depending on their format.
6. **Overall championship:** a medal table, or overall points table, of the five years across all events. The scoring rule is an open question.
7. **Football stats:** top scorers, top assisters, clean sheets, and cards and suspensions (a red card flags a 1-match ban).
8. **Real-time updates:** score and status changes reach open pages without a refresh, within 10 s.
9. **Share:** every match and event has its own link and a preview card for WhatsApp.

## Feature: SEES Fantasy (football)

Managers pick 15 real players from the five year squads and score points from how those players do in the 6 matchdays. The rules follow official FPL, scaled down for a short tournament with five teams.

**Squad and lineup**

- 15 players: 2 GK, 5 DEF, 5 MID, 3 FWD. Budget ₦100m. An admin sets each player's price once (₦4m to ₦10m), and prices do not change.
- At most **4 players from one year**. A limit of 3 would force exactly 3 from every year, leaving no choice.
- Each matchday, 11 start in a valid formation (1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD). The other 4 sit on the bench in an order the manager sets.
- Captain scores double. The vice-captain takes over if the captain doesn't play.
- Automatic substitutes: a starter who doesn't play is replaced by the first bench player who did, as long as the formation stays valid.

**Deadlines and transfers**

- The deadline is 30 min before the first kickoff of each matchday. After it, squads lock and everyone's picks become visible.
- Before matchday 1: unlimited changes. After that: 1 free transfer per matchday, up to 2 saved, and −4 points for each extra one.
- One **Wildcard** per manager: unlimited free transfers for one matchday.
- Free unlimited transfers before matchday 6 (the final and third-place match), because only 4 teams play.
- A player banned or marked unavailable by an admin shows a flag in the squad builder.

**Scoring**

| Event | GK | DEF | MID | FWD |
| --- | --- | --- | --- | --- |
| Appeared (any minutes) | 1 | 1 | 1 | 1 |
| Played 30 min or more | +1 | +1 | +1 | +1 |
| Goal | 6 | 6 | 5 | 4 |
| Assist | 3 | 3 | 3 | 3 |
| Clean sheet (30 min or more on the pitch) | 4 | 4 | 1 | 0 |
| Every 2 goals conceded | −1 | −1 | 0 | 0 |
| Penalty saved (in normal or extra time) | 5 | 5 | 5 | 5 |
| Penalty missed | −2 | −2 | −2 | −2 |
| Yellow card | −1 | −1 | −1 | −1 |
| Red card | −3 | −3 | −3 | −3 |
| Own goal | −2 | −2 | −2 | −2 |
| Man of the Match (chosen by the official) | 3 | 3 | 3 | 3 |

- Minutes are worked out from kickoff, sub and full-time events, so officials never type minutes.
- Extra time counts. Penalty shootouts do not.
- A walkover (3–0) gives no player points.
- Players whose team doesn't play that matchday score 0, and automatic subs apply.

**Leagues and pages**

- **Rankings:** overall, one per year (based on the year the manager says they're in), and private mini-leagues joined with a 6-character code.
- **Pages:** squad builder (pitch view and list view, filters by year, position and price), my team, transfers, points per matchday with a breakdown per player, other managers' teams (after the deadline), player list with fantasy points and how many managers picked each player.
- **Live points:** during a match, managers' points and ranks update as events are entered and are marked provisional until the admin finalises the matchday.

## Fantasy build order

Fantasy is built in eight steps, and each one is finished and tested before the next starts. Scoring (F5) is plain calculation code with no screens attached. The team writes worked examples first, then the code must match them exactly.

| Step | What | Done when | Needed by |
| --- | --- | --- | --- |
| F1 | Rules and data: rules stored in a config table (squad shape, budget, per-year limit, every points value), players with positions and prices, matchdays with deadlines | The admin loads all players and prices from a CSV. No rule value is written into the code | 19 Nov |
| F2 | Squad builder: pick 15, with the server checking positions, the ₦100m budget and the per-year limit | The server rejects every invalid squad with a clear reason. There is a test for each rule | 20 Nov |
| F3 | Lineup: starting 11 in a valid formation, bench order, captain and vice-captain | Invalid formations are rejected. The captain and vice are different players, both in the squad | 20 Nov |
| F4 | Deadline lock: each manager's picks are saved as a snapshot per matchday | The server's clock rejects saves after the deadline. Later edits never change a snapshot | 20 Nov |
| F5 | Scoring engine: player stats, then player points, then manager points with automatic subs, captain or vice, and transfer penalties | Matches every one of Akeem's worked examples. Running it again gives the same result | 21 Nov |
| F6 | Finalise and rankings: provisional points during play, final when the admin finalises. Overall and per-year rankings | Correcting one event recalculates every manager it affects | 21 Nov |
| F7 | Transfers: 1 free per matchday, save up to 2, −4 for each extra, unlimited before matchdays 1 and 6 | Penalties land on the right matchday. Saved transfers are correct across 3 matchdays | 21 Nov |
| F8 | Wildcard and mini-leagues | Wildcard usable once. Join by code | 21 Nov |

**Edge cases the engine must handle** (each one becomes a test):

- The captain doesn't play, so the vice scores double. Neither plays, so no one scores double.
- Automatic subs go in bench order, a goalkeeper only replaces a goalkeeper, and the formation must stay valid (at least 3 DEF, 2 MID, 1 FWD).
- A player whose team has no match that matchday scores 0 and can be replaced by an automatic sub.
- Minutes come from events: a player subbed on then off, or sent off, stops counting at that moment. Extra time counts towards the 30 minutes.
- A clean sheet and goals conceded count only while the player is on the pitch.
- A walkover gives no points, and that fixture's players count as not having played.
- Penalty-shootout goals and saves are ignored.
- An event corrected after finalising recalculates points, and the change in rankings is logged.
- A player removed from a squad stays in managers' teams, scores 0, and everyone gets a free transfer.
- Managers on equal points share a rank.

**Example:** Kolade (Year 5 FWD) is captain. He plays all 50 min, scores once and assists once: 2 + 4 + 3 = 9, doubled to 18.

## Feature: Admin portal and match console

The console is entered once and feeds everything else. One tap by an official updates live scores, standings, player stats and fantasy points together. Nothing is typed in twice.

*(Diagram in the live doc: match console and admin corrections feed `match_events`, which feeds the live score and timeline, standings and tables, player stats, and fantasy points and ranks.)*

Everything viewers see is calculated from `match_events`, so a correction made there fixes every screen at once.

**Admin portal (admin only)**

1. **Sports and events:** create a sport, pick its result format, add its events (for example 100 m men), and set the venue.
2. **Teams:** the five year teams (name, class, colours, coaches), shared by every sport.
3. **Players:** add or edit players, or import them from a CSV (name, year, position, shirt number, price). Mark a player as available, injured, suspended or left the squad. Players with the same name get a display name (for example "Samuel O.").
4. **Fixtures:** create a fixture (sport or event, the two teams or the entrants, stage or round, date, kickoff time, venue). Reschedule, postpone or record a walkover. Knockout fixtures such as "1st v 2nd" fill in automatically once the league ends.
5. **Officials:** promote a signed-in account to official or remove it, and set or change the console holder for each fixture.
6. **Fantasy:** set matchdays and their deadlines (worked out from the first kickoff, can be changed), set player prices (CSV import or one at a time, locked once the matchday 1 deadline passes), finalise a matchday, recalculate after a correction.
7. **Corrections:** edit any recorded event or result after full time. Every change is saved in the audit log and recalculates standings and points.
8. **Announcements:** a banner on the home page (for example "Matchday 2 kickoff moved to 4 pm").
9. **Audit log:** who changed what and when.

**Match console (officials, phone-first)**

- Big buttons for one-handed use. Every action can be undone for 10 s.
- **Timed match:** Kick off, Half time, Second half, Full time, then Extra time and Penalties for knockouts. Goal: pick the team, scorer, assister or none, and mark a penalty or own goal. Card: player and colour. Sub: player off and player on. Penalty missed or saved. At full time, pick the Man of the Match.
- **Sets match:** add a point or a game for each side, and close a set.
- **Head-to-head:** pick the winner and enter an optional score.
- **Ranked result:** enter the finishing order by dragging entrants or typing positions, plus time or mark, then publish.
- Lineups are confirmed before kickoff by ticking the starting players from the squad.
- If the connection drops, actions queue on the phone and send in order once it's back. The console shows "3 actions waiting to send".

The console opens only for the fixture's console holder (see Users and roles). Everyone else gets a read-only view.

## Data, stack and non-functional requirements

**Proposed stack** (to confirm with the dev team): Next.js (App Router, pages rendered on the server) on Vercel, and Supabase for Postgres, Google sign-in, Realtime and row-level security. It is the same stack as sees-tech-hub, so the team can reuse its sign-in setup, branding and conventions. It should be a separate Supabase project.

**Core data**

| Group | Tables |
| --- | --- |
| Event setup | `sports` (with result format), `events`, `teams` (the five years), `players`, `venues` |
| Fixtures and results | `fixtures` (status, kickoff, stage), `fixture_entrants`, `lineups`, `match_events` (append-only: goal, card, sub, period change), `set_scores`, `rankings` (finishing order) |
| Derived (calculated, never typed in) | `standings` view, `player_match_stats` (minutes, goals, assists and so on, built from `match_events`), `medal_table` view |
| Fantasy | `matchdays` (deadline, status), `managers`, `squads`, `picks` (per matchday: starting or bench, captain, vice-captain), `transfers`, `chips`, `manager_matchday_points`, `leagues`, `league_members` |
| People and audit | `profiles`, `roles`, `official_assignments`, `audit_log` |

Rule: `match_events` is the single record of what happened. Every score, table and point total is calculated from it, so a correction there fixes everything that depends on it.

**Non-functional requirements**

- **Phones first:** usable at 360 px width. Home page is under 200 KB and loads in under 3 s on 3G.
- **Load:** handles 1,000 viewers at once during the final, and realtime stays under 10 s behind.
- **Security:** every write is checked on the server against the user's role (Postgres row-level security as well as server checks). Officials can write only to fixtures assigned to them. Other managers' picks stay hidden until the deadline.
- **Correctness:** the deadline is enforced on the server. Points calculation gives the same result if run again, and is tested against hand-worked examples.
- **Time:** all times shown in WAT (Africa/Lagos).
- **Brand:** SEES brand colours and fonts, defined as design tokens. Light and dark mode.
- **Reliability:** someone on the dev team is on call on every matchday. A spreadsheet export of all results can be made at any time.
- **Accessibility:** WCAG AA contrast, works with a keyboard, and live score changes are announced to screen readers.
- **Cost:** stays on free tiers (Vercel Hobby, Supabase Free) unless traffic needs more.

**PWA and push notifications**

- Installable PWA: web manifest, service worker, an offline app shell, and SEES icons. An in-app prompt explains how to install.
- Web Push with VAPID keys. Subscriptions are stored in Supabase, and notifications are sent from a server function.
- Alerts, each switchable in settings: deadline reminders 24 h and 2 h before; kickoff, goals and full time for teams a user follows; matchday points finalised.
- On iPhone, push works only once the app has been added to the home screen (iOS 16.4 or later), so the install prompt says this.

**Hosting:** games.seesunilag.com (to be confirmed). The project lead owns the Vercel and Supabase accounts and gives the developers access.

## Team and ownership

Seven developers, each owning one area from start to finish, so nobody waits on anyone else after day 1. Everyone is full-stack unless noted.

| Person | Owns | Done by |
| --- | --- | --- |
| Tayo (lead) | Repo, Supabase and Vercel setup, base schema, Google sign-in, roles and row-level security, CI and deploys, domain. **Admin portal pages (all admin UI).** Runs the daily standup, unblocks the team, signs off each test matchday | Setup and sign-in: 19 Nov. Admin pages: 21 Nov |
| Henry (backend) | Admin backend: server actions and SQL behind the admin portal (sports and events, teams, players and prices, CSV import parsing and validation, fixtures and kickoff times, officials and console holders, corrections, announcements, audit log, price lock). Backup owner for infra and the runbook | 21 Nov |
| Mary (backend) | Fantasy backend, F1 to F8 on the server: rules config, squad and lineup checks, deadline lock and snapshots, scoring engine, finalising, rankings, transfers, Wildcard, mini-leagues | 21 Nov |
| Akeem | Fantasy frontend: squad builder (pitch and list views), my team, transfers, points breakdown, rankings, leagues. Writes the worked scoring examples that Mary's engine is tested against | 21 Nov |
| Bolu | Live scores backend: `match_events`, the console API and one-holder lock, clock and periods, `player_match_stats`, standings, medal table, Realtime channels, all four result formats | 21 Nov |
| Fortune (frontend) | Live scores frontend: home, match and event pages, tables and brackets, stats pages. Owns the design tokens and shared UI kit from day 1 | 21 Nov |
| Samuel | Match console app (phone-first, offline queue, undo), PWA install, push notifications, WhatsApp share cards | 21 Nov |

**Changes to the allocation you gave**

- **Tayo owns infra, sign-in and the admin portal pages.** Henry owns the admin backend behind them and backs up infra. When two people own the same thing, nobody really owns it. (Updated 18 Nov: Akeem and Henry swapped roles, and the admin UI moved to Tayo, because Henry is a backend developer.)
- **Akeem is on the fantasy frontend**, since Mary is the backend developer. Akeem also writes the worked scoring examples, so the engine is checked by someone who didn't write it.
- **The match console had no owner.** It's the one place data is written, so Bolu builds its backend and Samuel its phone app.
- **No one owned the design.** Fortune sets the design tokens and shared components on 19 Nov, and Akeem, Tayo and Samuel build on them.
- **Samuel's "the rest"** is now named: console app, PWA, push and share cards.

**Hand-offs agreed on the morning of 19 Nov**

- **Tayo → all:** the base schema (profiles, roles, teams, players, fixtures) is merged by the end of 19 Nov.
- **Bolu → Mary:** `player_match_stats` has one row per player per fixture: minutes, goals, assists, goals conceded while on the pitch, cards, penalties, own goals, Man of the Match. Mary's engine reads only this and never reads `match_events`. The row shape is agreed on day 1, and Mary works from made-up rows until Bolu's are ready.
- **Bolu → Fortune and Samuel:** the console API and the Realtime message format.
- **Henry → all:** the CSV formats for players, prices and fixtures.

## Release plan

Everything is built in three days and launches on 24 Nov, four days before the first kickoff. Seven owners build in parallel from 19 to 21 Nov. Then come two test matchdays (22 and 23 Nov), and launch is 24 Nov.

*(Timeline in the live doc: PRD sign-off 18 Nov; build 19–21 Nov; test matchday 1 on 22 Nov; test matchday 2 and code freeze on 23 Nov; launch 24 Nov; matchday 1 on 28 Nov; league matchdays 30 Nov–6 Dec; third place and final 9 Dec.)*

Nothing is left to build once the tournament starts. Matchdays are for running the event, not shipping features.

**Platform and live scores (19–21 Nov)**

- [ ] Google sign-in, roles (user, official, admin), SEES branding, installable PWA, deployed
- [ ] Admin: teams, player and price CSV import, fixtures and kickoff times for all sports, promoting officials, console holders
- [ ] Console for all four formats, with the one-holder lock (timed match, sets, head-to-head, ranked)
- [ ] Public: home, match and event pages, football table, top scorers and assists, sport pages with tables and brackets, overall championship table, WhatsApp share cards

**Fantasy and push (19–21 Nov)**

- [ ] Fantasy F1 to F8, on the dates in the build order
- [ ] Push notifications: deadline reminders, goal and full-time alerts, points finalised

**Test, freeze and launch (22–24 Nov)**

- [ ] 22 Nov: test matchday 1 with made-up data, covering the console, live pages, scoring, rankings and push, all on phones. Everyone fixes their own bugs the same day
- [ ] 23 Nov: test matchday 2 with the real squads and prices, run by the actual officials. Freeze the code that evening
- [ ] 24 Nov: go live on games.seesunilag.com and open fantasy sign-ups

**If a step slips, cut in this order:** Wildcard, mini-leagues, goal alerts. F1 to F7 are never cut.

## Risks and open questions

**Risks**

| Risk | Effect | Fallback |
| --- | --- | --- |
| No official, or a flat phone, at a match | No live updates, so fantasy points are missing | A standby official takes over through "Hand over". An admin can enter all events after full time from the referee's sheet |
| Poor data signal at the Sports Centre | Delayed or lost updates | The console queues actions offline. An official can hotspot from a second phone |
| Squads change after fantasy opens | Managers own players who aren't in the squad | Lock squads on 25 Nov. Late additions get the lowest price, and a free transfer for everyone that matchday |
| Fantasy not ready by 24 Nov | Fewer managers sign up | Live scores ship regardless. The squad builder alone can still go out by 27 Nov |
| Scoring disputes | Managers lose trust | Scoring rules published in the app, a per-player points breakdown, and an admin correction log |

**Open questions**

- [ ] Dev team confirms the proposed stack (Next.js, Supabase, Vercel)
- [ ] Dates, venues and kickoff times for all 12 events (football times included)
- [ ] Result format for each event, confirmed against the other 11 rulebooks
- [ ] How the overall champion is decided: medal count or points per placing
- [ ] Any prizes or sponsors for fantasy
- [ ] Roster fixes: Year 1 has 12 players; Year 4 has 24; Years 1, 3 and 5 have one goalkeeper each; duplicate names (Alvin, Atom, two Samuels); no coaches listed for Year 1
- [ ] Rulebook fixes: "6 matches" should read 10; the football substitution rule is blank
- [ ] Confirm the domain games.seesunilag.com

**Decided on 18 Nov**

- Roles: user, official, admin. One admin account is active.
- One console holder per fixture, enforced by the database. Who the official is doesn't matter.
- The admin sets player prices.
- Anyone signed in with Google can play fantasy.
- The app is a PWA with push notifications.
- The project lead owns the Vercel and Supabase accounts.
- Fantasy is the main build risk, so F1 to F7 are agreed and fixed before development starts.
