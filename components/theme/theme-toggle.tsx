"use client";

import { useSyncExternalStore } from "react";
import { Moon, Smartphone, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { ThemeChoice } from "./theme-provider";

// True only in the browser after hydration. The saved theme is unknown on the
// server, so anything that shows the current choice waits for this.
const useMounted = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

/**
 * One tap between light and dark. Shows the moon in light mode and the sun in
 * dark mode; which one shows is decided by CSS (the `dark` class), so the
 * server and the browser render the same button.
 *
 * Switching to the theme the device is already using saves "system" rather
 * than that theme, so the app goes back to following the device. Laptops have
 * no Appearance picker, so this is how they get back to automatic.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, systemTheme, setTheme } = useTheme();
  const toggle = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next === systemTheme ? "system" : next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark mode"
      title="Light or dark mode"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
        className,
      )}
    >
      <Moon aria-hidden className="size-[18px] motion-safe:animate-in motion-safe:spin-in-45 motion-safe:fade-in dark:hidden" />
      <Sun aria-hidden className="hidden size-[18px] motion-safe:animate-in motion-safe:spin-in-90 motion-safe:fade-in dark:block" />
    </button>
  );
}

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Phone", icon: Smartphone },
];

/** Light, dark or the phone's own setting (the default), as three segments (the More sheet). */
export function ThemePicker({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <div role="group" aria-label="Appearance" className={cn("grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const on = mounted && (theme ?? "system") === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on && "bg-card text-foreground shadow-card",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
