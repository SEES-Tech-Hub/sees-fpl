"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useMatchAlerts } from "./match-alerts";
import { promptSlotTaken, takePromptSlot } from "./prompt-slot";

// Asks people to turn on match alerts, a little while into a visit, on the
// same browsing pages as the install card (never both in one visit). Only
// where alerts can work right now, the browser hasn't been told no, and they
// aren't on already. "Not now" hides it for three days. On an iPhone that
// hasn't added the app yet, the install card comes first (alerts need it).

const DISMISSED_KEY = "sees:alerts-prompt-dismissed-at";
const DISMISS_FOR_MS = 3 * 24 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 12_000;
const SHOW_ON_EXACT = ["/", "/fantasy", "/fantasy/points", "/fantasy/rules"];
const SHOW_ON_SECTIONS = ["/matches", "/sports"];

const showsOn = (p: string) => SHOW_ON_EXACT.includes(p) || SHOW_ON_SECTIONS.some((s) => p === s || p.startsWith(`${s}/`));

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return Number.isFinite(at) && Date.now() - at < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

export function AlertsPrompt() {
  const pathname = usePathname();
  const { support, on, busy, set } = useMatchAlerts();
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(false);

  const eligible = support === "ok" && on === false && typeof Notification !== "undefined" && Notification.permission === "default";

  useEffect(() => {
    if (!eligible || recentlyDismissed() || promptSlotTaken()) return;
    const t = window.setTimeout(() => {
      if (takePromptSlot("alerts")) setReady(true);
    }, SHOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [eligible]);

  const open = ready && !closed && on === false && showsOn(pathname);

  function notNow() {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Hiding for this visit is enough.
    }
    setClosed(true);
  }

  async function turnOn() {
    const ok = await set(true);
    if (ok) setClosed(true);
    // Said no in the browser's own dialog: don't ask again soon.
    else if (typeof Notification !== "undefined" && Notification.permission === "denied") setClosed(true);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="alerts"
          initial={{ y: "110%", opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: "110%", opacity: 0, scale: 0.96, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center p-3 lg:bottom-0 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <Card role="region" aria-label="Turn on match alerts" className="pointer-events-auto w-full max-w-md shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BellRing className="size-5 text-primary" aria-hidden /> Never miss a goal
              </CardTitle>
              <CardDescription>Turn on match alerts for kick-offs, goals and results. You can switch them off any time in More.</CardDescription>
              <CardAction>
                <Button variant="ghost" size="icon" aria-label="Close" onClick={notNow}>
                  <X />
                </Button>
              </CardAction>
            </CardHeader>
            <CardFooter className="justify-end gap-2 py-3">
              <Button variant="ghost" onClick={notNow}>
                Not now
              </Button>
              <Button onClick={() => void turnOn()} disabled={busy}>
                <BellRing data-icon="inline-start" />
                Turn on alerts
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
