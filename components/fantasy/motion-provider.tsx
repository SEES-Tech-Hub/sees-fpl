"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

/** Turns motion animations off for anyone whose device asks for reduced motion. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
