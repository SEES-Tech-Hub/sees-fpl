"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

// Share a match: the phone's own share sheet when there is one (WhatsApp,
// Instagram, X…), otherwise a small sheet with WhatsApp and Copy link. The
// link previews as the match's share card.

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5 fill-current">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}

export function ShareButton({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = () => window.location.href.split("?")[0];

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: url() });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // they closed the sheet
      }
    }
    setOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Long-press the address bar instead.");
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label="Share this match"
        onClick={share}
        className="size-10 rounded-full bg-brand-foreground/10 text-brand-foreground hover:bg-brand-foreground/20 hover:text-brand-foreground"
      >
        <Share2 className="size-5" />
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Share this match</DrawerTitle>
            <DrawerDescription>{text}</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4 pb-6">
            <Button asChild size="lg" className="h-12 gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${typeof window === "undefined" ? "" : url()}`)}`} target="_blank" rel="noreferrer">
                <WhatsAppIcon /> Share on WhatsApp
              </a>
            </Button>
            <Button variant="outline" size="lg" className="h-12 gap-2" onClick={copy}>
              {copied ? <Check className="size-5" /> : <Link2 className="size-5" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
