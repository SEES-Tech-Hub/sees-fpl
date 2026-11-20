import { SectionPlaceholder } from "../section-placeholder";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Officials" };

export default function Page() {
  return (
    <SectionPlaceholder
      title="Officials"
      task="T16"
      description="Promote accounts to official, and choose each fixture's console holder."
    />
  );
}
