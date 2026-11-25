"use client";

import { useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { Megaphone, TriangleAlert, X } from "lucide-react";
import { useHydrated } from "@/hooks/use-local-storage-state";
import { cn } from "@/lib/utils";

// The admin's announcement as a strip under the header. It slides down when
// it arrives, the megaphone gives a little shake, and a light sweeps across
// once so people notice it. Dismissing slides it away and is remembered on
// this phone for that announcement only (a new one shows again).

const KEY = "sees:announcement-dismissed";

function readDismissed(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function AnnouncementStrip({
  announcement,
}: {
  announcement: { id: string; message: string; tone?: "info" | "warning" } | null;
}) {
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const hidden = !announcement || dismissed === announcement.id || (hydrated && readDismissed() === announcement.id);
  const warning = announcement?.tone === "warning";
  const Icon = warning ? TriangleAlert : Megaphone;

  function dismiss() {
    if (!announcement) return;
    try {
      localStorage.setItem(KEY, announcement.id);
    } catch {
      // Private browsing: hiding it for this visit is enough.
    }
    setDismissed(announcement.id);
  }

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence initial={true}>
        {hydrated && !hidden && announcement && (
          <motion.div
            key={announcement.id}
            role="status"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "relative flex items-center gap-2 overflow-hidden px-4 py-2 text-sm font-semibold",
                warning ? "bg-highlight text-highlight-foreground" : "bg-pitch text-brand-foreground",
              )}
            >
              {/* One sweep of light across the strip */}
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                initial={{ x: "-120%" }}
                animate={{ x: "420%" }}
                transition={{ duration: 1.4, delay: 0.35, ease: "easeInOut" }}
              />
              <div className="relative mx-auto flex max-w-[1200px] flex-1 items-center gap-2">
                <motion.span
                  className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", warning ? "bg-black/10" : "bg-brand-light text-brand")}
                  initial={{ rotate: 0, scale: 0.6 }}
                  animate={{ rotate: [0, -14, 12, -8, 6, 0], scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.15 }}
                >
                  <Icon className="size-4" aria-hidden />
                </motion.span>
                <motion.span
                  className="min-w-0 flex-1 leading-snug"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  {announcement.message}
                </motion.span>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss announcement"
                className={cn(
                  "relative flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                  warning ? "hover:bg-black/10" : "hover:bg-white/10",
                )}
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
