// Only same-site paths are allowed as a post-sign-in destination, so a crafted
// link can't send someone to another website after they sign in.
export function safeNextPath(next: string | null | undefined, fallback = "/fantasy"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
