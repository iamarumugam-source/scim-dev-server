"use client";

/**
 * SpringNumber — animates a number from 0 to `value` using a spring.
 * Replaces plain <span>{n}</span> in stat cards with a smooth count-up
 * that overshoots slightly before settling (the "jumpy" feel).
 *
 * Usage:
 *   <SpringNumber value={stats.users.total} />
 *   <SpringNumber value={stats.calls.total} format={(n) => n.toLocaleString()} />
 */

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring, motion, useTransform } from "motion/react";

interface SpringNumberProps {
  value: number;
  /** Format the number before display. Default: `String`. */
  format?: (n: number) => string;
  className?: string;
  /** Spring stiffness — higher = snappier (default 120). */
  stiffness?: number;
  /** Spring damping — lower = bouncier (default 14). */
  damping?: number;
}

export function SpringNumber({
  value,
  format = String,
  className,
  stiffness = 120,
  damping = 14,
}: SpringNumberProps) {
  const motionValue = useMotionValue(0);
  const spring      = useSpring(motionValue, { stiffness, damping, mass: 0.8 });
  const display     = useTransform(spring, (v) => format(Math.round(v)));

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  return <motion.span className={className}>{display}</motion.span>;
}

/**
 * SpringPercent — same thing but clamps 0–100 and appends "%".
 */
export function SpringPercent({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <SpringNumber
      value={Math.min(100, Math.max(0, value))}
      format={(n) => `${n}%`}
      className={className}
      stiffness={100}
      damping={12}
    />
  );
}
