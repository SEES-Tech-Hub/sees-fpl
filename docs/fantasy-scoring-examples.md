# SEES Fantasy: worked scoring examples

Draft · 20 Nov 2026 · Henry (fantasy frontend and worked examples)

These are the hand-worked examples the scoring engine (F5, Mary, `lib/fantasy/`) is tested against. Every number below comes from the scoring table in `docs/PRD.md`, "Feature: SEES Fantasy". The engine must match each one exactly.

Where the PRD is ambiguous, the example is written **both ways**, labelled **Version A** and **Version B**. Mary and Tayo pick one, and we delete the other version before the tests are written.

---

## Open questions (please decide)

These seven are the gaps raised on 19 Nov. Each one is linked to the examples that depend on it.

| # | Question | Version A | Version B | Examples |
| --- | --- | --- | --- | --- |
| Q1 | "Up to 2 saved" free transfers: is 2 the most a manager can **hold**, or the most they can **carry over** (on top of the new one)? | Hold at most 2 free transfers | Carry over up to 2, so hold up to 3 | E15d |
| Q2 | A player gets a second yellow and is sent off. What do they lose? | Yellow and red both count: −1 −3 = −4 | Only the red counts: −3 (official FPL) | E6c |
| Q3 | Does a captain's **negative** score also double? | Yes, everything doubles (official FPL) | No, only a positive total doubles | E11d |
| Q4 | Does an own goal count as a goal conceded (losing clean sheets, adding to "every 2 conceded") for the scorer's team? | Yes, it counts like any goal against (official FPL) | No, own goals are ignored for clean sheets and conceded | E7 |
| Q5 | The table gives "penalty saved" 5 points to **every** position. Should an outfield player (e.g. a MID who went in goal after a red card) really get 5? | Yes, any position, as the table says | Only goalkeepers can score it (outfield = 0) | E8d |
| Q6 | Automatic subs must keep "a valid formation". Does that include the **maximums** (5 DEF, 5 MID, 3 FWD) or only the minimums the edge-case list names (3 DEF, 2 MID, 1 FWD)? | Minimums only | Minimums and maximums | E12d |
| Q7 | How does the Wildcard combine with the unlimited free transfers before matchdays 1 and 6? And what happens to saved free transfers when it is played? | (i) Wildcard **cannot** be played for MD1 or MD6 (the server rejects it). (ii) Saved free transfers are **kept** | (i) It **can** be played, but it is used up for no benefit. (ii) Saved free transfers **reset to 1** | E16 |

### Further questions found while writing

| # | Question | Assumption used below |
| --- | --- | --- |
| Q8 | Is the bench goalkeeper in the manager's bench order like everyone else, or in a fixed GK slot (as in FPL)? | Fixed GK slot. A bench GK only ever replaces the starting GK, and outfield subs go in the order of the 3 outfield bench places |
| Q9 | Does a manager who used no transfers before the MD1 deadline start MD2 with 1 free transfer (not 2)? | Yes, MD2 starts with exactly 1 |
| Q10 | Does an own goal give the **other** team's players anything (a goal or an assist)? | No. An own goal gives no goal or assist points to anyone |
| Q11 | How are minutes counted: real clock time between events (including stoppage time), or capped at the scheduled period length (25 min a half, 7 min an ET half)? | Minutes are the match-clock minute of each event, so "came on at 20'" means 30 minutes in a 50-minute match. Stoppage time is not counted |
| Q12 | "Played 30 min or more": does exactly 30 count? | Yes, 30 counts ("or more") |
| Q13 | A player removed from a squad "scores 0, and everyone gets a free transfer". Is that free transfer added on top of the normal one and allowed above the saved limit? | Yes, +1 for that matchday only, even above the limit |

---

## How to read the examples

**Points table (from the PRD)**

