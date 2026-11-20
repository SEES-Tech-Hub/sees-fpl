import { SectionPlaceholder } from "../section-placeholder";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Audit log" };

export default function Page() {
  return (
    <SectionPlaceholder
      title="Audit log"
      task="T19"
      description="Who changed what and when, filtered by table and date."
    />
  );
}
