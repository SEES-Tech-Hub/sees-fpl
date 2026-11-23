"use client";

import { useSyncExternalStore } from "react";

// useState that survives a reload: the value lives in localStorage under `key`.
//
// - The server and the first client render use `initial`, then the saved
//   value takes over, so there's never a hydration mismatch.
// - Every hook using the same key stays in sync, in this tab and others.
// - If storage is blocked (private mode, full), it quietly works in memory.
// - Pass `key: null` to turn saving off (for example before the user is known).
// - `validate` cleans a saved value before it's used (drop players who have
//   left, say). Return null to throw the saved value away.
// - `maxAgeMs` forgets values older than that.

const EVENT = "sees:local-storage";
const memory = new Map<string, string | null>();

type Envelope<T> = { v: T; t: number };

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, raw: string | null) {
  memory.set(key, raw);
  try {
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
  } catch {
    // Storage blocked or full: the in-memory copy still works for this visit.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function parse<T>(text: string | null, initial: T, options: Options<T>): T {
  if (text === null) return initial;
  try {
    const env = JSON.parse(text) as Envelope<T>;
    if (options.maxAgeMs !== undefined && Date.now() - env.t > options.maxAgeMs) return initial;
    const value = options.validate ? options.validate(env.v) : env.v;
    return value === null ? initial : value;
  } catch {
    return initial;
  }
}

type Options<T> = { validate?: (value: T) => T | null; maxAgeMs?: number };

export function useLocalStorageState<T>(
  key: string | null,
  initial: T,
  options: Options<T> = {},
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  // The raw string is the snapshot (strings compare by value, so no loops).
  const raw = useSyncExternalStore(
    subscribe,
    () => (key ? read(key) : null),
    () => null,
  );
  const value = parse(raw, initial, options);

  const setValue = (next: T | ((prev: T) => T)) => {
    if (!key) return;
    const prev = parse(read(key), initial, options);
    const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
    write(key, JSON.stringify({ v: resolved, t: Date.now() } satisfies Envelope<T>));
  };

  const clear = () => {
    if (key) write(key, null);
  };

  return [value, setValue, clear];
}

const noop = () => () => {};

/** False on the server and during hydration, true once the browser has taken over. */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
