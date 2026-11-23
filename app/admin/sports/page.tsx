import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { listSports } from "@/lib/admin/queries/sports";
import { SportsAdmin } from "./sports-admin";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Sports and events" };

export default function Page() {
  return (
    <Suspense fallback={<BrandLoader />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const sports = await listSports();
  return <SportsAdmin sports={sports} />;
}
