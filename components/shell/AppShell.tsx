"use client";

import { usePathname } from "next/navigation";
import { TopHeader } from "./TopHeader";
import { BottomTabBar } from "./BottomTabBar";

interface AppShellProps {
  children: React.ReactNode;
  hasLiveMatch?: boolean;
  role?: "user" | "official" | "admin";
  user?: { name?: string | null; avatarUrl?: string | null } | null;
  announcement?: { id: string; message: string } | null;
}

export function AppShell({ children, hasLiveMatch, role, user, announcement }: AppShellProps) {
  const pathname = usePathname();
  const isFullscreenRoute = pathname.startsWith("/console") || pathname.startsWith("/admin");

  if (isFullscreenRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <TopHeader user={user} announcement={announcement} />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-24 pt-4 md:px-6 lg:pb-10">
        {children}
      </main>
      <BottomTabBar hasLiveMatch={hasLiveMatch} role={role} />
    </>
  );
}
