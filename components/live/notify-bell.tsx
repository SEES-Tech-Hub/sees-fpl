"use client";

import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { currentTopics, followTopic, pushSupport, unfollowTopic, type PushSupport } from "@/lib/push/client";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { TeamSummary } from "@/lib/live/types";
import { cn } from "@/lib/utils";

// "Notify me": alerts for this match (the start, big moments, the result),
// a team's matches, or every match. Works without signing in. On iPhone, push
// only works once the app is added to the Home Screen (iOS 16.4+).

export function NotifyBell({ fixtureId, home, away }: { fixtureId: string; home: TeamSummary | null; away: TeamSummary | null }) {
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<PushSupport>("ok");
  const options = [
    { topic: `fixture:${fixtureId}`, label: "This match" },
    ...(home ? [{ topic: `team:${home.id}`, label: `Every ${home.name} match` }] : []),
    ...(away ? [{ topic: `team:${away.id}`, label: `Every ${away.name} match` }] : []),
    { topic: "all", label: "Every match" },
  ];
  const on = topics.some((t) => options.some((o) => o.topic === t));

  async function openSheet() {
    const s = pushSupport();
    setWhy(s);
    setOpen(true);
    if (s === "ok") setTopics(await currentTopics());
  }

  async function toggle(topic: string) {
    setBusy(true);
    const r = topics.includes(topic) ? await unfollowTopic(topic) : await followTopic(topic);
    setBusy(false);
    if (!r.ok) return toast.error(r.message);
    setTopics(r.topics);
    if (r.topics.includes(topic)) toast.success("Alerts on. We'll tell you when it starts, the big moments and the result.");
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label={on ? "Notifications on" : "Notify me"}
        onClick={openSheet}
        className="size-10 rounded-full bg-brand-foreground/10 text-brand-foreground hover:bg-brand-foreground/20 hover:text-brand-foreground"
      >
        {on ? <BellRing className="size-5 motion-safe:animate-in motion-safe:spin-in-12" /> : <Bell className="size-5" />}
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Notify me</DrawerTitle>
            <DrawerDescription>The start, the big moments and the result.</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4 pb-6">
            {why === "ios-install" && (
              <p className="rounded-lg bg-secondary p-3 text-sm">
                On iPhone, add SEES Games to your Home Screen first (Share, then Add to Home Screen), open it from there, and tap the bell again.
              </p>
            )}
            {why === "unsupported" && <p className="rounded-lg bg-muted p-3 text-sm">This browser can&apos;t show notifications.</p>}
            {why === "dev" && <p className="rounded-lg bg-muted p-3 text-sm">Notifications work on the deployed app (they need the service worker).</p>}
            {why === "no-key" && <p className="rounded-lg bg-muted p-3 text-sm">Notifications aren&apos;t set up yet.</p>}
            {why === "ok" &&
              options.map((o) => {
                const active = topics.includes(o.topic);
                return (
                  <button
                    key={o.topic}
                    type="button"
                    disabled={busy}
                    onClick={() => toggle(o.topic)}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-12 items-center justify-between rounded-lg border border-border px-3 text-left text-[0.9375rem] font-medium transition-colors duration-200",
                      active && "border-primary bg-secondary",
                    )}
                  >
                    {o.label}
                    <span
                      className={cn(
                        "relative h-6 w-11 rounded-full bg-muted transition-colors duration-200",
                        active && "bg-primary",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow transition-transform duration-200",
                          active && "translate-x-5",
                        )}
                      />
                    </span>
                  </button>
                );
              })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
