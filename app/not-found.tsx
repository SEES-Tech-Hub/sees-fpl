import Link from "next/link";
import { EmptyIllustration } from "@/components/brand/empty-art";
import { SeesMark } from "@/components/brand/sees-mark";
import { Button } from "@/components/ui/button";

// 404: the ball's gone over the fence. Links back to the main sections.

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <Link href="/" className="absolute top-4 left-4 flex items-center gap-2 font-heading text-lg font-semibold">
        <SeesMark className="size-7 text-brand dark:text-brand-light" /> SEES Games
      </Link>
      <p className="font-heading text-[7rem] leading-none font-bold text-brand/15 select-none dark:text-brand-light/15 sm:text-[10rem]">
        404
      </p>
      <EmptyIllustration art="lost" className="-mt-10 h-36 sm:-mt-14 sm:h-44" />
      <h1 className="mt-4 font-heading text-3xl font-bold uppercase text-brand dark:text-foreground">Out of bounds</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        That page went over the fence. It may have moved, or the link has a typo.
      </p>
      <div className="mt-8 flex w-full max-w-sm flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="h-12 px-6">
          <Link href="/">Back to the scores</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 px-6">
          <Link href="/sports">All sports</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 px-6">
          <Link href="/fantasy">SEES Fantasy</Link>
        </Button>
      </div>
    </main>
  );
}
