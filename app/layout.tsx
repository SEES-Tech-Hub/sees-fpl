import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Oswald } from "next/font/google";
import { EarlyInstallCapture } from "@/components/pwa/early-install-capture";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/shell/AppShell";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"] });

export const metadata: Metadata = {
  // Share cards need absolute URLs: the live domain in production, the
  // Vercel URL on previews, localhost in dev.
  metadataBase: siteUrl(),
  title: { default: "SEES Games Hub", template: "%s · SEES Games Hub" },
  description: "Live scores, results and fantasy football for SEES Games 2026.",
  applicationName: "SEES Games Hub",
  appleWebApp: { capable: true, title: "SEES Games", statusBarStyle: "default" },
  // Favicon and Apple icon: app/icon.tsx and app/apple-icon.tsx (the SEES emblem).
};

export const viewport: Viewport = {
  themeColor: "#013f31",
  // Light theme only, and stop phone browsers (Chrome's auto-dark, Samsung
  // Internet) from forcing their own dark version onto the pages.
  colorScheme: "only light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full antialiased", inter.variable, oswald.variable)}>
      <body className="flex min-h-full flex-col font-sans">
        <EarlyInstallCapture />
        <TooltipProvider>
          <AppShell>{children}</AppShell>
        </TooltipProvider>
        <Toaster />
        <ServiceWorkerRegister />

        {/* InstallPrompt reads the pathname, which suspends on dynamic routes. */}
        <Suspense fallback={null}>
          <InstallPrompt />
        </Suspense>
      </body>
    </html>
  );
}

/**
 * The site's base URL for share cards. Accepts NEXT_PUBLIC_SITE_URL with or
 * without https://, and never throws: an empty or broken value falls back to
 * the Vercel deployment URL, then localhost.
 */
function siteUrl(): URL {
  const candidates = [process.env.NEXT_PUBLIC_SITE_URL, process.env.VERCEL_URL, "http://localhost:3000"];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      return new URL(/^https?:\/\//.test(value) ? value : `https://${value}`);
    } catch {
      // Try the next one.
    }
  }
  return new URL("http://localhost:3000");
}
