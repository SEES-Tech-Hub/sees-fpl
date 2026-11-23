import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { listFixtures, listMatchdays } from "@/lib/admin/queries/fixtures";
import { listOfficials } from "@/lib/admin/queries/officials";
import { listSports, listTeams } from "@/lib/admin/queries/sports";
import { FixturesAdmin } from "./fixtures-admin";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Fixtures" };

export default function Page() {
  return (
    <Suspense fallback={<BrandLoader />}>
      <Fixtures />
    </Suspense>
  );
}

async function Fixtures() {
  const [fixtures, sports, teams, matchdays, officials] = await Promise.all([
    listFixtures(),
    listSports(),
    listTeams(),
    listMatchdays(),
    listOfficials(),
  ]);
  return <FixturesAdmin fixtures={fixtures} sports={sports} teams={teams} matchdays={matchdays} officials={officials} />;
}
