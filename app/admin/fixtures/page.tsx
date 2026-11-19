import { SectionPlaceholder } from "../section-placeholder";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Fixtures" };

export default function Page() {
  return (
    <SectionPlaceholder
      title="Fixtures"
      task="T15"
      description="Every fixture by date, with create and edit, postpone, cancel, walkover, and filling the finals from the league table."
    />
  );
}
