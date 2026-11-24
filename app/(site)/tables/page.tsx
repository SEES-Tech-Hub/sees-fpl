import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { TablesView } from "@/components/live/tables-view";
import { getTablesPage } from "@/lib/live/public-pages";
import { pageMeta } from "@/lib/seo";

// Owner: Fortune (built by Tayo). The football table (live while matches
// are on), the medal table and the football stats.

export const metadata = pageMeta({
  title: "Tables",
  description: "The SEES Games 2026 football table (live during matches), the medal table for the championship, top scorers, assists, clean sheets and suspensions.",
  path: "/tables",
});

export default function TablesPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 py-4 pb-12 lg:max-w-4xl lg:px-6">
      <Suspense fallback={<BrandLoader />}>
        <Tables />
      </Suspense>
    </main>
  );
}

async function Tables() {
  const data = await getTablesPage();
  return <TablesView data={data} />;
}
