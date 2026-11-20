import { SectionPlaceholder } from "../section-placeholder";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Matchdays" };

export default function Page() {
  return (
    <SectionPlaceholder
      title="Matchdays"
      task="T17"
      description="The 6 football matchdays: deadlines, status, and finalising points."
    />
  );
}
