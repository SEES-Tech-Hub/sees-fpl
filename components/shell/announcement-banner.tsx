import { getActiveAnnouncement } from "@/lib/admin/queries/announcements";
import { AnnouncementStrip } from "./announcement-strip";

// The admin's announcement on pages with their own header (fantasy). Cached
// for a minute and expired at once when an admin changes it. Render inside
// <Suspense fallback={null}>.
export async function AnnouncementBanner() {
  const a = await getActiveAnnouncement();
  return <AnnouncementStrip announcement={a} />;
}