| Event | GK | DEF | MID | FWD |
| --- | --- | --- | --- | --- |
| Appeared (any minutes, at least 1) | 1 | 1 | 1 | 1 |
| Played 30 min or more (on top of appeared) | +1 | +1 | +1 | +1 |
| Goal | 6 | 6 | 5 | 4 |
| Assist | 3 | 3 | 3 | 3 |
| Clean sheet (30+ min on the pitch, 0 conceded while on) | 4 | 4 | 1 | 0 |
| Every 2 goals conceded while on the pitch | −1 | −1 | 0 | 0 |
| Penalty saved (normal or extra time) | 5 | 5 | 5 | 5 |
| Penalty missed | −2 | −2 | −2 | −2 |
| Yellow card | −1 | −1 | −1 | −1 |
| Red card | −3 | −3 | −3 | −3 |
| Own goal | −2 | −2 | −2 | −2 |
| Man of the Match | 3 | 3 | 3 | 3 |

- A league match is 50 min (2 × 25). A knockout draw adds 14 min of extra time (2 × 7), then penalties.
- "Every 2 conceded" is `floor(conceded / 2)`: 1 conceded = 0, 2 or 3 = −1, 4 or 5 = −2.
- A player with 0 minutes "didn't play" and scores 0 for everything. They can be replaced by an automatic sub.
- Penalty-shootout goals, saves and misses are ignored.
- A walkover gives every player in that fixture 0, and they count as not having played.

**Inputs.** Each player example lists the `player_match_stats` row the engine reads. The field names are provisional until Bolu and Mary confirm the row shape:
`pos, min, goals, assists, conceded (while on pitch), yellow, red, own_goals, pen_saved, pen_missed, motm`. Any field left out is 0 or false.

---

## A. Player points

### E1. Forward: goal, assist, full match (the PRD's own example)

Kolade (Y5, FWD) plays all 50 min, scores once and assists once. Year 5 concede 1.

Input: `pos=FWD, min=50, goals=1, assists=1, conceded=1`

| Item | Points |
| --- | --- |
| Appeared | 1 |
| 30+ min | 1 |
| Goal (FWD) | 4 |
| Assist | 3 |
| Clean sheet (FWD) | 0 (FWD never gets one; their team conceded anyway) |
| **Total** | **9** |

As captain: 9 × 2 = **18**. This matches the PRD.

### E2. The same goal, by each position

Each player plays all 50 min, scores 1 goal, and their team concedes 0.

| Item | GK | DEF | MID | FWD |
| --- | --- | --- | --- | --- |
| Appeared | 1 | 1 | 1 | 1 |
| 30+ min | 1 | 1 | 1 | 1 |
| Goal | 6 | 6 | 5 | 4 |
| Clean sheet | 4 | 4 | 1 | 0 |
| **Total** | **12** | **12** | **8** | **6** |

### E3. Assists and clean sheet

**E3a.** DEF, 50 min, 2 assists, team concedes 0.
Input: `pos=DEF, min=50, assists=2, conceded=0`
1 + 1 + (2 × 3) + 4 = **12**

**E3b.** MID, 50 min, 1 assist, team concedes 0.
Input: `pos=MID, min=50, assists=1, conceded=0`
1 + 1 + 3 + 1 = **6**

**E3c.** FWD, 50 min, 1 assist, team concedes 0.
Input: `pos=FWD, min=50, assists=1, conceded=0`
1 + 1 + 3 + 0 = **5**

### E4. Minutes played

| Case | Input | Working | Total |
| --- | --- | --- | --- |
| E4a. MID comes on at 35', plays to full time | `MID, min=15` | 1 (appeared), under 30 so no bonus | **1** |
| E4b. MID comes on at 20', plays to full time | `MID, min=30` | 1 + 1 (exactly 30 counts, Q12) | **2** |
| E4c. MID starts, is subbed off at 29' | `MID, min=29` | 1 | **1** |
| E4d. MID on the bench, never comes on | `MID, min=0` | didn't play | **0** |
| E4e. MID comes on at 10', subbed off again at 30' | `MID, min=20` | 1 (minutes stop when they go off) | **1** |

### E5. Clean sheets and goals conceded (only while on the pitch)

