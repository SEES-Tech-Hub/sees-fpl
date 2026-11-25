import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { loadAnalytics } from "@/lib/admin/actions/analytics";
import { PageTitle } from "../_kit/admin-kit";
import { AnalyticsDashboard } from "./analytics-dashboard";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Analytics" };

export default function Page({ searchParams }: PageProps<"/admin/analytics">) {
  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        title="Analytics"
        description="Who's using the app, from where, and how much. Counted by the app itself: no third parties, no cookies."
      />
      <Suspense fallback={<BrandLoader />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/admin/analytics">["searchParams"] }) {
  const sp = await searchParams;
  const days = Number(typeof sp.days === "string" ? sp.days : 30);
  const result = await loadAnalytics(days);
  if (!result.ok) {
    return <p className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{result.error.message}</p>;
  }
  return <AnalyticsDashboard initial={result.data} />;
}
