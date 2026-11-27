"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Link2, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

// Share your starting XI: a sheet with the picture (a post or a story, made
// fresh from your saved lineup by /fantasy/xi-image/<format>), then
//   Download image  saves it to the phone;
//   Share…          sends the picture through the phone's share sheet
//                   (a WhatsApp status, an Instagram story); only where the
//                   browser can share files;
//   Copy link       /fantasy, so friends can pick theirs.
// It opens by itself once, right after a new squad is saved (?share=1).

type Format = "post" | "story";

const noop = () => () => {};
const canShareFiles = () => {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [new File([""], "xi.png", { type: "image/png" })] });
  } catch {
    return false;
  }
};

async function fetchImage(format: Format, stamp: number) {
  const res = await fetch(`/fantasy/xi-image/${format}?t=${stamp}`);
  if (!res.ok) throw new Error(String(res.status));
  return new File([await res.blob()], `my-sees-xi-${format}.png`, { type: "image/png" });
}

export function XiShare({ autoOpen = false, matchdayNumber }: { autoOpen?: boolean; matchdayNumber: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [format, setFormat] = useState<Format>("post");
  const [stamp, setStamp] = useState(0);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [copied, setCopied] = useState(false);
  const shareFiles = useSyncExternalStore(noop, canShareFiles, () => false);

  // Opened by ?share=1 after saving a squad: drop it from the address, so a
  // refresh or Back doesn't open the sheet again.
  useEffect(() => {
    if (autoOpen) router.replace("/fantasy/team", { scroll: false });
  }, [autoOpen, router]);

  const src = `/fantasy/xi-image/${format}?t=${stamp}`;
  const invite = () => `${window.location.origin}/fantasy`;

  function openSheet() {
    setStamp(Date.now());
    setOpen(true);
  }

  async function download() {
    setBusy("download");
    try {
      const file = await fetchImage(format, stamp);
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Couldn't make the picture. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    try {
      const file = await fetchImage(format, stamp);
      await navigator.share({ files: [file], text: `My SEES XI for Matchday ${matchdayNumber}. Pick yours: ${invite()}` });
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Couldn't share the picture. Try Download instead.");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite());
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Long-press the address bar instead.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold text-secondary-foreground transition-transform outline-none hover:bg-secondary/80 focus-visible:ring-3 focus-visible:ring-ring active:scale-95"
      >
        <Share2 className="size-4" aria-hidden />
        Share XI
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading text-xl font-bold uppercase">Share your amazing XI</DrawerTitle>
            <DrawerDescription>Your starting XI as a picture for your status or story. Friends pick theirs at the link.</DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-6">
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
              style={{ aspectRatio: format === "post" ? "4 / 5" : "9 / 16", maxHeight: "42vh" }}
            >
              {open && (
                // eslint-disable-next-line @next/next/no-img-element -- a generated PNG, shown as is
                <img
                  key={src}
                  src={src}
                  alt={`Your starting XI as a ${format}`}
                  onLoad={() => setLoaded(src)}
                  className={cn("h-full max-h-[42vh] w-auto rounded-xl object-contain transition-opacity", loaded === src ? "opacity-100" : "opacity-0")}
                />
              )}
              {loaded !== src && <Loader2 className="absolute size-6 animate-spin text-muted-foreground" aria-label="Making the picture" />}
            </div>

            <button
              type="button"
              onClick={download}
              disabled={busy !== null}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-[0.9375rem] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {busy === "download" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
              Download image
            </button>
            {shareFiles && (
              <button
                type="button"
                onClick={share}
                disabled={busy !== null}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary text-[0.9375rem] font-semibold text-secondary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {busy === "share" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
                Share…
              </button>
            )}
            <button
              type="button"
              onClick={copy}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition-colors hover:bg-muted"
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
              Copy invite link
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
