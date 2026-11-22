# Admin CSV formats

Owner: admin backend. This page describes the three files an admin can import in the admin portal: **players**, **prices** and **fixtures**. Sample files built from the real seed data are in [`docs/samples/`](samples/).

## How an import works

1. **Preview.** The admin picks a file. Nothing is written. Every row comes back with a status: **new**, **update**, **unchanged** or **error**. Each row also shows its errors, its warnings and what would change ("price ₦6.0m → ₦7.5m").
2. **Commit.** If no row has an error, the admin confirms. The validated rows go to the database in one transaction, so either every row is saved or none is. The database checks every row again, because the preview is only a convenience.

Running the same commit twice does nothing the second time. Each import gets an ID when the admin opens it, and the database remembers it.

## Rules for every file

- **Make the file in any spreadsheet** (Google Sheets, Excel, Numbers), then use File → Download → CSV. UTF-8 with or without a BOM, Windows or Unix line endings, and quoted values (`"Cosy, Henry"`) are all fine.
- **The first row is the header.** Header names ignore case and spaces (`Full Name`, `full_name` and `FULL-NAME` all work), and columns can come in any order.
- **Unknown columns are an error, not ignored.** A typo like `postion` stops the import, so nothing is silently lost.
- **Blank lines are skipped.** Spaces around values are trimmed. Names are matched ignoring case and repeated spaces.
- **Row numbers match the spreadsheet.** The header is row 1, so the first player is row 2. Errors read like `Row 14, price: 11.0 is above the maximum of 10.0`.
- **Up to 1,000 rows** per file.

## Price values and the price lock

Prices are in **millions of naira** with one decimal place: `5.5` means ₦5.5m. `5`, `₦5.5m` and `N5.5m` also work.

The allowed range and step live in one place, the database function `admin_price_rules()`. Today they are **₦4.0m to ₦10.0m, in steps of ₦0.5m**. A price like `5.25` or `5.3` is an error, never rounded.

**Prices lock at the matchday 1 deadline.** After that:

- No existing player's price can change.
- A player added late gets the lowest price (4.0). Leave `price` empty, or write `4.0`. Any other price is an error.
- Status changes (injured, suspended, left) are still allowed.

If matchday 1 has no deadline yet, prices aren't locked.

---

## Players

Adds new players and updates existing ones. Sample: [`samples/players.csv`](samples/players.csv).

| Column | Required | Values | Notes |
| --- | --- | --- | --- |
| `full_name` | yes | text, up to 80 characters | |
| `year` | yes | `1` to `5` (`Y2` and `Year 2` also work) | The year team |
| `position` | yes | `GK`, `DEF`, `MID`, `FWD` | `Goalkeeper`, `Defender`, `Midfielder`, `Forward`, `ATT` and `Striker` also work |
| `price` | yes (column) | `4.0` to `10.0` | New players need one before the lock. Blank on an existing player leaves it unchanged |
| `shirt_number` | no | `0` to `99` | Blank leaves it unchanged |
| `status` | no | `available`, `injured`, `suspended`, `left` | Blank means `available` for a new player and leaves an existing player unchanged |
| `display_name` | no | text, up to 40 characters | Only needed when two players in one year share a full name (see below) |

```csv
full_name,year,position,shirt_number,price,status,display_name
Kolade,5,FWD,9,7.5,,
Samuel,2,DEF,4,5.0,,Samuel (DEF)
Samuel,2,FWD,11,6.5,,Samuel (ATT)
Tunde Bakare,1,MID,,5.5,,
```

**How a row finds its player.** The importer looks in that year's team.

- **With a `display_name`:** the player shown with that name. If the display name belongs to someone with a different full name, the row is an error. If no player has it, the row adds a new player under that name.
- **Without a `display_name`:** the player with that `full_name`. No match adds a new player. **Two or more matches are an error.** Year 2 has two players called Samuel, so rows for them need `display_name` (`Samuel (DEF)` or `Samuel (ATT)`).
- **Two rows can't point at the same player.**

