import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

// Owner: Tayo (T12). Every /admin page sits inside this guard. Non-admins see
// a short loading skeleton, then the not-found page, never the admin menu.
// Henry's server actions check the role again on every write.

// Everything under /admin depends on who is signed in, and non-admins get a
// 404, so navigations here can't be instant. This opts the segment out of
// Next's instant-navigation validation (it still streams normally).
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · SEES Games Hub" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole("admin");
  const adminName = profile.display_name ?? profile.email ?? "Admin";

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <AdminNav adminName={adminName} />
      <div className="flex min-w-0 flex-1 flex-col px-4 py-6 md:px-8 md:py-8">{children}</div>
    </div>
  );
}

function AdminShellSkeleton() {
  return (
    <div className="flex flex-1 flex-col md:flex-row" aria-busy="true" aria-label="Loading admin">
      <div className="hidden w-60 shrink-0 border-r border-border p-4 md:block">
        <Skeleton className="mb-6 h-6 w-32" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="mb-2 h-8 w-full" />
        ))}
      </div>
      <div className="h-14 border-b border-border md:hidden" />
      <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
