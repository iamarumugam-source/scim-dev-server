"use client";

import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, MoreHorizontal } from "lucide-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";

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

export default function NavUser() {
  const { data: session, status } = useSession();

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

  const user   = session?.user;
  const name   = user?.name ?? "";
  const email  = user?.email ?? "";
  const userId = user?.id ?? "";
  const color  = avatarColor(userId || email || name);

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

          <DropdownMenuContent className="w-64" side="top" align="end" sideOffset={6}>
            <DropdownMenuLabel className="p-0">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarFallback className={`text-sm font-semibold ${color}`}>
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0">
                  <span className="text-sm font-medium truncate">{name}</span>
                  <span className="text-xs text-muted-foreground truncate">{email}</span>
                  {userId && (
                    <span className="text-[10px] text-muted-foreground/60 font-mono truncate mt-0.5">
                      {userId}
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
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
