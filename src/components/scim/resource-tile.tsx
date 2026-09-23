import type { ReactNode } from "react";
import { avatarColor } from "@/components/scim/user-avatar";
import { cn } from "@/lib/utils";

/**
 * A row tile for non-user SCIM resources — groups, entitlements, roles.
 *
 * The icon says what KIND of thing this is; the tint is hashed off the name, so
 * it also says WHICH one. Previously every row in a list carried an identical
 * static tile, which meant 28px of pure decoration: it could not help you tell
 * two groups apart or re-find one while scrolling.
 *
 * Reuses avatarColor, so this shares the exact 6-hue palette the user avatars
 * use rather than introducing a second one. Same input always yields the same
 * hue, which is what makes a row re-findable.
 */
export function ResourceTile({
  icon,
  hashKey,
  size = "sm",
  className,
}: {
  icon: ReactNode;
  /** Stable string to hash the tint from — normally the resource's displayName. */
  hashKey: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const dims = size === "lg" ? "h-9 w-9" : "h-7 w-7";
  return (
    <span
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-md",
        dims,
        avatarColor(hashKey || "?"),
        className,
      )}
    >
      {icon}
    </span>
  );
}
