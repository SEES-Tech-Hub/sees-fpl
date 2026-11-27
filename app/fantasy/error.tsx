"use client";

import { ErrorScreen } from "@/components/brand/error-screen";

// Inside the fantasy layout (its header and nav stay): the SEES time-out card.
export default function FantasyError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} compact />;
}
