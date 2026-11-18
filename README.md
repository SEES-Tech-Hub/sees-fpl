# SEES Games Hub

Live scores, results and fantasy football for SEES Games 2026 (28 Nov – 9 Dec 2026).

- Product spec: [docs/PRD.md](docs/PRD.md)
- Football squads: [docs/football-team-listing.md](docs/football-team-listing.md)
- Team rules and ownership: [AGENTS.md](AGENTS.md)

## Run it locally

You need Node 22.19 or newer and pnpm. **Use pnpm only, never npm or npx.**

```bash
pnpm install
cp .env.example .env.local   # then fill in the Supabase values
pnpm dev
```

Open http://localhost:3000.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Supabase setup (once per environment)

1. Create the Supabase project and copy its URL and publishable key into `.env.local`.
2. Under Authentication > Providers, turn on Google.
3. Under Authentication > URL Configuration, add `http://localhost:3000/auth/callback` and the production equivalent.
