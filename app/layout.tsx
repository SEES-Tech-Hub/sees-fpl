import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { preload } from "react-dom";
import { AnalyticsTracker } from "@/components/analytics/tracker";
import { EarlyInstallCapture } from "@/components/pwa/early-install-capture";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";
import { SITE_DESCRIPTION } from "@/lib/seo";

// Fonts are self-hosted (app/fonts.css, public/fonts), so neither the dev
// server nor a build needs Google Fonts. Every page uses Inter and Oswald, so
// their Latin files are preloaded; Playfair Display loads only where used.
const PRELOAD_FONTS = ["/fonts/inter-normal-latin.woff2", "/fonts/oswald-normal-latin.woff2"];

export const metadata: Metadata = {
  // Share cards need absolute URLs: the live domain in production, the
  // Vercel URL on previews, localhost in dev.
  metadataBase: siteUrl(),
  title: { default: "SEES Games 2026: live scores, tables and SEES Fantasy", template: "%s · SEES Games Hub" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "SEES Games Hub", locale: "en_NG", url: "/", description: SITE_DESCRIPTION },
  twitter: { card: "summary_large_image" },
  keywords: ["SEES Games", "SEES UNILAG", "University of Lagos", "live scores", "fantasy football", "SEES Fantasy", "inter-year games"],
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
  for (const href of PRELOAD_FONTS) preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang="en" className="h-full antialiased">
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
        {/* Reads the pathname too. First-party page views and "online now" (Admin → Analytics). */}
        <Suspense fallback={null}>
          <AnalyticsTracker />
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
