<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SEES Games Hub: engineering rules

Product spec: `docs/PRD.md` (live version: https://claude.ai/artifact/5vxb7y7RGNfRDWwYuVbFuR). Who builds what, task by task: the team task plan (https://claude.ai/artifact/Ted1j9QcFEdecqGnhqFeLy). If the spec and the code disagree, raise it; don't guess.

## Tooling

- **pnpm only.** Never run `npm` or `npx`. Use `pnpm`, `pnpm dlx`, `pnpm create`. One lockfile: `pnpm-lock.yaml`.
- Node 22.19 or newer. Next.js 16 (App Router, Cache Components on), React 19, Tailwind 4, Supabase.
- Before you push: `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass.

## Architecture

- **Server first.** Load page data and check permissions in Server Components and Server Actions (`lib/supabase/server.ts`). The browser client (`lib/supabase/client.ts`) is for Realtime and interaction only.
- **Cache Components is on.** Anything that reads cookies, headers or request data must sit inside `<Suspense>`. See `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`.
- **The database enforces roles.** Every table has row-level security. Hiding something in the UI is not authorization.
- `proxy.ts` only refreshes sessions. Don't put authorization in it.
- **`match_events` is the single record of what happened in a match.** Scores, standings, `player_match_stats` and fantasy points are all calculated from it. Never write them by hand.
- **Live scores: read `docs/live-scores.md` before touching match data.** Nobody writes `match_events` or `lineups` directly (the database refuses it). Record and undo through `lib/live/actions.ts` (`recordMatchEvent`, `undoMatchEvent`, `takeFixture`, `releaseFixture`, `setLineup`). Read through `lib/live/queries.ts`, subscribe through `lib/live/realtime.ts`, and use `lib/live/clock.ts` for the match clock. Events are never edited or deleted; mistakes are voided. Event types are `period_start`, `period_end`, `goal` (with `is_own_goal`), `card` (with a colour), `substitution` (player off, then player on), `penalty_miss`, `shootout_kick`, `man_of_the_match`, `full_time` and `walkover` (admin only). There is no `own_goal`, `yellow_card` or `motm` type.
- **Fixtures are guarded.** Scores, periods and winners come only from match events. Status can only move between scheduled, postponed and cancelled, and only before any events. A walkover is a match event, not a status.
- **The fantasy engine reads only `player_match_stats`**, never `match_events`. Keep scoring as plain functions (in `lib/fantasy/`) with tests built from Akeem's worked examples.
- Fantasy rule values (budget, squad shape, points) come from the rules config table. Never hard-code them.
- All times are shown in WAT (`Africa/Lagos`).

## Styling

- Colours exist only as tokens in `app/globals.css`. Use the utilities (`bg-primary`, `bg-brand`, `text-muted-foreground`, `border-border`, `text-live`, `bg-highlight`). No hex values or raw Tailwind palette colours (`bg-green-600`) anywhere else.
- UI components come from shadcn (Radix base, Nova style; see `components.json`). Add more with `pnpm dlx shadcn@latest add <name>`. Treat `components/ui/*` as vendored: change it only for SEES-wide fixes, and build app-specific pieces in `components/` instead. shadcn's names (`primary`, `secondary`, `accent`) are mapped to the SEES palette, so its components are branded automatically.
- Dark mode uses next-themes (`components/shell/theme.tsx`): it starts from the device setting and remembers the header/More-sheet toggle, through a class-based `dark` variant. Pitch surfaces (`bg-pitch`, `bg-pitch-gradient`) stay dark in both themes; put light text on them with `text-on-pitch`.
- Brand gradients: `bg-brand-gradient` (with `text-brand-foreground`), `bg-soft-gradient`, `bg-pitch-gradient`. Section titles can take `heading-bar`.
- Fonts: Menseal for headings (`font-heading`), Poppins for body text (`font-sans`), self-hosted in `public/fonts`. Oswald and Inter remain as fallbacks.
- Phones first: everything must work at 360 px wide.

## Database

- There is one Supabase project. Everyone writes the SQL for their own area, but only Tayo runs SQL on the project. Every change, however small, goes through a migration file and a PR.
- Migrations live in `supabase/migrations/` and are named with a UTC timestamp, then a short description: `YYYYMMDDHHMMSS_short_description.sql` (for example `20261119093000_base_schema.sql`). Use the moment you create the file, **in UTC, not Lagos time** (UTC is one hour behind WAT): `date -u +%Y%m%d%H%M%S` in Git Bash, or `(Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')` in PowerShell. A Lagos-time stamp sorts an hour into the future, and `db push` refuses anyone's migration made in that hour. They only ever move forward. Never rename or edit a migration after it has been applied; write a new one instead.
- Every migration turns on RLS for each new table it creates, with policies in the same file. Use the role helpers `is_admin()`, `is_official()` and `holds_fixture()`. Index every foreign key.
- Tayo applies merged migrations at 10:00, 14:00 and 18:00 on build days, then regenerates `lib/supabase/types.ts` and pushes it. Pull `main` afterwards.
- Secrets live in `.env.local` (copied from `.env.example`). `SUPABASE_SECRET_KEY` and `VAPID_PRIVATE_KEY` are server-only.

## Ownership

| Area | Owner | Where |
| --- | --- | --- |
| Setup, sign-in, roles, RLS, deploys | Tayo | `proxy.ts`, `app/login`, `app/auth`, `lib/supabase`, `supabase/migrations` |
| Admin portal pages (UI) | Tayo | `app/admin` |
| Admin backend (admin SQL, server actions, CSV import logic), backup for infra | Henry | `lib/admin`, admin migrations |
| Fantasy backend (F1 to F8) | Mary | `lib/fantasy`, fantasy server actions and SQL |
| Fantasy frontend, worked scoring examples | Akeem | `app/fantasy`, `components/fantasy`, `lib/fantasy/__fixtures__` |
| Live scores backend, console API | Bolu | match and standings SQL, `lib/live` |
| Live scores frontend, design kit | Fortune | `app/page.tsx`, `app/matches`, `app/sports`, `components/ui`, `app/globals.css` |
| Console app, PWA, push, share cards | Samuel | `app/console`, `app/manifest.ts`, service worker |

## Change log

Add a dated one-line summary to `timeline-changes.md` for every change you merge. Only ever append to it.
