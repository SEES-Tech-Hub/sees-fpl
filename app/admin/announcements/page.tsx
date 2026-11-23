import { Suspense } from "react";
import { connection } from "next/server";
import { BrandLoader } from "@/components/brand/brand-loader";
import { listAnnouncements } from "@/lib/admin/queries/announcements";
import { AnnouncementsAdmin } from "./announcements-admin";

// Admin-only and session-dependent: see the note on `instant` in ../layout.tsx.
export const instant = false;

export const metadata = { title: "Announcements" };

export default function Page() {
  return (
    <Suspense fallback={<BrandLoader />}>
      <Announcements />
    </Suspense>
  );
}

async function Announcements() {
  await connection();
  const announcements = await listAnnouncements();
  return <AnnouncementsAdmin announcements={announcements} now={now()} />;
}

function now() {
  return new Date().toISOString();
}
