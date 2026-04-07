"use client";

/**
 * FloatIcon — makes any icon (or small element) float up and down continuously.
 *
 * Great for empty-state illustrations.  Uses a yoyo keyframe animation so the
 * motion is smooth and continuous without layout shifts.
 *
 * Usage:
 *   <FloatIcon>
 *     <Lock className="h-8 w-8 text-muted-foreground/40" />
 *   </FloatIcon>
 *
 * Props:
 *   amplitude — how many pixels to travel (default: 8)
 *   speed     — full cycle duration in seconds (default: 2.8)
 *   delay     — initial delay before the animation starts (default: 0)
 */

import { motion } from "motion/react";

interface FloatIconProps {
  children: React.ReactNode;
  amplitude?: number;
  speed?: number;
  delay?: number;
  className?: string;
}

export function FloatIcon({
  children,
  amplitude = 8,
  speed = 2.8,
  delay = 0,
  className,
}: FloatIconProps) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -amplitude, 0] }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * PulseIcon — subtle scale pulse; good for "live" indicators.
 */
export function PulseIcon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      animate={{ scale: [1, 1.08, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