| Case | Input | Working | Total |
| --- | --- | --- | --- |
| E5a. DEF subbed off at 35' with 0 conceded; team concedes at 45' | `DEF, min=35, conceded=0` | 1 + 1 + CS 4 | **6** |
| E5b. DEF comes on at 15' (35 min); team had conceded at 10', none after | `DEF, min=35, conceded=0` | 1 + 1 + CS 4 | **6** |
| E5c. DEF subbed off at 25', 0 conceded | `DEF, min=25, conceded=0` | 1, no CS (under 30 min) | **1** |
| E5d. GK, 50 min, concedes 1 | `GK, min=50, conceded=1` | 1 + 1, no CS, floor(1/2)=0 | **2** |
| E5e. DEF, 50 min, concedes 3 | `DEF, min=50, conceded=3` | 1 + 1 − 1 (floor(3/2)=1) | **1** |
| E5f. GK, 50 min, concedes 4 | `GK, min=50, conceded=4` | 1 + 1 − 2 (floor(4/2)=2) | **0** |
| E5g. GK, 50 min, concedes 5 | `GK, min=50, conceded=5` | 1 + 1 − 2 (floor(5/2)=2) | **0** |
| E5h. MID, 50 min, concedes 4 | `MID, min=50, conceded=4` | 1 + 1, MIDs lose nothing for conceding | **2** |
| E5i. FWD, 50 min, concedes 0 | `FWD, min=50, conceded=0` | 1 + 1 + CS 0 | **2** |

### E6. Cards

**E6a.** MID, 50 min, 1 yellow, team concedes 1.
Input: `MID, min=50, yellow=1, conceded=1`
1 + 1 − 1 = **1**

**E6b.** DEF starts, straight red at 20', team concedes 0 while they are on.
Input: `DEF, min=20, red=1, conceded=0`
1 (appeared, under 30 min) − 3, no CS because they played under 30 min = **−2**

**E6c. (Q2)** FWD starts, booked at 10', second yellow at 40' and sent off. Team concedes 1.
Minutes stop at 40', so min=40.

| | Version A (yellow + red) | Version B (red only) |
| --- | --- | --- |
| Input | `FWD, min=40, yellow=1, red=1` | `FWD, min=40, yellow=0, red=1` (or the engine ignores the yellow when red=1) |
| Appeared + 30 min | 1 + 1 | 1 + 1 |
| Cards | −1 −3 | −3 |
| **Total** | **−2** | **−1** |

Note for Bolu: whichever version is picked, `player_match_stats` must make it clear whether a red came from two yellows.

### E7. Own goal (Q4)

Y2 v Y3 ends 0–1. The only goal is an own goal by a Y2 DEF. They play 50 min. The Y2 GK also plays 50 min.

| | Version A (OG counts as conceded) | Version B (OG ignored for conceded) |
| --- | --- | --- |
| DEF input | `DEF, min=50, own_goals=1, conceded=1` | `DEF, min=50, own_goals=1, conceded=0` |
| DEF working | 1 + 1 − 2 (OG), no CS, floor(1/2)=0 | 1 + 1 − 2 (OG) + 4 (CS) |
| **DEF total** | **0** | **4** |
| GK input | `GK, min=50, conceded=1` | `GK, min=50, conceded=0` |
| GK working | 1 + 1, no CS | 1 + 1 + 4 (CS) |
| **GK total** | **2** | **6** |

No Y3 player gets a goal or an assist for it (Q10).

### E8. Penalties

**E8a.** GK, 50 min, saves a penalty at 30', concedes 2.
Input: `GK, min=50, pen_saved=1, conceded=2`
1 + 1 + 5 − 1 (floor(2/2)=1) = **6**

**E8b.** FWD, 50 min, has a penalty saved (counts as a miss), scores later. Team concedes 1.
Input: `FWD, min=50, goals=1, pen_missed=1`
1 + 1 − 2 + 4 = **4**

**E8c.** Shootout ignored. A knockout match ends 1–1 after extra time (64 min) and goes to penalties.
- GK plays 64 min, concedes 1, saves 2 shootout penalties. Input: `GK, min=64, conceded=1, pen_saved=0`. Working: 1 + 1 = **2**.
- FWD plays 64 min, scores in the shootout and also misses one. Input: `FWD, min=64, goals=0, pen_missed=0`. Working: 1 + 1 = **2**.

