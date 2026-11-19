import { SectionPlaceholder } from "../section-placeholder";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Sports and events" };

export default function Page() {
  return (
    <SectionPlaceholder
      title="Sports and events"
      task="T15"
      description="The 12 sports, their result formats, and the events under each sport."
    />
  );
}
