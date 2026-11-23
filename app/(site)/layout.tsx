import { Suspense } from "react";
import { SiteHeader } from "@/components/shell/AppShell";
import { AnnouncementBanner } from "@/components/shell/announcement-banner";

// Owner: Fortune. The public pages (home, sports, tables, matches)
// share the site header. Fantasy, the console, admin and sign-in have their
// own layouts, and the offline page stays outside so the service worker
// caches it without anyone's account in the header. The route group
// doesn't change any URL.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={null}>
        <AnnouncementBanner />
      </Suspense>
      {children}
    </>
  );
}
