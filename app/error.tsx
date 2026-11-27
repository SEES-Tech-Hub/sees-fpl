"use client";

import { ErrorScreen } from "@/components/brand/error-screen";

// Any page that fails to load: the SEES time-out screen (it retries once by itself).
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
