import { SectionPlaceholder } from "../section-placeholder";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Teams" };

export default function Page() {
  return (
    <SectionPlaceholder
      title="Teams"
      task="T13"
      description="Edit each year's name, short name, class label and coaches."
    />
  );
}
