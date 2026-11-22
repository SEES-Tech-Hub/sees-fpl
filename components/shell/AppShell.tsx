import { Suspense } from "react";
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
  return (
    <>
      <Suspense fallback={<div className="h-14 w-full border-b border-border/60 bg-background" />}>
        <TopHeader user={user} announcement={announcement} role={role} />
      </Suspense>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-24 pt-4 md:px-6 lg:pb-10">
        {children}
      </main>

      <Suspense fallback={null}>
        <BottomTabBar hasLiveMatch={hasLiveMatch} role={role} user={user} />
      </Suspense>
    </>
  );
}
