"use client";

import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { followedTopics, followTopics, unfollowTopics } from "@/app/push/actions";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { TeamSummary } from "@/lib/live/types";
import { cn } from "@/lib/utils";

// "Notify me": goal, kick-off, half-time and full-time alerts for this match,
// a team's matches, or every match. Works without signing in. On iPhone, push
// only works once the app is added to the Home Screen (iOS 16.4+).

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Support = "ok" | "unsupported" | "ios-install" | "dev" | "no-key";

function support(): Support {
  if (typeof window === "undefined") return "unsupported";
  if (!KEY) return "no-key";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  if (ios && !standalone) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (process.env.NODE_ENV !== "production") return "dev";
  return "ok";
}

async function subscription(create: boolean) {
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (create ? await navigator.serviceWorker.register("/sw.js") : undefined);
  if (!reg) return null;
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing || !create) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) });
}

export function NotifyBell({ fixtureId, home, away }: { fixtureId: string; home: TeamSummary | null; away: TeamSummary | null }) {
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<Support>("ok");
  const options = [
    { topic: `fixture:${fixtureId}`, label: "This match" },
    ...(home ? [{ topic: `team:${home.id}`, label: `Every ${home.name} match` }] : []),
    ...(away ? [{ topic: `team:${away.id}`, label: `Every ${away.name} match` }] : []),
    { topic: "all", label: "Every match" },
  ];
  const on = topics.some((t) => options.some((o) => o.topic === t));

  async function openSheet() {
    const s = support();
    setWhy(s);
    setOpen(true);
    if (s !== "ok") return;
    try {
      const sub = await subscription(false);
      if (sub) setTopics(await followedTopics(sub.endpoint));
    } catch {
      // Not subscribed yet.
    }
  }

  async function toggle(topic: string) {
    setBusy(true);
    try {
      if (topics.includes(topic)) {
        const sub = await subscription(false);
        if (!sub) return;
        const r = await unfollowTopics(sub.endpoint, [topic]);
        if (r.ok) setTopics(r.topics);
        else toast.error(r.message);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifications are blocked. Allow them for this site in your browser settings.");
        return;
      }
      const sub = await subscription(true);
      if (!sub) return;
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await followTopics(json, [topic]);
      if (r.ok) {
        setTopics(r.topics);
        toast.success("You'll get goal alerts.");
      } else toast.error(r.message);
    } catch {
      toast.error("Couldn't turn on notifications on this device.");
    } finally {
      setBusy(false);
    }
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
            <DrawerDescription>Kick-off, goals, half-time and full time.</DrawerDescription>
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
