"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Download, Link2, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { SHARE_CARD_LABEL, type ShareCard, type ShareFormat } from "@/lib/live/match-share";
import { cn } from "@/lib/utils";

// Share a match: a picture made for this moment (the poster before
// kick-off, the live score, the latest goal, the result in the sport's own
// look, the player of the match; lib/live/match-share.ts picks which), as a
// post or a story, to download or send through the phone's share sheet.
// The link (which previews as the match card) goes on WhatsApp or the
// clipboard as before.

const noop = () => () => {};
const canShareFiles = () => {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [new File([""], "m.png", { type: "image/png" })] });
  } catch {
    return false;
  }
};

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5 fill-current">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}

export function MatchShare({
  fixtureId,
  cards,
  stamp,
  title,
  text,
}: {
  fixtureId: string;
  /** The pictures this match can share now, best first. */
  cards: ShareCard[];
  /** Changes when the match does (a goal, full time), so the picture is fresh. */
  stamp: string;
  title: string;
  text: string;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<ShareCard | null>(null);
  const [format, setFormat] = useState<ShareFormat>("post");
  const [loaded, setLoaded] = useState<string | null>(null);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [copied, setCopied] = useState(false);
  const shareFiles = useSyncExternalStore(noop, canShareFiles, () => false);

  // The picked card, or the best one when that isn't available any more.
  const card = picked && cards.includes(picked) ? picked : (cards[0] ?? null);
  const src = card ? `/matches/${fixtureId}/share-image/${format}?card=${card}&v=${encodeURIComponent(stamp)}` : null;
  const link = () => window.location.href.split("?")[0];

  async function file() {
    const res = await fetch(src!);
    if (!res.ok) throw new Error(String(res.status));
    return new File([await res.blob()], `sees-games-${card}-${format}.png`, { type: "image/png" });
  }

  async function download() {
    setBusy("download");
    try {
      const f = await file();
      const url = URL.createObjectURL(f);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Couldn't make the picture. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function sharePicture() {
    setBusy("share");
    try {
      await navigator.share({ files: [await file()], text: `${text} ${link()}` });
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Couldn't share the picture. Try Download instead.");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
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
        onClick={() => setOpen(true)}
        className="size-10 rounded-full bg-brand-foreground/10 text-brand-foreground hover:bg-brand-foreground/20 hover:text-brand-foreground"
      >
        <Share2 className="size-5" />
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading text-xl font-bold uppercase">Share this match</DrawerTitle>
            <DrawerDescription>{card ? "A picture for your status or story, made for this moment." : title}</DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-6">
            {card && src && (
              <>
                {cards.length > 1 && (
                  <div role="radiogroup" aria-label="Picture" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
                    {cards.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={card === c}
                        onClick={() => setPicked(c)}
                        className={cn(
                          "h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
                          card === c ? "border-transparent bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted",
                        )}
                      >
                        {SHARE_CARD_LABEL[c]}
                      </button>
                    ))}
                  </div>
                )}
                <div role="radiogroup" aria-label="Picture shape" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                  {(["post", "story"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      role="radio"
                      aria-checked={format === f}
                      onClick={() => setFormat(f)}
                      className={cn(
                        "h-10 rounded-lg text-sm font-semibold transition-colors",
                        format === f ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {f === "post" ? "Post" : "Story"}
                    </button>
                  ))}
                </div>
                <div
                  className="relative mx-auto flex w-full items-center justify-center rounded-xl bg-muted"
                  style={{ aspectRatio: format === "post" ? "4 / 5" : "9 / 16", maxHeight: "40vh" }}
                >
                  {open && (
                    // eslint-disable-next-line @next/next/no-img-element -- a generated PNG, shown as is
                    <img
                      key={src}
                      src={src}
                      alt={`${SHARE_CARD_LABEL[card]} picture`}
                      onLoad={() => setLoaded(src)}
                      className={cn("h-full max-h-[40vh] w-auto rounded-xl object-contain transition-opacity", loaded === src ? "opacity-100" : "opacity-0")}
                    />
                  )}
                  {loaded !== src && <Loader2 className="absolute size-6 animate-spin text-muted-foreground" aria-label="Making the picture" />}
                </div>
                <Button size="lg" className="h-12 gap-2 text-[0.9375rem]" onClick={download} disabled={busy !== null}>
                  {busy === "download" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                  Download image
                </Button>
                {shareFiles && (
                  <Button size="lg" variant="secondary" className="h-12 gap-2 text-[0.9375rem]" onClick={sharePicture} disabled={busy !== null}>
                    {busy === "share" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
                    Share picture…
                  </Button>
                )}
              </>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="lg" className="h-11 gap-2">
                <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${typeof window === "undefined" ? "" : link()}`)}`} target="_blank" rel="noreferrer">
                  <WhatsAppIcon /> WhatsApp
                </a>
              </Button>
              <Button variant="outline" size="lg" className="h-11 gap-2" onClick={copy}>
                {copied ? <Check className="size-5" /> : <Link2 className="size-5" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
