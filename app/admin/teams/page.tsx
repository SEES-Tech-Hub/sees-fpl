import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { listTeams } from "@/lib/admin/queries/sports";
import { TeamsAdmin } from "./teams-admin";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Teams" };

export default function Page() {
  return (
    <Suspense fallback={<BrandLoader />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const teams = await listTeams();
  return <TeamsAdmin teams={teams} />;
}
