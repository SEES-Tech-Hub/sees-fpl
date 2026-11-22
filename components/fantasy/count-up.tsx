"use client";

import { useEffect, useState } from "react";

/**
 * Design system §8 points reveal: counts up from 0 once (900 ms, ease-out).
 * Reduced motion: the final number straight away.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value <= 0) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className={className} aria-label={String(value)}>
      <span aria-hidden>{shown}</span>
    </span>
  );
}
