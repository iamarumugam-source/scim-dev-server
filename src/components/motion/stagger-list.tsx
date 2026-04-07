"use client";

/**
 * StaggerList / StaggerItem — spring-staggered list entrance.
 *
 * Each child pops in with a springy bounce, offset by `stagger` seconds
 * from the previous sibling.
 *
 * Usage:
 *   <StaggerList>
 *     {items.map((item) => (
 *       <StaggerItem key={item.id}>
 *         <Card>…</Card>
 *       </StaggerItem>
 *     ))}
 *   </StaggerList>
 *
 * All animation is purely CSS-transform — no layout shift.
 */

import { motion } from "motion/react";

// ─── Variants ────────────────────────────────────────────────────────────────

const listVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren:  0.07,
      delayChildren:    0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.95 },
  show:   {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type:      "spring",
      stiffness: 380,
      damping:   13,
      mass:      0.7,
    },
  },
};

// ─── Components ──────────────────────────────────────────────────────────────

export function StaggerList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={listVariants}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

// ─── Convenience: grid variant with tighter stagger ──────────────────────────

const gridListVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.05,
      delayChildren:   0.02,
    },
  },
};

const gridItemVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 12 },
  show:   {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type:      "spring",
      stiffness: 450,
      damping:   15,
      mass:      0.6,
    },
  },
};

export function StaggerGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={gridListVariants} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function StaggerGridItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={gridItemVariants}>
      {children}
    </motion.div>
  );
}
