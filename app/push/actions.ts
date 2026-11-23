"use server";

import { createClient } from "@/lib/supabase/server";

// Saving this browser's push subscription. Anyone may follow matches; no
// sign-in needed. The database functions only touch this browser's own row.

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };
type Result = { ok: true; topics: string[] } | { ok: false; message: string };

const message = (raw: string | undefined) =>
  raw?.includes(":") ? raw.slice(raw.indexOf(":") + 1).trim() : "Couldn't update notifications. Try again.";

export async function followTopics(sub: Sub, topics: string[]): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("push_subscribe", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.keys.p256dh,
    p_auth: sub.keys.auth,
    p_topics: topics,
  });
  if (error) return { ok: false, message: message(error.message) };
  return { ok: true, topics: data ?? [] };
}

export async function unfollowTopics(endpoint: string, topics: string[]): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("push_unsubscribe", { p_endpoint: endpoint, p_topics: topics });
  if (error) return { ok: false, message: message(error.message) };
  return { ok: true, topics: data ?? [] };
}

export async function followedTopics(endpoint: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("push_topics", { p_endpoint: endpoint });
  return data ?? [];
}
