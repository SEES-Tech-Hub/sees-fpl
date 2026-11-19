import { SectionPlaceholder } from "../section-placeholder";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Players" };

export default function Page() {
  return (
    <SectionPlaceholder
      title="Players"
      task="T13"
      description="All players by team, with filters, search, add and edit, status changes and prices (locked after the matchday 1 deadline)."
    />
  );
}
