"use client";

import { useState } from "react";
import { CircleHelp, Lightbulb, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { CONSOLE_HELP, type ConsoleKind } from "@/lib/console/help";

// Help for the match consoles (lib/console/help.ts has the words):
//   ConsoleHelpButton: the "?" in the console header, opening the full guide;
//   ConsoleGuide: a first-time card with the few steps that matter, shown to
//     officials until they tap "Got it" (remembered per console type).

function HelpSheet({ kind, open, onOpenChange }: { kind: ConsoleKind; open: boolean; onOpenChange: (open: boolean) => void }) {
  const help = CONSOLE_HELP[kind];
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-heading text-xl font-bold uppercase">{help.title}</DrawerTitle>
          <DrawerDescription>How this console works. Open it any time from the “?” at the top.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-8">
          {help.sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-2">
              <h3 className="font-heading text-base font-bold uppercase">{section.title}</h3>
              <ul className="flex flex-col gap-2">
                {section.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-sm leading-relaxed">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** The "?" for the console header. Place it top-right in the (positioned) header. */
export function ConsoleHelpButton({ kind, className = "" }: { kind: ConsoleKind; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="How this console works"
        onClick={() => setOpen(true)}
        className={`flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      >
        <CircleHelp className="size-5" aria-hidden />
      </button>
      <HelpSheet kind={kind} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** The first-time card: the steps that matter, until the official taps "Got it". */
export function ConsoleGuide({ kind, show }: { kind: ConsoleKind; show: boolean }) {
  const [seen, setSeen] = useLocalStorageState<boolean>(`sees:console-guide:${kind}`, false);
  const [open, setOpen] = useState(false);
  if (!show || seen) return null;
  const help = CONSOLE_HELP[kind];
  return (
    <section aria-labelledby="console-guide" className="relative flex flex-col gap-3 rounded-xl border border-primary/25 bg-secondary/60 p-4 text-secondary-foreground">
      <button
        type="button"
        aria-label="Hide this guide"
        onClick={() => setSeen(true)}
        className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full hover:bg-secondary"
      >
        <X className="size-4" aria-hidden />
      </button>
      <h2 id="console-guide" className="flex items-center gap-2 pr-8 font-heading text-base font-bold uppercase">
        <Lightbulb className="size-4" aria-hidden /> How it works
      </h2>
      <ol className="flex flex-col gap-2">
        {help.quick.map((step, i) => (
          <li key={step} className="grid grid-cols-[1.5rem_1fr] gap-2 text-sm leading-relaxed">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary font-heading text-xs font-bold text-primary-foreground">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSeen(true)}
          className="h-10 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          Got it
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 flex-1 rounded-lg border border-primary/30 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          Full guide
        </button>
      </div>
      <HelpSheet kind={kind} open={open} onOpenChange={setOpen} />
    </section>
  );
}
