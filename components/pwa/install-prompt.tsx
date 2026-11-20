"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EARLY_INSTALL_EVENT_KEY } from "./early-install-capture";

// Owner: Samuel (PWA). Asks people to install the app to their home screen.
// - Android and desktop Chrome: an Install button that opens the browser's
//   own install dialog (the beforeinstallprompt event).
// - iPhone and iPad: there is no install button on iOS, so the card explains
//   the Share > Add to Home Screen steps, and that push alerts on iPhone only
//   work once the app is on the home screen (iOS 16.4 or later).
// Hidden when the app is already installed, after "Not now" for a week, and
// on pages where it would get in the way.

const DISMISSED_KEY = "sees:install-prompt-dismissed-at";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 4000;
const HIDDEN_ON = ["/console", "/offline"];

// Not in TypeScript's DOM types yet (Chromium only).
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = { kind: "native"; event: BeforeInstallPromptEvent } | { kind: "ios"; inSafari: boolean };

export function InstallPrompt() {
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isInstalled() || recentlyDismissed()) return;

    let timer: number | undefined;

    if (isIos()) {
      timer = window.setTimeout(() => setMode({ kind: "ios", inSafari: isIosSafari() }), SHOW_AFTER_MS);
      return () => window.clearTimeout(timer);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault(); // Keep Chrome's mini-bar away; we show our own card.
      const installEvent = event as BeforeInstallPromptEvent;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMode({ kind: "native", event: installEvent }), SHOW_AFTER_MS);
    };
    const onInstalled = () => setMode(null);

    // The event may have fired before hydration; EarlyInstallCapture kept it.
    const early = (window as unknown as Record<string, Event | undefined>)[EARLY_INSTALL_EVENT_KEY];
    if (early) onBeforeInstall(early);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mode || dismissed || HIDDEN_ON.some((path) => pathname.startsWith(path))) return null;

  function notNow() {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Private browsing can refuse storage; hiding for this visit is enough.
    }
    setDismissed(true);
  }

  async function install() {
    if (mode?.kind !== "native") return;
    await mode.event.prompt();
    const { outcome } = await mode.event.userChoice;
    // The event can only be used once, so hide the card either way.
    if (outcome === "dismissed") notNow();
    else setMode(null);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <Card
        role="region"
        aria-label="Install SEES Games Hub"
        className="pointer-events-auto w-full max-w-md shadow-lg"
      >
        <CardHeader>
          <CardTitle className="text-lg">Add SEES Games to your home screen</CardTitle>
          <CardDescription>
            Open live scores and your fantasy team in one tap, full screen.
          </CardDescription>
          <CardAction>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={notNow}>
              <X />
            </Button>
          </CardAction>
        </CardHeader>

        {mode.kind === "ios" && (
          <CardContent className="flex flex-col gap-3">
            {!mode.inSafari && (
              <p className="text-muted-foreground">
                If you can&apos;t see <strong className="text-foreground">Add to Home Screen</strong>, open
                this page in Safari first.
              </p>
            )}
            <ol className="flex flex-col gap-2">
              <li className="flex items-center gap-2">
                <StepNumber n={1} />
                <span>
                  Tap <strong>Share</strong>
                </span>
                <Share aria-hidden className="size-4 text-primary" />
                <span className="text-muted-foreground">in the toolbar</span>
              </li>
              <li className="flex items-center gap-2">
                <StepNumber n={2} />
                <span>
                  Tap <strong>Add to Home Screen</strong>
                </span>
                <SquarePlus aria-hidden className="size-4 text-primary" />
              </li>
              <li className="flex items-center gap-2">
                <StepNumber n={3} />
                <span>
                  Tap <strong>Add</strong>
                </span>
              </li>
            </ol>
            <p className="rounded-lg bg-secondary px-3 py-2 text-secondary-foreground">
              On iPhone, goal alerts and deadline reminders only work once the app is on your home screen
              (iOS 16.4 or later).
            </p>
          </CardContent>
        )}

        <CardFooter className="justify-end gap-2 py-3">
          <Button variant="ghost" onClick={notNow}>
            Not now
          </Button>
          {mode.kind === "native" && (
            <Button onClick={install}>
              <Download data-icon="inline-start" />
              Install app
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
    >
      {n}
    </span>
  );
}

function isInstalled() {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return Number.isFinite(at) && Date.now() - at < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

function isIos() {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// Chrome, Firefox, Edge, Opera and in-app browsers (WhatsApp, Instagram,
// Facebook) on iOS add their own token to the user agent; Safari doesn't.
function isIosSafari() {
  return !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram|Line\/|WhatsApp/.test(navigator.userAgent);
}
