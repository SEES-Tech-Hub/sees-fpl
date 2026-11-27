"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Light and dark mode (next-themes). The choice is saved on the device under
// "sees-theme" and applied before the first paint, so pages never flash the
// wrong colours. Everyone starts on the light theme; "system" follows the
// phone's own setting. Dark styles live under the `dark` class on <html>
// (app/globals.css), which also sets color-scheme: next-themes is told not to,
// because its inline "light" would replace "only light", which stops phone
// browsers forcing their own dark version onto the light theme.

export const THEMES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEMES)[number];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      storageKey="sees-theme"
      defaultTheme="light"
      enableSystem
      enableColorScheme={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
