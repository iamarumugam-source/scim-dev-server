import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The icon for a non-user SCIM resource — a group, entitlement or role.
 *
 * Deliberately a bare monochrome glyph: no container, no border, no hashed
 * colour. Two earlier attempts were worse. A fixed tinted tile made every row in
 * a list identical, so it was 28px of pure decoration. Hashing the tint off the
 * name did make rows distinguishable, but six hues repeating down a 30-row table
 * reads as noise rather than as information.
 *
 * Colour is now reserved for things where it means something — status, charts,
 * and user avatars, where recognising a person by their colour genuinely helps.
 * A group does not need to be recognisable by hue; its name does that.
 *
 * Kept as a component, trivial as it is, so "how resource icons look" lives in
 * one place. That is what made this change four lines instead of four edits.
 */
export function ResourceIcon({
  icon,
  className,
}: {
  icon: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex flex-shrink-0 items-center justify-center text-muted-foreground", className)}
    >
      {icon}
    </span>
  );
}
