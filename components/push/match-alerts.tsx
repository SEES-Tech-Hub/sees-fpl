"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { currentTopics, followTopic, pushSupport, unfollowTopic, type PushSupport } from "@/lib/push/client";
import { cn } from "@/lib/utils";

// Match alerts: one switch for "every match" (the push topic "all": kick-offs,
// goals and big moments, results). In the More sheet on phones and as a bell
// in the header on laptops; the alerts prompt (alerts-prompt.tsx) uses the
// same hook. A change anywhere is announced on window, so every copy agrees.

const CHANGED = "sees:match-alerts";
const TOPIC = "all";

const noop = () => () => {};

export function useMatchAlerts() {
  const support = useSyncExternalStore<PushSupport | null>(noop, pushSupport, () => null);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (support !== "ok") return;
    let live = true;
    const load = () => void currentTopics().then((t) => live && setOn(t.includes(TOPIC)));
    load();
    window.addEventListener(CHANGED, load);
    return () => {
      live = false;
      window.removeEventListener(CHANGED, load);
    };
  }, [support]);

  const set = useCallback(async (want: boolean) => {
    setBusy(true);
    const r = want ? await followTopic(TOPIC) : await unfollowTopic(TOPIC);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.message);
      return false;
    }
    setOn(r.topics.includes(TOPIC));
    window.dispatchEvent(new Event(CHANGED));
    if (want) toast.success("Match alerts on. We'll tell you about kick-offs, goals and results.");
    return true;
  }, []);

  return { support, on: support === "ok" ? on : false, busy, set };
}

function Switch({ on, busy }: { on: boolean; busy: boolean }) {
  return (
    <span aria-hidden className={cn("relative h-6 w-11 shrink-0 rounded-full bg-foreground/20 transition-colors duration-200", on && "bg-primary", busy && "opacity-60")}>
      <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow transition-transform duration-200", on && "translate-x-5")} />
    </span>
  );
}

/** A full row with a switch, for the More sheet. Hidden where push can't work at all. */
export function MatchAlertsRow({ className }: { className?: string }) {
  const { support, on, busy, set } = useMatchAlerts();
  if (support === null || support === "unsupported" || support === "no-key") return null;

  if (support === "ios-install") {
    return (
      <div className={cn("flex items-start gap-3 rounded-2xl bg-muted p-3", className)}>
        <BellOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-sm">
          <span className="block font-semibold">Match alerts</span>
          On iPhone, add SEES Games to your Home Screen first (Share, then Add to Home Screen), then open it from there.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(on)}
      disabled={busy || on === null || support === "dev"}
      onClick={() => void set(!on)}
      className={cn("flex min-h-14 w-full items-center gap-3 rounded-2xl bg-muted px-3 py-2 text-left disabled:opacity-70", className)}
    >
      {on ? <BellRing className="size-5 shrink-0 text-primary" aria-hidden /> : <Bell className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold">Match alerts</span>
        <span className="block text-[0.8125rem] text-muted-foreground">
          {support === "dev" ? "Works on the live site" : "Kick-offs, goals and results, on this device"}
        </span>
      </span>
      <Switch on={Boolean(on)} busy={busy} />
    </button>
  );
}

/** A bell in the header (laptops): one tap turns match alerts on or off. */
export function MatchAlertsButton({ className }: { className?: string }) {
  const { support, on, busy, set } = useMatchAlerts();
  if (support !== "ok") return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(on)}
      aria-label="Match alerts"
      title={on ? "Match alerts are on" : "Turn on match alerts"}
      disabled={busy || on === null}
      onClick={() => void set(!on)}
      className={cn(
        "flex size-10 items-center justify-center rounded-full transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-60",
        on ? "text-primary" : "text-muted-foreground",
        className,
      )}
    >
      {on ? <BellRing className="size-5" aria-hidden /> : <Bell className="size-5" aria-hidden />}
    </button>
  );
}