**E8d. (Q5)** Y4's GK is sent off. A Y4 MID goes in goal for the last 20 min and saves a penalty. They play 50 min in total and Y4 concede 2.

| | Version A (any position scores it) | Version B (GK only) |
| --- | --- | --- |
| Input | `MID, min=50, pen_saved=1, conceded=2` | same |
| Working | 1 + 1 + 5; MIDs lose nothing for conceding | 1 + 1 |
| **Total** | **7** | **2** |

Their position for scoring stays MID either way.

### E9. Man of the Match

MID, 50 min, 1 assist, named Man of the Match, team concedes 1.
Input: `MID, min=50, assists=1, conceded=1, motm=true`
1 + 1 + 3 + 3 = **8**

### E10. Extra time counts

A knockout match is 2–2 after 50 min, then plays 14 min of extra time (64 min in total).

| Case | Input | Working | Total |
| --- | --- | --- | --- |
| E10a. FWD comes on at 40', scores in extra time | `FWD, min=24, goals=1` (10 + 14) | 1 (under 30) + 4 | **5** |
| E10b. FWD comes on at 30' | `FWD, min=34` (20 + 14) | 1 + 1 (extra time takes them past 30) | **2** |
| E10c. DEF plays all 64 min, team concedes 3 (2 in normal time, 1 in extra time) | `DEF, min=64, conceded=3` | 1 + 1 − 1 | **1** |
| E10d. GK plays all 64 min, saves a penalty in extra time, concedes 2 | `GK, min=64, pen_saved=1, conceded=2` | 1 + 1 + 5 − 1 | **6** |

---

## B. Manager points

A manager's matchday total = the sum of the final XI's points (after automatic subs) + the captain bonus − transfer penalties. Bench players who stay on the bench add nothing.

Bench notation: `GK slot | B1, B2, B3` (outfield order, see Q8).

### E11. Captain and vice-captain

**E11a.** Captain plays. Captain FWD scores 9 (E1), vice MID scores 8. Captain counts 9 × 2 = 18; vice counts 8 (single). The captain's bonus is **+9**.

**E11b.** Captain doesn't play. Captain FWD has 0 min (unused sub). Vice MID scores 8, so the vice counts 8 × 2 = 16, a bonus of **+8**. An automatic sub replaces the captain in the XI as normal (E12), but the sub does **not** get the armband.

**E11c.** Neither plays. Captain and vice both have 0 min. No one scores double, so the bonus is **0**. Both are replaced by automatic subs where possible.

**E11d. (Q3)** Negative captain. Captain DEF gets a straight red at 20' (E6b): −2.

| | Version A (negatives double) | Version B (only positives double) |
| --- | --- | --- |
| Captain counts | −2 × 2 = −4 | −2 |
| Captain bonus | **−2** | **0** |

**E11e.** Captain plays 1 min. Captain FWD comes on at 49': `min=1`, so 1 point, doubled to **2**. They played, so the vice does not take over.

### E12. Automatic substitutes

Rules: go through the bench in order; take the first bench player who played; skip anyone whose arrival would break the formation (at least 1 GK, 3 DEF, 2 MID, 1 FWD); a GK only replaces a GK.

**E12a. Basic.** XI is 4-4-2. One starting DEF has 0 min.
Bench: `GK2 (played) | B1 MID 3 pts, B2 DEF 2 pts, B3 FWD 1 pt`.
B1 MID comes in: 3 DEF, 5 MID, 2 FWD is valid. **+3 points** from B1. B2 and B3 stay on the bench.

**E12b. A bench player who didn't play is skipped.** XI is 4-4-2, one starting MID has 0 min.
Bench: `GK2 | B1 FWD 0 min, B2 DEF 2 pts, B3 MID 6 pts`.
B1 has 0 min, so skip them. B2 DEF comes in (5-3-2 is valid). **+2**. B3 does not come in, even though they scored more.

**E12c. Formation forces a skip.** XI is 3-5-2, one starting DEF has 0 min.
Bench: `GK2 | B1 MID 5 pts, B2 DEF 1 pt, B3 FWD 2 pts`.
B1 MID would leave 2 DEF, below the minimum of 3, so skip them. B2 DEF comes in (3-5-2). **+1**.

