import { Info, TriangleAlert } from "lucide-react";
import { getActiveAnnouncement } from "@/lib/admin/queries/announcements";
import { cn } from "@/lib/utils";

// The admin's announcement, at the top of public and fantasy pages. Cached
// for a minute and expired at once when an admin changes it. Render inside
// <Suspense fallback={null}>.
export async function AnnouncementBanner() {
  const a = await getActiveAnnouncement();
  if (!a) return null;
  const Icon = a.tone === "warning" ? TriangleAlert : Info;
  return (
    <p
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium",
        a.tone === "warning" ? "bg-highlight text-highlight-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {a.message}
    </p>
  );
}
