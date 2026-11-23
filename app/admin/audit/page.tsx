import { Suspense } from "react";
import Link from "next/link";
import { BrandLoader } from "@/components/brand/brand-loader";
import { Badge } from "@/components/ui/badge";
import { getAuditLog } from "@/lib/admin/queries/audit";
import { PageTitle } from "../_kit/admin-kit";
import { formatDay, formatTime } from "../wat";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Audit log" };

const TABLES = ["fixtures", "match_events", "players", "teams", "matchdays", "profiles", "announcements", "sports", "events"];

export default function Page({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <div className="flex flex-col gap-5">
      <PageTitle title="Audit log" description="Every change made in the admin portal and the console, newest first, with who made it." />
      <Suspense fallback={<BrandLoader />}>
        <Audit searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Audit({ searchParams }: { searchParams: PageProps<"/admin/audit">["searchParams"] }) {
  const sp = await searchParams;
  const table = typeof sp.table === "string" && TABLES.includes(sp.table) ? sp.table : undefined;
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const page = await getAuditLog({ table, cursor, limit: 50 });
  const href = (t?: string, c?: string) => {
    const q = new URLSearchParams();
    if (t) q.set("table", t);
    if (c) q.set("cursor", c);
    const s = q.toString();
    return s ? `/admin/audit?${s}` : "/admin/audit";
  };

  return (
    <>
      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        <Link href={href()} className={`rounded-full border px-3 py-1 text-sm ${!table ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
          Everything
        </Link>
        {TABLES.map((t) => (
          <Link
            key={t}
            href={href(t)}
            className={`rounded-full border px-3 py-1 text-sm ${table === t ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
          >
            {t.replace("_", " ")}
          </Link>
        ))}
      </nav>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {page.entries.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing here yet.</li>}
        {page.entries.map((e) => (
          <li key={e.key} className="flex flex-wrap items-start gap-3 px-3 py-2.5 text-sm">
            <span className="w-28 shrink-0 text-xs text-muted-foreground tabular-nums">
              {formatDay(e.occurredAt)}
              <br />
              {formatTime(e.occurredAt)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block">{e.summary}</span>
              <span className="block text-xs text-muted-foreground">{e.actorName ?? "System"}</span>
            </span>
            <Badge variant={e.action === "delete" || e.action === "void" ? "destructive" : "outline"}>{e.action}</Badge>
          </li>
        ))}
      </ul>
      {page.nextCursor && (
        <Link href={href(table, page.nextCursor)} className="self-start text-sm font-semibold text-primary underline-offset-4 hover:underline">
          Older entries
        </Link>
      )}
    </>
  );
}
