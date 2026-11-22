"use client";

import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** The league code in big Oswald with Copy and Share (design system §12.9). */
export function CopyCode({ code, leagueName }: { code: string; leagueName: string }) {
  const text = `Join my SEES Fantasy league "${leagueName}" with code ${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Couldn't copy. Press and hold the code instead.");
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: leagueName, text });
        return;
      } catch {
        // Cancelled, or not allowed: fall back to WhatsApp.
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section aria-label="League code" className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card">
      <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">League code</p>
      <p className="font-heading text-[2.75rem] leading-none font-bold tracking-[0.2em] select-all">{code}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" className="h-11 text-[0.9375rem]" onClick={copy}>
          <Copy /> Copy
        </Button>
        <Button size="lg" className="h-11 text-[0.9375rem]" onClick={share}>
          <Share2 /> Share
        </Button>
      </div>
    </section>
  );
}
