import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Oswald } from "next/font/google";
import { EarlyInstallCapture } from "@/components/pwa/early-install-capture";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "SEES Games Hub", template: "%s · SEES Games Hub" },
  description: "Live scores, results and fantasy football for SEES Games 2026.",
  applicationName: "SEES Games Hub",
  appleWebApp: { capable: true, title: "SEES Games", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#013f31",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full antialiased", inter.variable, oswald.variable)}>
      <body className="flex min-h-full flex-col font-sans">
        <EarlyInstallCapture />
        <TooltipProvider>{children}</TooltipProvider>
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
