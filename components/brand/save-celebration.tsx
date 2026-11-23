"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { SeesMark } from "@/components/brand/sees-mark";
import { CircuitPattern } from "@/components/fantasy/patterns";

// A full-screen SEES moment for the big saves (creating a team, saving a
// squad). While the server works it cycles football status lines; on success
// it shows a tick and fires confetti, then hands over (usually a navigation).
// On failure it closes at once so the error shows on the page underneath.
//
// It stays up for at least MIN_MS so it never just flashes. Status lines are
// picked at random from the pool the caller passes; each one shows for
// LINE_VISIBLE_MS, then swipes up and out as the next swipes up in.

const MIN_MS = 1600;
const DONE_MS = 1700;
const LINE_VISIBLE_MS = 800;
const LINE_OUT_S = 0.3;
const LINE_IN_S = 0.35;
const LINE_CYCLE_MS = LINE_VISIBLE_MS + (LINE_OUT_S + LINE_IN_S) * 1000;

/** A random order of the pool, so every save reads a little differently. */
function shuffled<T>(pool: T[]): T[] {
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Done = { title: string; subtitle?: string };
type State = { phase: "idle" } | { phase: "working"; lines: string[] } | { phase: "done"; done: Done };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fireConfetti() {
  const { default: confetti } = await import("canvas-confetti");
  const css = getComputedStyle(document.documentElement);
  const colors = ["--brand-light", "--highlight", "--brand-foreground", "--team-y1", "--team-y5"]
    .map((v) => css.getPropertyValue(v).trim())
    .filter(Boolean);
  const base = { colors, disableForReducedMotion: true, zIndex: 200, ticks: 220, scalar: 1.05 };
  confetti({ ...base, particleCount: 90, spread: 70, startVelocity: 55, origin: { x: 0.15, y: 0.75 }, angle: 60 });
  confetti({ ...base, particleCount: 90, spread: 70, startVelocity: 55, origin: { x: 0.85, y: 0.75 }, angle: 120 });
  setTimeout(() => confetti({ ...base, particleCount: 60, spread: 110, startVelocity: 35, origin: { x: 0.5, y: 0.4 } }), 250);
}

export function useSaveCelebration() {
  const [state, setState] = useState<State>({ phase: "idle" });

  /**
   * Runs `task` behind the overlay. `lines` is a pool of status lines to
   * pick from at random. Resolves with the task's result. On success the
   * overlay stays up through `onSuccess` (for example router.push) so the
   * next screen appears straight from the celebration.
   */
  const run = useCallback(
    async <R extends { ok: boolean }>(
      task: () => Promise<R>,
      options: { lines: string[]; done: Done; onSuccess?: () => void },
    ): Promise<R> => {
      setState({ phase: "working", lines: shuffled(options.lines) });
      const started = Date.now();
      let result: R;
      try {
        result = await task();
      } catch (e) {
        setState({ phase: "idle" });
        throw e;
      }
      await wait(Math.max(0, MIN_MS - (Date.now() - started)));
      if (!result.ok) {
        setState({ phase: "idle" });
        return result;
      }
      setState({ phase: "done", done: options.done });
      void fireConfetti();
      await wait(DONE_MS);
      options.onSuccess?.();
      return result;
    },
    [],
  );

  const overlay = <SaveOverlay state={state} />;
  return { run, overlay, busy: state.phase !== "idle" };
}

function SaveOverlay({ state }: { state: State }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {state.phase !== "idle" && (
        <motion.div
          key="save-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-live="assertive"
          aria-label={state.phase === "done" ? state.done.title : "Saving"}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-pitch px-6 text-center text-brand-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
        >
          <CircuitPattern />
          <div className="relative flex flex-col items-center gap-6">
            <AnimatePresence mode="wait" initial={false}>
              {state.phase === "working" ? (
                <motion.div key="working" exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.18 }}>
                  <SeesMark
                    className="size-20 text-brand-foreground motion-safe:animate-sees-sway"
                    ballClassName="motion-safe:animate-sees-ball"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="done"
                  className="flex size-20 items-center justify-center rounded-full bg-brand-light text-brand"
                  initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18 }}
                >
                  <Check className="size-10" strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>
            {state.phase === "working" ? <CyclingLines lines={state.lines} /> : <DoneText done={state.done} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CyclingLines({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % lines.length), LINE_CYCLE_MS);
    return () => clearInterval(id);
  }, [lines]);
  return (
    <div className="h-14 w-full max-w-xs overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={i}
          className="font-heading text-xl font-semibold"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0, transition: { duration: LINE_IN_S, ease: [0.2, 0.8, 0.2, 1] } }}
          exit={{ opacity: 0, y: -18, transition: { duration: LINE_OUT_S, ease: [0.4, 0, 1, 1] } }}
        >
          {lines[i]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function DoneText({ done }: { done: Done }) {
  return (
    <motion.div
      className="flex h-14 flex-col items-center gap-1"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.25 }}
    >
      <p className="font-heading text-2xl font-bold uppercase">{done.title}</p>
      {done.subtitle && <p className="text-sm text-brand-foreground/80">{done.subtitle}</p>}
    </motion.div>
  );
}
