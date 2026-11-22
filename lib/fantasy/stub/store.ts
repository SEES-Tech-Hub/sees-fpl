import "server-only";
// STUB: the whole file goes once Mary's tables exist.
//
// Until then a manager's team lives in one cookie, so the Vercel preview can
// be clicked through end to end (sign up, pick a squad, set a lineup, transfer,
// join leagues). It holds ids only; everything else is looked up.

import { cookies } from "next/headers";

const COOKIE = "sees-fantasy-stub";

export type StubLeague = { id: string; name: string; code: string; owner: boolean };

export type StubState = {
  v: 1;
  uid: string;
  manager?: { teamName: string; yearGroup: number | null; createdAt: string };
  /** 15 player ids in slot order: index 0 = slot 1. */
  squad?: string[];
  captain?: string;
  vice?: string;
  /** Transfers for the matchday number `md`. */
  transfers?: { md: number; made: number; cost: number };
  wildcardMd?: number;
  leagues?: StubLeague[];
};

export async function readStub(uid: string): Promise<StubState> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StubState;
      if (parsed.v === 1 && parsed.uid === uid) return parsed;
    } catch {
      // Ignore a broken cookie and start again.
    }
  }
  return { v: 1, uid };
}

/** Only callable from Server Actions (cookies are read-only while rendering). */
export async function writeStub(state: StubState) {
  (await cookies()).set(COOKIE, JSON.stringify(state), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
}

/** Small deterministic hash, so fake numbers stay the same on every load. */
export function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
