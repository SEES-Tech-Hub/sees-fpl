"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { visitId } from "@/lib/device-id";

// First-party analytics for Admin → Analytics: a page view on each page, and
// (the "online now" heartbeat is switched off for now; see below).
// The visit id is random and stays on this device; no cookies, no third
// parties, no IP addresses. Admin pages aren't counted. See the privacy page.
// The visit id lives in lib/device-id.ts.

function device(): "phone" | "tablet" | "computer" {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (!coarse) return "computer";
  return Math.min(window.screen.width, window.screen.height) >= 600 ? "tablet" : "phone";
}

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Where a visitor came from, as a short name ("whatsapp", "google"), or null for inside the app. */
function referrer(): string | null {
  if (!document.referrer) return null;
  try {
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    if (host === window.location.hostname) return null;
    if (/whatsapp/.test(host)) return "whatsapp";
    if (/google\./.test(host)) return "google";
    if (/(^|\.)(t\.co|twitter\.com|x\.com)$/.test(host)) return "x";
    if (/instagram/.test(host)) return "instagram";
    if (/facebook|fb\.com/.test(host)) return "facebook";
    return host.slice(0, 60);
  } catch {
    return null;
  }
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const first = useRef(true);

  // A page view on every page (the first one carries the referrer).
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const ref = first.current ? referrer() : null;
    first.current = false;
    createClient()
      .rpc("track_page_view", {
        p_session: visitId(),
        p_path: pathname,
        ...(ref ? { p_referrer: ref } : {}),
        p_device: device(),
        p_standalone: standalone(),
      })
      .then(
        () => {},
        () => {},
      );
  }, [pathname]);

  // The once-a-minute "still here" heartbeat ("online now") is off: on the
  // free Supabase plan its writes used up the disk budget during the games.
  // To bring it back, call track_heartbeat once a minute while visible.

  return null;
}
