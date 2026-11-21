import type { Metadata, Viewport } from "next";
import { Inter, Oswald } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/shell/AppShell";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "SEES Games Hub", template: "%s · SEES Games Hub" },
  description: "Live scores, results and fantasy football for SEES Games 2026.",
  applicationName: "SEES Games Hub",
  appleWebApp: { capable: true, title: "SEES Games", statusBarStyle: "default" },
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
        <TooltipProvider>
          <AppShell>{children}</AppShell>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
