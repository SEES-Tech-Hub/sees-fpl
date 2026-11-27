"use client";

import { useEffect, useRef } from "react";

// Pointer motion for the big match cards: only with a mouse or trackpad, and
// never for anyone who asked for less motion. Phones get the scroll and
// entrance motion in app/globals.css instead.

const canMove = () =>
  window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches;

/**
 * Tilts a card a few degrees towards the mouse, like a ticket in the hand, and
 * moves a soft light across it (a `.sees-glare` child follows --gx and --gy).
 */
export function useTilt<T extends HTMLElement>(maxDegrees = 5) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !canMove()) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width;
      const y = (e.clientY - box.top) / box.height;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.dataset.tilting = "";
        el.style.transform = `perspective(1100px) rotateX(${((0.5 - y) * maxDegrees).toFixed(2)}deg) rotateY(${((x - 0.5) * maxDegrees).toFixed(2)}deg)`;
        el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
        el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      });
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      delete el.dataset.tilting;
      el.style.transform = "";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [maxDegrees]);
  return ref;
}

/** Pulls a button a few pixels (at most `reach`) towards the mouse while it's over it. */
export function useMagnetic<T extends HTMLElement>(reach = 6) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !canMove()) return;
    const move = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      // -1 to 1 across the button, so a wide button moves as far as a small one.
      const x = (e.clientX - box.left) / box.width - 0.5;
      const y = (e.clientY - box.top) / box.height - 0.5;
      el.style.translate = `${(x * 2 * reach).toFixed(1)}px ${(y * 2 * reach * 0.6).toFixed(1)}px`;
    };
    const leave = () => {
      el.style.translate = "";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [reach]);
  return ref;
}
