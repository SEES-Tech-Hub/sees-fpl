import { CircleDot } from "lucide-react";
import { sportIcons, type SportSlug } from "@/lib/design/sports";

interface SportIconProps {
  sport: SportSlug | (string & {});
  size?: number;
  className?: string;
}

export function SportIcon({ sport, size = 20, className = "" }: SportIconProps) {
  const Icon = sportIcons[sport as SportSlug] ?? CircleDot;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" className={className} />;
}
