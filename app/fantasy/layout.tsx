import Link from "next/link";
import { SeesMark } from "@/components/brand/sees-mark";
import { Suspense } from "react";
import { FantasyNav, FantasyNavFallback } from "@/components/fantasy/fantasy-nav";
import { MotionProvider } from "@/components/fantasy/motion-provider";
import { OfflineBanner } from "@/components/fantasy/offline-banner";
import { AnnouncementBanner } from "@/components/shell/announcement-banner";
import { ThemeToggle } from "@/components/theme/theme-toggle";

// Owner: Henry (fantasy frontend). The fantasy section's own header and tabs.
// The site-wide shell and bottom tab bar are Fortune's (design system §10).
export default function FantasyLayout({ children }: LayoutProps<"/fantasy">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto w-full max-w-2xl px-4 lg:max-w-5xl">
          <div className="flex h-12 items-center justify-between gap-3">
            <Link href="/fantasy" className="flex items-center gap-2 font-heading text-lg font-semibold">
              <SeesMark className="size-7 text-brand" />
              SEES Fantasy
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Link href="/" className="flex h-11 items-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline">
                Live scores
              </Link>
            </div>
          </div>
          <div className="pb-2">
            <Suspense fallback={<FantasyNavFallback />}>
              <FantasyNav />
            </Suspense>
          </div>
        </div>
      </header>
      <OfflineBanner />
      <Suspense fallback={null}>
        <AnnouncementBanner />
      </Suspense>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4 pb-12 lg:max-w-5xl lg:px-6">
        <MotionProvider>{children}</MotionProvider>
      </main>
    </div>
  );
}
