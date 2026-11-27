// fetch for the server-side Supabase clients: a read (GET or HEAD) that takes
// longer than READ_TIMEOUT_MS is given up, so a stalled Supabase API fails
// the page fast (the error page then retries) instead of hanging for 30–50 s.
// Writes are never cut off: aborting one halfway could leave the user unsure
// whether it saved.

export const READ_TIMEOUT_MS = 10_000;

export const timeoutFetch: typeof fetch = (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if ((method !== "GET" && method !== "HEAD") || init?.signal) return fetch(input, init);
  return fetch(input, { ...init, signal: AbortSignal.timeout(READ_TIMEOUT_MS) });
};
