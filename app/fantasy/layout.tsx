import Link from "next/link";
import { Suspense } from "react";
import { FantasyNav, FantasyNavFallback } from "@/components/fantasy/fantasy-nav";
import { StubBanner } from "@/components/fantasy/stub-banner";

// Owner: Henry (fantasy frontend). The fantasy section's own header and tabs;
// the site-wide shell is Fortune's.
export default function FantasyLayout({ children }: LayoutProps<"/fantasy">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-brand text-brand-foreground">
        <div className="mx-auto w-full max-w-2xl px-4 pt-3 pb-2">
          <div className="flex items-baseline justify-between gap-3">
            <Link href="/fantasy" className="font-heading text-xl font-semibold tracking-wide">
              SEES Fantasy
            </Link>
            <Link href="/" className="text-sm text-brand-foreground/80 underline-offset-4 hover:underline">
              Live scores
            </Link>
          </div>
          <div className="mt-2">
            <Suspense fallback={<FantasyNavFallback />}>
              <FantasyNav />
            </Suspense>
          </div>
        </div>
      </header>
      <StubBanner />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4 pb-28">{children}</main>
    </div>
  );
}
