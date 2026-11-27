import Image from "next/image";
import { YearCrest } from "@/components/brand/year-crest";
import { teamColour } from "@/lib/design/team-colour";
import type { Player } from "@/lib/fantasy/types";
import { cn } from "@/lib/utils";

// A player's face in a circle ringed in their year's colour, with the year
// crest as a badge on the corner. No photo yet: the crest in the same circle,
// so rows and grids line up either way. Photos: public/players/<id>.webp
// (scripts/player-photos.mjs).

export function PlayerFace({
  player,
  size = 40,
  badge = true,
  className,
}: {
  player: Pick<Player, "displayName" | "teamYear" | "photoUrl">;
  /** Diameter in px. */
  size?: number;
  /** Show the crest on the corner (photos only). */
  badge?: boolean;
  className?: string;
}) {
  const ring = { boxShadow: `0 0 0 2px var(--background), 0 0 0 ${size >= 80 ? 5 : 4}px ${teamColour(player.teamYear)}` };
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      {player.photoUrl ? (
        <>
          <Image
            src={player.photoUrl}
            alt=""
            width={size}
            height={size}
            sizes={`${size}px`}
            className="size-full rounded-full bg-muted object-cover"
            style={ring}
          />
          {badge && (
            <YearCrest
              year={player.teamYear}
              size={Math.max(16, Math.round(size * 0.36))}
              label=""
              className="absolute -right-1 -bottom-1"
            />
          )}
        </>
      ) : (
        <span className="flex size-full items-center justify-center rounded-full bg-muted" style={ring}>
          <YearCrest year={player.teamYear} size={Math.round(size * 0.55)} label="" />
        </span>
      )}
    </span>
  );
}