**E12d. (Q6)** Maximums. XI is 5-3-2, one starting MID has 0 min.
Bench: `GK2 | B1 DEF 2 pts, B2 MID 1 pt, B3 FWD 6 pts`.

| | Version A (minimums only) | Version B (maximums too) |
| --- | --- | --- |
| B1 DEF | Comes in: 6-2-2, both minimums met | Would make 6 DEF, above 5: skip |
| B2 MID | stays on bench | Comes in: 5-3-2 |
| Points added | **+2** | **+1** |

**E12e. Goalkeeper.** The starting GK has 0 min. Bench: `GK2 4 pts | B1 DEF 2 pts, ...`. GK2 comes in: **+4**. If GK2 also has 0 min, nobody replaces the GK (an outfield bench player never does) and the slot scores 0.

**E12f. Two starters missing.** XI is 4-4-2, one DEF and one FWD have 0 min.
Bench: `GK2 | B1 MID 3 pts, B2 FWD 2 pts, B3 DEF 1 pt`.
The engine handles missing starters in XI order (GK, DEF, MID, FWD) and walks the bench for each:
- DEF missing: B1 MID comes in (3-5-2 valid). +3.
- FWD missing: the XI is now 3-5-1 plus the gap. The next unused bench player is B2 FWD, making 3-5-2, which is valid. +2.
Total added **+5**. (B3 DEF would also have been valid, making 4-5-1, but B2 comes first in bench order.)
Assumption: missing starters are filled in XI order. With these rules the order doesn't change the result here, but the engine should be deterministic.

### E13. Team doesn't play that matchday

Matchday 1: Y1 v Y4 and Y2 v Y3. Year 5 sit out.
A manager starts a Y5 FWD. They score **0** and count as not having played, so they are replaced by the first valid bench player who did play, exactly as in E12. If they were captain, the vice takes over (E11b).

### E14. Walkover

Matchday 3: Y5 fail to turn up for Y5 v Y1. Y1 are awarded the match 3–0 (walkover).
- Every player in Y5 and in **Y1** scores **0**: no appearance, no clean sheet for the Y1 GK and DEFs, no goals, no Man of the Match.
- They all count as not having played, so automatic subs apply (E12) and a captain from either team passes the armband to the vice (E11b).
- Example: a manager's captain is a Y1 MID and the vice is a Y2 DEF scoring 6. The captain scores 0 and is subbed off, and the vice counts 6 × 2 = **12**.

### E15. Transfer penalties

| Case | Free transfers available | Transfers made | Extra | Penalty |
| --- | --- | --- | --- | --- |
| E15a. Before the MD1 deadline | unlimited | 20 | 0 | **0** |
| E15b. MD2 | 1 (Q9) | 1 | 0 | **0** |
| E15c. MD2 | 1 | 3 | 2 | 2 × −4 = **−8** |
| E15e. Before the MD6 deadline | unlimited | 6 | 0 | **0** |

The penalty is taken off the matchday the transfers are **for** (the next deadline after they are made). Example: E15c is made on 29 Nov, before the MD2 deadline. If the manager's final XI scores 50 on MD2, the MD2 total is 50 − 8 = **42**.

**E15d. (Q1)** Saved transfers across three matchdays.

| Matchday | Version A: hold at most 2 | Version B: carry over up to 2 (hold up to 3) |
| --- | --- | --- |
| MD2: has 1, makes 0 | saves 1 | saves 1 |
| MD3: has 1 + 1 = 2, makes 0 | saves 2 | saves 2 |
| MD4: free transfers available | min(2 + 1, 2) = **2** | 2 + 1 = **3** |
| MD4: makes 3 transfers | 1 extra: **−4** | 0 extra: **0** |
| MD5: free transfers available | 1 | 1 |

### E16. Wildcard

**E16a. Normal use.** MD3. The manager holds 2 free transfers, plays the Wildcard and makes 9 transfers. Penalty: **0**. The Wildcard is marked used and can't be played again.

**E16b. (Q7 part i)** Wildcard for MD1 or MD6, when transfers are already unlimited.

