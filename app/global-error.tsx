"use client";

import { ErrorScreen } from "@/components/brand/error-screen";
import "./globals.css";

// When even the root layout fails: the same SEES time-out screen in its own
// document (global-error replaces the layout, so it brings the styles).
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <title>Time out · SEES Games</title>
        <ErrorScreen error={error} retry={retry} />
      </body>
    </html>
  );
}
