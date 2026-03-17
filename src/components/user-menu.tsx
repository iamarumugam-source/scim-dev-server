"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  LogOut,
  ChevronsUpDown,
  Monitor,
  Globe,
  ShieldCheck,
  Clock,
  Timer,
  Server,
  MapPin,
  Search,
  Check,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "./ui/sidebar";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { ALL_TIMEZONES, findTimezone, getUtcOffset } from "@/lib/timezones";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-primary/10 text-primary",
  "bg-muted text-foreground/70",
  "bg-primary/15 text-primary/80",
  "bg-muted/80 text-foreground/60",
  "bg-secondary text-secondary-foreground",
  "bg-primary/20 text-primary/90",
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

// ─── Timezone picker dialog ────────────────────────────────────────────────

function TimezonePicker({
  open,
  current,
  onSelect,
  onClose,
}: {
  open: boolean;
  current: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return ALL_TIMEZONES;
    return ALL_TIMEZONES.filter(
      (tz) =>
        tz.city.toLowerCase().includes(q) ||
        tz.country.toLowerCase().includes(q) ||
        tz.region.toLowerCase().includes(q) ||
        tz.id.toLowerCase().includes(q),
    );
  }, [query]);

  const regions = useMemo(() => [...new Set(filtered.map((z) => z.region))], [filtered]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setQuery(""); } }}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
          <DialogTitle className="text-sm font-semibold">Set your timezone</DialogTitle>
          <DialogDescription className="text-xs">
            This will be used as your default timezone across the app.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              placeholder="Search city or timezone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-72 overflow-y-auto px-2 py-2 space-y-3">
          {regions.map((region) => (
            <div key={region}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1">
                {region}
              </p>
              {filtered.filter((z) => z.region === region).map((tz) => {
                const isSelected = tz.id === current;
                const offset = getUtcOffset(tz.id, new Date());
                return (
                  <button
                    key={tz.id}
                    onClick={() => { onSelect(tz.id); onClose(); setQuery(""); }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                      isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted",
                    )}
                  >
                    <span className="flex-1 font-medium truncate">{tz.city}</span>
                    {tz.country && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">{tz.country}</span>
                    )}
                    <span className="text-xs text-muted-foreground flex-shrink-0 font-mono">{offset}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No timezones found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NavUser() {
  const { data: session, status } = useSession();
  const { isMobile }              = useSidebar();
  const { timezone, setTimezone } = useUserTimezone();
  const [signedInAt, setSignedInAt]     = useState<string | null>(null);
  const [tzDialogOpen, setTzDialogOpen] = useState(false);

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

  const tzInfo   = findTimezone(timezone);
  const tzOffset = getUtcOffset(timezone, new Date());
  const tzLabel  = tzInfo.city !== timezone ? tzInfo.city : timezone;

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className={`text-xs font-semibold ${color}`}>
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground flex-shrink-0" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="min-w-72 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              {/* ── Identity header ── */}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-3 px-2 py-2">
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarFallback className={`text-sm font-semibold ${color}`}>
                        {initials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 gap-0.5">
                      <span className="text-sm font-medium truncate">{name}</span>
                      <span className="text-xs text-muted-foreground truncate">{email}</span>
                      {userId && (
                        <span className="text-[10px] text-muted-foreground/60 font-mono truncate">{userId}</span>
                      )}
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              {/* ── Session details ── */}
              <DropdownMenuGroup>
                <DropdownMenuItem className="pointer-events-none cursor-default">
                  <ShieldCheck className="h-4 w-4" />
                  Login method
                  <Badge variant="secondary" className="ml-auto text-xs font-normal">Okta SSO</Badge>
                </DropdownMenuItem>
                {signedInAt && (
                  <DropdownMenuItem className="pointer-events-none cursor-default">
                    <Clock className="h-4 w-4" />
                    Signed in
                    <span className="ml-auto text-sm">{formatRelative(signedInAt)}</span>
                  </DropdownMenuItem>
                )}
                {session?.expires && (
                  <DropdownMenuItem className="pointer-events-none cursor-default">
                    <Timer className="h-4 w-4" />
                    Session expires
                    <span className="ml-auto text-sm">in {formatExpiry(session.expires)}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="pointer-events-none cursor-default">
                  {isLocal
                    ? <Server className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    : <Globe  className="h-4 w-4 text-green-600 dark:text-green-400" />}
                  Environment
                  <Badge
                    variant="outline"
                    className={`ml-auto text-xs font-normal gap-1 ${
                      isLocal
                        ? "text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40"
                        : "text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40"
                    }`}
                  >
                    {isLocal
                      ? <Monitor className="h-3 w-3 text-amber-700 dark:text-amber-400" />
                      : <Globe   className="h-3 w-3 text-green-600 dark:text-green-400" />}
                    {env}
                  </Badge>
                </DropdownMenuItem>

                {/* ── Timezone (interactive) ── */}
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  onClick={() => setTzDialogOpen(true)}
                  className="cursor-pointer"
                >
                  <MapPin className="h-4 w-4" />
                  Your timezone
                  <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-sm truncate max-w-[120px]">{tzLabel}</span>
                    <Badge variant="secondary" className="text-xs font-mono font-normal">{tzOffset}</Badge>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              {/* ── Sign out ── */}
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Timezone picker — rendered outside DropdownMenu to avoid nesting issues */}
      <TimezonePicker
        open={tzDialogOpen}
        current={timezone}
        onSelect={setTimezone}
        onClose={() => setTzDialogOpen(false)}
      />
    </>
  );
}
