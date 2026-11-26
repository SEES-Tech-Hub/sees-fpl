"use client";

import { useSyncExternalStore } from "react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// Owner: Fortune (design kit). Light and dark mode.
//
// next-themes puts a `dark` class on <html> (globals.css styles dark mode
// with `@custom-variant dark (&:where(.dark, .dark *))`). It starts from the
// device setting and remembers a manual choice from the toggle below.

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

const noopSubscribe = () => () => {};

/** Sun/moon button. Renders a fixed-size placeholder until mounted, so the icon never mismatches. */
export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  // false on the server and during hydration, true afterwards
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const dark = mounted && resolvedTheme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={withLabel ? undefined : label}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {mounted ? (
        dark ? <Sun className="size-[18px]" strokeWidth={1.75} aria-hidden /> : <Moon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      ) : (
        <span className="size-[18px]" aria-hidden />
      )}
      {withLabel && <span>{label}</span>}
    </button>
  );
}
