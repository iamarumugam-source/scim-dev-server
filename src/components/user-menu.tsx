"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, MoreHorizontal, Monitor, Globe } from "lucide-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
  "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300",
];

function avatarColor(str: string): string {
  const hash = Array.from(str).reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function formatRelative(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatExpiry(iso: string): string {
  const diff  = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

function envLabel(): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  if (!base || base.includes("localhost") || base.includes("127.0.0.1")) return "Local";
  try { return new URL(base).hostname; } catch { return "Deployed"; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NavUser() {
  const { data: session, status } = useSession();
  const [signedInAt, setSignedInAt] = useState<string | null>(null);

  // Store sign-in time once per browser session
  useEffect(() => {
    if (status !== "authenticated") return;
    const key = "session_signed_in_at";
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, new Date().toISOString());
    }
    setSignedInAt(sessionStorage.getItem(key));
  }, [status]);

  if (status === "loading") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled className="opacity-60 cursor-default">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="grid flex-1 gap-1">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-2.5 w-32 rounded" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (status === "unauthenticated") return null;

  const user    = session?.user;
  const name    = user?.name   ?? "";
  const email   = user?.email  ?? "";
  const userId  = user?.id     ?? "";
  const color   = avatarColor(userId || email || name);
  const env     = envLabel();
  const isLocal = env === "Local";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className={`text-xs font-semibold ${color}`}>
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
              <MoreHorizontal className="ml-auto h-4 w-4 text-muted-foreground flex-shrink-0" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-72" side="top" align="end" sideOffset={6}>

            {/* ── Identity header ──────────────────────────────────────── */}
            <DropdownMenuLabel className="p-0">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarFallback className={`text-sm font-semibold ${color}`}>
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 gap-0.5">
                  <span className="text-sm font-medium truncate">{name}</span>
                  <span className="text-xs text-muted-foreground truncate">{email}</span>
                  {userId && (
                    <span className="text-[10px] text-muted-foreground/60 font-mono truncate">
                      {userId}
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {/* ── Session & identity details ────────────────────────────── */}
            <DropdownMenuLabel className="flex items-center justify-between px-3 py-1 font-normal">
              <span className="text-xs text-muted-foreground">Login method</span>
              <Badge variant="secondary" className="text-[10px] font-normal h-4 px-1.5">
                Okta SSO
              </Badge>
            </DropdownMenuLabel>
            {signedInAt && (
              <DropdownMenuLabel className="flex items-center justify-between px-3 py-1 font-normal">
                <span className="text-xs text-muted-foreground">Signed in</span>
                <span className="text-[11px] text-foreground/80">{formatRelative(signedInAt)}</span>
              </DropdownMenuLabel>
            )}
            {session?.expires && (
              <DropdownMenuLabel className="flex items-center justify-between px-3 py-1 font-normal">
                <span className="text-xs text-muted-foreground">Session expires</span>
                <span className="text-[11px] text-foreground/80">in {formatExpiry(session.expires)}</span>
              </DropdownMenuLabel>
            )}
            <DropdownMenuLabel className="flex items-center justify-between px-3 py-1 font-normal">
              <span className="text-xs text-muted-foreground">Environment</span>
              <Badge
                variant="outline"
                className={`text-[10px] font-normal h-4 px-1.5 gap-1 ${
                  isLocal
                    ? "text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40"
                    : "text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40"
                }`}
              >
                {isLocal ? <Monitor className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                {env}
              </Badge>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {/* ── Sign out ──────────────────────────────────────────────── */}
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2 mt-0.5"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>

          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
