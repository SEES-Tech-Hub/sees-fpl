"use client";

import { followedTopics, followTopics, unfollowTopics } from "@/app/push/actions";

// Push notifications in the browser: can this device get them, and turning
// a topic on or off ("all" = every match; "fixture:<id>", "team:<id>").
// Shared by the match bell, the Match alerts switch and the alerts prompt.
// Works without signing in. On iPhone, push only works once the app is on
// the Home Screen (iOS 16.4+).

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type PushSupport = "ok" | "unsupported" | "ios-install" | "dev" | "no-key";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!KEY) return "no-key";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  if (ios && !standalone) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (process.env.NODE_ENV !== "production") return "dev";
  return "ok";
}

/** This browser's push subscription; with `create`, made (and the service worker registered) if missing. */
export async function pushSubscription(create: boolean) {
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (create ? await navigator.serviceWorker.register("/sw.js") : undefined);
  if (!reg) return null;
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing || !create) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) });
}

/** The topics this browser follows ([] when it has no subscription). */
export async function currentTopics(): Promise<string[]> {
  if (pushSupport() !== "ok") return [];
  try {
    const sub = await pushSubscription(false);
    return sub ? await followedTopics(sub.endpoint) : [];
  } catch {
    return [];
  }
}

type Change = { ok: true; topics: string[] } | { ok: false; message: string };

/** Asks for permission if needed, then follows `topic`. */
export async function followTopic(topic: string): Promise<Change> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, message: "Notifications are blocked. Allow them for this site in your browser settings." };
    const sub = await pushSubscription(true);
    if (!sub) return { ok: false, message: "Couldn't turn on notifications on this device." };
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    return await followTopics(json, [topic]);
  } catch {
    return { ok: false, message: "Couldn't turn on notifications on this device." };
  }
}

export async function unfollowTopic(topic: string): Promise<Change> {
  try {
    const sub = await pushSubscription(false);
    if (!sub) return { ok: true, topics: [] };
    return await unfollowTopics(sub.endpoint, [topic]);
  } catch {
    return { ok: false, message: "Couldn't change notifications on this device." };
  }
}
