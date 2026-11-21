import {
  CircleDot,
  Hand,
  Target,
  Volleyball,
  Feather,
  Disc3,
  CircleDashed,
  Footprints,
  Waves,
  Dices,
  Gamepad2,
  HandFist,
  type LucideIcon,
} from "lucide-react";

export const sportIcons: Record<string, LucideIcon> = {
  football: CircleDot,
  handball: Hand,
  basketball: Target,
  volleyball: Volleyball,
  badminton: Feather,
  table_tennis: Disc3,
  lawn_tennis: CircleDashed,
  athletics: Footprints,
  swimming: Waves,
  board_games: Dices,
  mobile_games: Gamepad2,
  mortal_kombat: HandFist,
};
export type SportSlug = keyof typeof sportIcons;