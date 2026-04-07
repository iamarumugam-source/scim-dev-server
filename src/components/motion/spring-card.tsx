"use client";

/**
 * SpringCard — wraps any content in a motion.div that springs on hover/tap.
 *
 * Hover:  lifts up + very slight scale-up  (spring stiffness 400 / damping 13 → noticeable overshoot)
 * Tap:    squishes down                     (instant scale-down, spring release)
 *
 * Usage:
 *   <SpringCard>
 *     <Card>…</Card>
 *   </SpringCard>
 *
 * For a subtler effect use the `gentle` prop; for clickable cards also pass
 * `onClick` on the inner Card — the wrapper just handles the animation.
 */

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface SpringCardProps {
  children: React.ReactNode;
  className?: string;
  /** Use a gentler hover lift (2 px instead of 4 px). Default: false. */
  gentle?: boolean;
  /** Disable the hover lift entirely (still keeps the tap squish). */
  noHover?: boolean;
}

const SPRING_HOVER = { type: "spring", stiffness: 400, damping: 13, mass: 0.7 } as const;
const SPRING_TAP   = { type: "spring", stiffness: 500, damping: 20 } as const;

export function SpringCard({ children, className, gentle, noHover }: SpringCardProps) {
  const lift = gentle ? -2 : -4;

  return (
    <motion.div
      className={cn("will-change-transform", className)}
      whileHover={noHover ? undefined : { y: lift, scale: 1.01 }}
      whileTap={{ scale: 0.98, y: 0 }}
      transition={SPRING_HOVER}
    >
      {children}
    </motion.div>
  );
}

/** Pre-wired variant for sidebar / list items — horizontal nudge instead of vertical lift. */
export function SpringItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={cn("will-change-transform", className)}
      whileHover={{ x: 3, scale: 1.01 }}
      whileTap={{ scale: 0.97 }}
      transition={SPRING_HOVER}
    >
      {children}
    </motion.div>
  );
}
