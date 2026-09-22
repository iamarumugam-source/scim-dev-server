"use client";

import { ScimUser } from "@/lib/scim/models/scimSchemas";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// ─── Avatar helpers ───────────────────────────────────────────────────────────
//
// These live here rather than in app/scim/users/columns.tsx because columns.tsx
// imports UserEditor, so anything importing back from it creates a cycle.
//
// Each entry is a Tailwind CLASS STRING, not a colour value — it carries the
// light and dark fill plus a matching text colour, so the pair is always
// contrast-safe together. Passing one of these to style={{ backgroundColor }}
// is silently ignored by the browser; apply it with className.

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
];

/** Stable tint classes for a string — same input always yields the same hue. */
export function avatarColor(str: string) {
  const hash = Array.from(str).reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function userInitials(user: ScimUser) {
  const name = user.displayName || user.name?.formatted || user.userName || "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  // Fall back to "?" rather than throwing on a user with no name at all.
  return (name || "?").slice(0, 2).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────
//
// Rounded square rather than a circle: these are SCIM *resources*, not social
// profiles, and rounded-md matches the radius used by Badge, Card and Input
// everywhere else. The tint is hashed off userName so the same user keeps the
// same colour and becomes re-findable when scanning a long list.

export function UserAvatar({
  user,
  size = "md",
  className,
}: {
  user: ScimUser;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = {
    sm: "size-7 text-[10px]",
    md: "size-8 text-[11px]",
    lg: "size-9 text-xs",
  }[size];

  return (
    <Avatar className={cn("rounded-md", dims, className)}>
      <AvatarFallback
        className={cn(
          "rounded-md font-semibold tracking-tight",
          avatarColor(user.userName || user.id),
        )}
      >
        {userInitials(user)}
      </AvatarFallback>
    </Avatar>
  );
}
