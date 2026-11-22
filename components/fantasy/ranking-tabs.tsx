import Link from "next/link";
import { cn } from "@/lib/utils";

/** Rankings tabs (design system §12.9): Overall · My year · Leagues. */
export function RankingTabs({ active, myYear }: { active: "overall" | "year" | "leagues"; myYear: number | null }) {
  const tabs = [
    { key: "overall", label: "Overall", href: "/fantasy/rankings" },
    { key: "year", label: "My year", href: `/fantasy/rankings?year=${myYear ?? 1}` },
    { key: "leagues", label: "Leagues", href: "/fantasy/leagues" },
  ] as const;
  return (
    <nav aria-label="Rankings" className="grid grid-cols-3 rounded-lg bg-muted p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "flex h-10 items-center justify-center rounded-md text-[0.9375rem] font-medium text-muted-foreground",
            active === t.key && "bg-background text-foreground shadow-card",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