**Display names.** These are what managers see in fantasy. They are unique within a year. Players in different years can share one (Atom in Years 3 and 4), because the year is always shown next to them.

- An import **never renames an existing player**. Managers have already seen those names. To change one, edit the player in the admin portal.
- A new player is shown under their full name, unless that name is already taken in their year or another new row in the same file has the same full name. Then one is chosen for them, in this order:
  1. first name and surname initial: `Samuel O.`, then `Samuel Ok.` (only when the clash is with an existing player);
  2. the name with the position: `Samuel (DEF)`;
  3. the name with the shirt number: `Samuel #7`;
  4. the name with a counter: `Samuel 2`.
- Every chosen name shows as a **warning** in the preview so you can check it. To pick your own, fill in `display_name`.

**What an update changes:** position, shirt number, price (before the lock) and status. Full names and display names stay as they are.

---

## Prices

Sets prices for players who already exist. Sample: [`samples/prices.csv`](samples/prices.csv).

| Column | Required | Values |
| --- | --- | --- |
| `full_name` | yes | must match a player in that year |
| `year` | yes | `1` to `5` |
| `price` | yes | `4.0` to `10.0` |
| `display_name` | no | needed only for players who share a full name (the Year 2 Samuels) |

```csv
full_name,year,price,display_name
Kolade,5,8.5,
Samuel,2,5.0,Samuel (DEF)
```

A name that matches no player is an error, because this file never adds players. Rows whose price doesn't change show as **unchanged**. After the lock, any row that changes a price is an error.

---

## Fixtures

Creates fixtures and sets real kickoff times for every sport. Sample: [`samples/fixtures.csv`](samples/fixtures.csv) (the 12 football fixtures).

| Column | Required | Values | Notes |
| --- | --- | --- | --- |
| `sport` | yes | slug or name: `football`, `Table Tennis`, ... | |
| `event` | no | slug or name: `football-men`, `100 m men` | Can be blank when the sport has only one event |
| `stage` | yes (column) | `league`, `final`, `third_place`, `semi_final`, `heat_1`, ... | Lowercase letters, numbers and `_`. `Third place` becomes `third_place`. Blank means `league` |
| `home` | yes (column) | `Y1` to `Y5` (or `Year 1`) | Leave **both** teams blank if they aren't known yet (finals) |
| `away` | yes (column) | `Y1` to `Y5` | |
| `date` | yes (column) | `YYYY-MM-DD`, like `2026-11-28` | |
| `kickoff_wat` | yes (column) | `HH:MM`, 24-hour, **Lagos time**, like `16:00` | Converted to UTC when saved. Leave date and time both blank if the time isn't set yet |
| `venue` | no | text, up to 100 characters | |
| `matchday` | no | `1` to `6` | Football fantasy matchdays only |
| `ref` | no | **not available yet**, pending approval | See below |

```csv
sport,event,stage,home,away,date,kickoff_wat,venue,matchday
football,football-men,league,Y1,Y4,2026-11-28,15:30,UNILAG Sports Centre,1
football,football-men,final,,,2026-12-09,16:00,UNILAG Sports Centre,6
athletics,100 m men,heat_1,,,2026-11-29,09:00,Track,
```

**How a row finds its fixture:** by event, stage, home team and away team (two blank teams count as a match). One match updates that fixture's kickoff, venue and matchday. No match creates a new fixture. More than one match is an error, for example when the same two teams meet twice in one stage. Two rows can't point at the same fixture.

**Planned: `ref`.** An optional short ID such as `FB-MD1-1`, so a fixture can be matched by ID instead. That would also let an import fill in a final's teams. Until it's approved and added to the database, a file with a `ref` column is refused.

**Warnings, which don't block the import:**

- a team playing two fixtures at overlapping times;
- two fixtures at the same venue at overlapping times;
- a kickoff in the past;
- a fixture with no time yet;
- a new kickoff on a fixture that has already started.

**Errors specific to this file:**

- a fixture that has started can't have its event, stage or teams changed;
- a team can't play itself;
- one team given without the other.

Postponing, cancelling and walkovers aren't done by import. Use the fixture page in the admin portal for those.
