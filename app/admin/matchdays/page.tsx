import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { listMatchdays } from "@/lib/admin/queries/fixtures";
import { getFantasyRules } from "@/lib/fantasy/api";
import { MatchdaysAdmin } from "./matchdays-admin";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Matchdays" };

export default function Page() {
  return (
    <Suspense fallback={<BrandLoader />}>
      <Matchdays />
    </Suspense>
  );
}

async function Matchdays() {
  const [matchdays, rules] = await Promise.all([listMatchdays(), getFantasyRules()]);
  return <MatchdaysAdmin matchdays={matchdays} minutesBefore={rules.deadlineMinutesBeforeKickoff} />;
}
