import type { PlayerPosition } from "@/lib/live/types";
import type { Database } from "@/lib/supabase/types";

/** A squad player, for the lineup check and the console's player pickers. */
export type SquadPlayer = {
  id: string;
  teamId: string;
  name: string;
  shirtNumber: number | null;
  position: PlayerPosition;
  status: Database["public"]["Enums"]["player_status"];
};
