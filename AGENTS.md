<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SEES Games Hub: engineering rules

Product spec: `docs/PRD.md` (live version: https://claude.ai/artifact/5vxb7y7RGNfRDWwYuVbFuR). If the spec and the code disagree, raise it; don't guess.

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
- **The fantasy engine reads only `player_match_stats`**, never `match_events`. Keep scoring as plain functions (in `lib/fantasy/`) with tests built from Henry's worked examples.
- Fantasy rule values (budget, squad shape, points) come from the rules config table. Never hard-code them.
- All times are shown in WAT (`Africa/Lagos`).

## Styling

- Colours exist only as tokens in `app/globals.css`. Use the utilities (`bg-primary`, `bg-brand`, `text-muted-foreground`, `border-border`, `text-live`, `bg-highlight`). No hex values or raw Tailwind palette colours (`bg-green-600`) anywhere else.
- UI components come from shadcn (Radix base, Nova style; see `components.json`). Add more with `pnpm dlx shadcn@latest add <name>`. Treat `components/ui/*` as vendored: change it only for SEES-wide fixes, and build app-specific pieces in `components/` instead. shadcn's names (`primary`, `secondary`, `accent`) are mapped to the SEES palette, so its components are branded automatically.
- Dark mode follows the device setting through `prefers-color-scheme`. A manual toggle would need next-themes and a class-based `dark` variant.
- Fonts: Oswald for headings (`font-heading`), Inter for body text (`font-sans`).
- Phones first: everything must work at 360 px wide.

## Database

- Migrations live in `supabase/migrations/NNN_description.sql`. They only ever move forward, and each one is reviewed before an admin applies it. Never edit one that has already been applied.
- Regenerate `lib/supabase/types.ts` after every migration.
- Secrets live in `.env.local` (copied from `.env.example`). `SUPABASE_SECRET_KEY` and `VAPID_PRIVATE_KEY` are server-only.

## Ownership

| Area | Owner | Where |
| --- | --- | --- |
| Setup, sign-in, roles, RLS, deploys | Tayo | `proxy.ts`, `app/login`, `app/auth`, `lib/supabase`, `supabase/migrations` |
| Admin portal | Akeem | `app/admin` |
| Fantasy backend (F1 to F8) | Mary | `lib/fantasy`, fantasy server actions and SQL |
| Fantasy frontend | Henry | `app/fantasy` |
| Live scores backend, console API | Bolu | match and standings SQL, `lib/live` |
| Live scores frontend, design kit | Fortune | `app/page.tsx`, `app/matches`, `app/sports`, `components/ui`, `app/globals.css` |
| Console app, PWA, push, share cards | Samuel | `app/console`, `app/manifest.ts`, service worker |

## Change log

Add a dated one-line summary to `timeline-changes.md` for every change you merge. Only ever append to it.
