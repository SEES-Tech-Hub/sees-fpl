import "server-only";
import { createPublicClient } from "@/lib/live/public-client";
import type { SquadPlayer } from "@/lib/console/squad";
import type { PlayerPosition } from "@/lib/live/types";

// Owner: Samuel (console). Both teams' squads, for the lineup check and the
// player pickers. Players are public, so this reads as an anonymous visitor
// like lib/live/queries.ts. Players who have left the team are not included.

export type { SquadPlayer };

const POSITION_ORDER: Record<PlayerPosition, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

export async function getSquads(teamIds: string[]): Promise<SquadPlayer[]> {
  if (teamIds.length === 0) return [];
  const { data, error } = await createPublicClient()
    .from("players")
    .select("id, team_id, display_name, shirt_number, position, status")
    .in("team_id", teamIds)
    .neq("status", "left");
  if (error) throw new Error(`Couldn't load the squads: ${error.message}`);

  return (data ?? [])
    .map((p) => ({
      id: p.id,
      teamId: p.team_id,
      name: p.display_name,
      shirtNumber: p.shirt_number,
      position: p.position,
      status: p.status,
    }))
    .sort(
      (a, b) =>
        POSITION_ORDER[a.position] - POSITION_ORDER[b.position] ||
        (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999) ||
        a.name.localeCompare(b.name),
    );
}
