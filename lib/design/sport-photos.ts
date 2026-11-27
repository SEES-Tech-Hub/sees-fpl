import type { StaticImageData } from "next/image";
import athletics from "@/public/photos/athletics.webp";
import basketball from "@/public/photos/basketball.webp";
import football from "@/public/photos/football.webp";
import handball from "@/public/photos/handball.webp";
import volleyball from "@/public/photos/volleyball.webp";

// Photos from the SEES HOD Games and the HOD finale, shown behind a sport's
// match heroes, live cards and the next-match ticket
// (components/live/fixture-photo.tsx).
//
// To add or change one: put a wide photo (about 1600 px across, WebP) in
// public/photos named after the sport's slug, import it here and add it to
// PHOTOS. `position` is the part of the photo to keep in view when a card
// crops it (CSS object-position). A sport with no photo keeps the plain
// pitch-green card.

export type SportPhoto = { src: StaticImageData; position: string };

const PHOTOS: Record<string, SportPhoto> = {
  athletics: { src: athletics, position: "55% 35%" },
  basketball: { src: basketball, position: "70% 30%" },
  football: { src: football, position: "60% 40%" },
  handball: { src: handball, position: "50% 40%" },
  volleyball: { src: volleyball, position: "52% 30%" },
};

/** The photo for a sport (by slug, e.g. "football"), or null when it has none. */
export function sportPhoto(slug: string): SportPhoto | null {
  return PHOTOS[slug] ?? null;
}
