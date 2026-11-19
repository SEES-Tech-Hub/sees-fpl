import { SectionPlaceholder } from "../section-placeholder";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Announcements" };

export default function Page() {
  return (
    <SectionPlaceholder
      title="Announcements"
      task="T19"
      description="Create the home-page banner and switch it on or off."
    />
  );
}
