// fetch for the server-side Supabase clients.
//
// - A read (GET or HEAD) that takes longer than READ_TIMEOUT_MS is given up,
//   so a stalled Supabase API fails the page fast (the error page then
//   retries) instead of hanging for 30-50 s.
// - A read that fails with a transient database error is tried again, up to
//   READ_RETRIES times: 25P02 (the API's connection was left in a broken
//   transaction, seen at launch), 57014 (statement timeout) and 503s. Each
//   retry usually lands on a healthy connection.
// Writes are never cut off or repeated: that could leave the user unsure
// whether it saved, or save it twice.

export const READ_TIMEOUT_MS = 10_000;
const READ_RETRIES = 2;
const TRANSIENT = new Set(["25P02", "57014"]);

async function transient(res: Response) {
  if (res.status === 503 || res.status === 504) return true;
  if (res.status < 500) return false;
  try {
    const body = (await res.clone().json()) as { code?: string };
    return body.code !== undefined && TRANSIENT.has(body.code);
  } catch {
    return false;
  }
}

export const timeoutFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if ((method !== "GET" && method !== "HEAD") || init?.signal) return fetch(input, init);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(input, { ...init, signal: AbortSignal.timeout(READ_TIMEOUT_MS) });
    if (attempt >= READ_RETRIES || !(await transient(res))) return res;
    await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
  }
};
