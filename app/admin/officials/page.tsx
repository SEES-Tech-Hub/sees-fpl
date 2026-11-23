import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { listOfficials, listProfiles } from "@/lib/admin/queries/officials";
import { OfficialsAdmin } from "./officials-admin";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Officials" };

export default function Page({ searchParams }: PageProps<"/admin/officials">) {
  return (
    <Suspense fallback={<BrandLoader />}>
      <Officials searchParams={searchParams} />
    </Suspense>
  );
}

async function Officials({ searchParams }: { searchParams: PageProps<"/admin/officials">["searchParams"] }) {
  const q = (await searchParams).q;
  const search = typeof q === "string" ? q : undefined;
  const [officials, accounts] = await Promise.all([listOfficials(), listProfiles({ search, role: "user", limit: 50 })]);
  return <OfficialsAdmin officials={officials} accounts={accounts} />;
}
