import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getActiveAnnouncement } from "@/lib/admin/queries/announcements";
import { TopHeader } from "./TopHeader";
import { BottomTabBar } from "./BottomTabBar";

// Owner: Fortune (design kit). The site-wide header and bottom tab bar.
//
// - AppShell (root layout): the page, then the bottom tab bar. The tab bar
//   decides by route where it shows (components/shell/routes.ts).
// - SiteHeader (app/(site)/layout.tsx): the top header, only on the public
//   pages in the (site) route group, so its loading placeholder never shows
//   on pages without a header (fantasy, console, admin, sign-in).
//
// Pages keep their own <main> and gutters. Who is signed in is read inside
// <Suspense> (it needs the request's cookies), so every page's static shell
// still prerenders with the fallbacks.

type ShellUser = { name?: string | null; avatarUrl?: string | null };
type ShellRole = "user" | "official" | "admin";

async function loadViewer(): Promise<{ user: ShellUser | null; role: ShellRole | undefined }> {
  const current = await getCurrentUser();
  if (!current) return { user: null, role: undefined };
  const { profile } = current;
  return {
    user: { name: profile.display_name ?? profile.email, avatarUrl: profile.avatar_url },
    role: profile.role,
  };
}

type ShellAnnouncement = { id: string; message: string; tone?: "info" | "warning" };

async function SignedInHeader({ announcement }: { announcement?: ShellAnnouncement | null }) {
  // The admin's active announcement (Admin → Announcements), unless a page passes one.
  const [{ user, role }, active] = await Promise.all([loadViewer(), announcement === undefined ? getActiveAnnouncement() : null]);
  return <TopHeader user={user} role={role} announcement={announcement ?? active} />;
}

async function SignedInTabBar({ hasLiveMatch }: { hasLiveMatch?: boolean }) {
  const { user, role } = await loadViewer();
  return <BottomTabBar hasLiveMatch={hasLiveMatch} role={role} user={user} />;
}

export function SiteHeader({ announcement }: { announcement?: ShellAnnouncement | null }) {
  return (
    <Suspense fallback={<div className="h-14 w-full border-b border-border/60 bg-background" />}>
      <SignedInHeader announcement={announcement} />
    </Suspense>
  );
}

export function AppShell({ children, hasLiveMatch }: { children: React.ReactNode; hasLiveMatch?: boolean }) {
  return (
    <>
      <div className="flex w-full flex-1 flex-col">{children}</div>
      <Suspense fallback={null}>
        <SignedInTabBar hasLiveMatch={hasLiveMatch} />
      </Suspense>
    </>
  );
}
