"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronDown, Download, Share, SquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { EARLY_INSTALL_EVENT_KEY } from "./early-install-capture";

// "Install the app", always in the More sheet (the pop-up card can be closed
// for days). On Android and desktop Chrome it opens the browser's own
// install dialog; on iPhone it opens the Add to Home Screen steps. Hidden once
// the app is installed, and where the browser offers no way to install.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const w = () => window as unknown as Record<string, BeforeInstallPromptEvent | undefined>;

function isInstalled() {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}
function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

type Mode = "native" | "ios" | null;

let used = false;
let installed = false;

function subscribe(changed: () => void) {
  const onPrompt = (e: Event) => {
    e.preventDefault();
    w()[EARLY_INSTALL_EVENT_KEY] = e as BeforeInstallPromptEvent;
    used = false;
    changed();
  };
  const onInstalled = () => {
    installed = true;
    changed();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  window.addEventListener("sees:install-used", changed);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
    window.removeEventListener("sees:install-used", changed);
  };
}

function snapshot(): Mode {
  if (installed || isInstalled()) return null;
  if (isIos()) return "ios";
  return !used && w()[EARLY_INSTALL_EVENT_KEY] ? "native" : null;
}

export function InstallRow({ className }: { className?: string }) {
  const mode = useSyncExternalStore(subscribe, snapshot, () => null);
  const [steps, setSteps] = useState(false);

  if (!mode) return null;

  async function install() {
    if (mode === "ios") return setSteps((s) => !s);
    const event = w()[EARLY_INSTALL_EVENT_KEY];
    try {
      await event?.prompt();
      if ((await event?.userChoice)?.outcome === "accepted") installed = true;
    } catch {
      // Already used; the browser will offer a new one on a later visit.
    }
    // The event can only be used once.
    used = true;
    window.dispatchEvent(new Event("sees:install-used"));
  }

  return (
    <div className={cn("rounded-2xl bg-muted", className)}>
      <button type="button" onClick={() => void install()} aria-expanded={mode === "ios" ? steps : undefined} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left">
        <Download className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold">Install the app</span>
          <span className="block text-[0.8125rem] text-muted-foreground">
            {mode === "ios" ? "Add SEES Games to your Home Screen" : "One tap from your home screen, full screen"}
          </span>
        </span>
        {mode === "ios" && <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", steps && "rotate-180")} aria-hidden />}
      </button>
      {mode === "ios" && steps && (
        <ol className="flex flex-col gap-1.5 px-3 pb-3 text-sm">
          <li className="flex items-center gap-1.5">
            1. Tap <strong>Share</strong> <Share className="size-4 text-primary" aria-hidden /> (in Safari)
          </li>
          <li className="flex items-center gap-1.5">
            2. Tap <strong>Add to Home Screen</strong> <SquarePlus className="size-4 text-primary" aria-hidden />
          </li>
          <li>
            3. Tap <strong>Add</strong>, then open SEES Games from your Home Screen
          </li>
        </ol>
      )}
    </div>
  );
}
