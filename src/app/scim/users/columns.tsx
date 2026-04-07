"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ScimUser } from "@/lib/scim/models/scimSchemas";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Mail, Copy, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { UserEditor } from "@/components/scim/user-editor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// ─── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
];

export function avatarColor(str: string) {
  const hash = Array.from(str).reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function userInitials(user: ScimUser) {
  const name = user.displayName || user.name?.formatted || user.userName;
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ─── Expanded row ──────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-xs font-mono text-foreground truncate" title={value ?? undefined}>
        {value || <span className="text-muted-foreground/50">—</span>}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-1">
        {title}
      </h4>
      {children}
    </div>
  );
}

export function UserExpandedRow({
  user,
  userId,
  onUpdate,
}: {
  user: ScimUser;
  userId: string;
  onUpdate: () => void;
}) {
  return <UserEditor user={user} userId={userId} onUpdate={onUpdate} />;
}

// ─── Column definitions ────────────────────────────────────────────────────────

interface GetColumnsProps {
  handleDeleteUser: (userId: string) => void;
}

export const getColumns = ({ handleDeleteUser }: GetColumnsProps): ColumnDef<ScimUser>[] => [
  {
    id: "user",
    header: "User",
    cell: ({ row }) => {
      const user = row.original;
      const initials = userInitials(user);
      const color    = avatarColor(user.userName);
      return (
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${color}`}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.userName}</p>
            <p className="text-[11px] text-muted-foreground font-mono truncate">{user.id}</p>
          </div>
        </div>
      );
    },
  },
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="min-w-0">
          <p className="text-sm truncate">{user.name?.formatted || user.displayName || "—"}</p>
          {user.title && (
            <p className="text-[11px] text-muted-foreground truncate">{user.title}</p>
          )}
        </div>
      );
    },
  },
  {
    id: "email",
    header: "Email",
    cell: ({ row }) => {
      const primary = row.original.emails?.find((e) => e.primary);
      if (!primary) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-sm truncate">{primary.value}</span>
          {primary.type && (
            <span className="text-[10px] text-muted-foreground flex-shrink-0">({primary.type})</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "active",
    header: "Status",
    cell: ({ row }) => {
      const active = row.getValue<boolean>("active");
      return active ? (
        <Badge variant="outline" className="gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700/50">
          <CheckCircle2 className="h-3 w-3" />
          Active
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 text-xs font-normal text-muted-foreground dark:border-white/15">
          <XCircle className="h-3 w-3" />
          Inactive
        </Badge>
      );
    },
  },
  {
    id: "groups",
    header: "Groups",
    cell: ({ row }) => {
      const count = row.original.groups?.length ?? 0;
      return count > 0 ? (
        <Badge variant="secondary" className="tabular-nums">{count}</Badge>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(user.id);
                toast.success("User ID copied.");
              }}
            >
              <Copy className="h-4 w-4 mr-2" /> Copy user ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteUser(user.id);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete user
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
