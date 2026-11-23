import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { getPriceSettings, listPlayers } from "@/lib/admin/queries/players";
import { listTeams } from "@/lib/admin/queries/sports";
import { PlayersAdmin } from "./players-admin";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Players" };

export default function Page() {
  return (
    <Suspense fallback={<BrandLoader />}>
      <Players />
    </Suspense>
  );
}

async function Players() {
  const [players, teams, prices] = await Promise.all([listPlayers(), listTeams(), getPriceSettings()]);
  return <PlayersAdmin players={players} teams={teams} prices={prices} />;
}
