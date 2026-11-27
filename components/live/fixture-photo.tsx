import Image from "next/image";
import { sportPhoto } from "@/lib/design/sport-photos";
import { teamColour } from "@/lib/design/team-colour";
import { cn } from "@/lib/utils";

// A sport's photo behind a pitch-green card (the next-match ticket, live
// cards, match and race heroes). The photo stays sharp under a dark gradient
// (lighter at the top, darker where the buttons sit), with a thin stripe of
// both teams' colours along the top edge. It settles in with a slow zoom,
// drifts a little as the page scrolls and zooms on hover (all off for
// reduced motion; app/globals.css).
//
// Renders nothing for a sport without a photo, so the card keeps its plain
// green look. Put it first inside a `relative overflow-hidden bg-pitch` card,
// before the content (which must be `relative` to sit on top), and add
// `sees-on-photo` to the card so its text gets a soft shadow.

export function FixturePhoto({
  sport,
  homeYear,
  awayYear,
  priority = false,
  sizes = "(min-width: 1024px) 56rem, 100vw",
  className,
}: {
  /** The sport's slug ("football"). */
  sport: string;
  /** The two teams' years, for the colour stripe along the top. */
  homeYear?: number | null;
  awayYear?: number | null;
  /** Load straight away: for the hero at the top of a page. */
  priority?: boolean;
  /** How wide the card is at each screen size, so phones get a small file. */
  sizes?: string;
  className?: string;
}) {
  const photo = sportPhoto(sport);
  if (!photo) return null;
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <Image
        src={photo.src}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        className="sees-photo object-cover"
        style={{ objectPosition: photo.position }}
      />
      <span className="absolute inset-0 bg-gradient-to-b from-photo-shade/60 via-photo-shade/45 to-photo-shade/90" />
      {(homeYear || awayYear) && (
        <span
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: `linear-gradient(90deg, ${teamColour(homeYear ?? undefined)} 0 50%, ${teamColour(awayYear ?? undefined)} 50% 100%)` }}
        />
      )}
    </span>
  );
}

/** True when a sport has a photo (its cards then drop the pattern and colour wedges). */
export const hasPhoto = (sport: string) => sportPhoto(sport) !== null;