| | Version A | Version B |
| --- | --- | --- |
| Playing the Wildcard for MD1 or MD6 | Server rejects it: "Transfers are already free this matchday" | Allowed; Wildcard used up, no benefit |

**E16c. (Q7 part ii)** Saved free transfers after a Wildcard. Same setup as E16a (holds 2 for MD3, plays Wildcard).

| | Version A: kept | Version B: reset |
| --- | --- | --- |
| MD4 free transfers | min(2 + 1, 2) = 2 under Q1 A, or 3 under Q1 B | **1** |

### E17. A full manager matchday

Matchday 2. The manager made 2 transfers with 1 free transfer. Formation 3-4-3. Captain MID1, vice FWD1.

**Starting XI**

| Player | Input | Working | Points |
| --- | --- | --- | --- |
| GK1 | `GK, min=50, conceded=0` | 1 + 1 + 4 | 6 |
| DEF1 | `DEF, min=50, goals=1, conceded=0` | 1 + 1 + 6 + 4 | 12 |
| DEF2 | `DEF, min=50, conceded=2` | 1 + 1 − 1 | 1 |
| DEF3 | `DEF, min=0` | didn't play | 0 (needs a sub) |
| MID1 (C) | `MID, min=50, goals=1, conceded=0` | 1 + 1 + 5 + 1 | 8 |
| MID2 | `MID, min=50, conceded=1` | 1 + 1 | 2 |
| MID3 | `MID, min=20` | 1 | 1 |
| MID4 | `MID, min=50, assists=1, conceded=1` | 1 + 1 + 3 | 5 |
| FWD1 (VC) | `FWD, min=50, goals=1` | 1 + 1 + 4 | 6 |
| FWD2 | `FWD, min=50` | 1 + 1 | 2 |
| FWD3 | `FWD, min=50, yellow=1, pen_missed=1` | 1 + 1 − 1 − 2 | −1 |

**Bench:** `GK2 2 pts | B1 FWD4 1 pt, B2 DEF4 2 pts, B3 MID5 0 min`

**Automatic subs.** DEF3 is missing. B1 FWD4 would leave 2 DEF, so skip them. B2 DEF4 (`DEF, min=50, conceded=1`: 1 + 1 = 2) comes in.

**Total**

| Line | Points |
| --- | --- |
| GK1 + DEF1 + DEF2 + DEF4 | 6 + 12 + 1 + 2 = 21 |
| MID1 (captain, 8 × 2) + MID2 + MID3 + MID4 | 16 + 2 + 1 + 5 = 24 |
| FWD1 + FWD2 + FWD3 | 6 + 2 − 1 = 7 |
| XI total | 21 + 24 + 7 = 52 |
| Transfer penalty (2 made, 1 free) | −4 |
| **Matchday 2 total** | **48** |

GK2 (2) and FWD4 (1) stay on the bench and add nothing.

---

## C. Rankings and corrections

### E18. Equal points share a rank

| Manager | Total | Rank |
| --- | --- | --- |
| A | 120 | 1 |
| B | 115 | 2 |
| C | 115 | 2 |
| D | 110 | 4 |

The rank after a tie skips (1, 2, 2, **4**), as in standard competition ranking.

### E19. A player removed from the squad

After MD2, an admin marks a Y3 DEF as "left". On MD3 they stay in every manager's team, score **0** and count as not having played (automatic subs apply). Every manager gets **+1 free transfer** for MD3 (Q13). A manager who held 1 has 2 for MD3; a manager who held 2 has 3 for MD3 only.

### E20. A correction after finalising

MD2 is finalised. The admin then changes a goal's scorer from a Y2 MID (50 min, team concedes 0) to a Y2 FWD (50 min).

| Player | Before | After |
| --- | --- | --- |
| Y2 MID | 1 + 1 + 5 + 1 = 8 | 1 + 1 + 1 = 3 |
| Y2 FWD | 1 + 1 = 2 | 1 + 1 + 4 = 6 |

A manager who owns the MID as captain loses (8 − 3) × 2 = **10** points. A manager who owns the FWD (not captain) gains **4**. Rankings are recalculated and the change is logged. Running the engine again gives the same totals.
