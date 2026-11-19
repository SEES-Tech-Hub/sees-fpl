"use client";

import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyCode({ code, leagueName }: { code: string; leagueName: string }) {
  const text = `Join my SEES Fantasy league "${leagueName}" with code ${code}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Couldn't copy. Long-press the code instead.");
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">League code</p>
        <p className="font-mono text-2xl font-semibold tracking-widest select-all">{code}</p>
      </div>
      <Button variant="outline" size="icon-lg" className="size-11" onClick={copy} aria-label="Copy code">
        <Copy />
      </Button>
      <Button asChild variant="outline" size="icon-lg" className="size-11">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on WhatsApp"
        >
          <Share2 />
        </a>
      </Button>
    </div>
  );
}
