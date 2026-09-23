"use client";

// ─── Group expanded row ───────────────────────────────────────────────────────
//
// Same structure as UserEditor: identity header, full-width detail bands, and
// the raw resource behind a collapsible. Both use the shared primitives in
// detail-bands.tsx so the two cannot drift apart visually.
//
// Not tabs — an expanded row exists to take in a whole resource at a glance.

import { useState, useEffect, useCallback, useRef } from "react";
import { ScimGroup, ScimUser } from "@/lib/scim/models/scimSchemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { JsonViewer } from "@/components/json-viewer";
import {
  Band, Inline, InlineList, LabelText, Muted, CopyValue,
} from "@/components/scim/detail-bands";
import { avatarColor } from "@/components/scim/user-avatar";
import { ResourceTile } from "@/components/scim/resource-tile";
import {
  Pencil, Save, X, Loader2, UserPlus, UserMinus, Search, Boxes, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Member { value: string; display?: string; $ref?: string; type?: string }

function memberInitials(display?: string): string {
  if (!display) return "?";
  const parts = display.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : display.slice(0, 2).toUpperCase();
}

// rounded-md to match UserAvatar — a member here and a user in the list should
// read as the same class of thing. (Named MemberAvatar so it does not shadow the
// shadcn Avatar primitive.)
function MemberAvatar({ name, id }: { name?: string; id: string }) {
  return (
    <div className={cn(
      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-semibold",
      avatarColor(id),
    )}>
      {memberInitials(name)}
    </div>
  );
}

interface Props {
  group: ScimGroup;
  userId: string;
  onUpdate: () => void;
}

export function GroupEditor({ group, userId, onUpdate }: Props) {
  const [mode,         setMode]         = useState<"view" | "edit">("view");
  const [saving,       setSaving]       = useState(false);
  const [displayName,  setDisplayName]  = useState(group.displayName);
  const [members,      setMembers]      = useState<Member[]>([...(group.members || [])]);
  const [search,       setSearch]       = useState("");
  const [allUsers,     setAllUsers]     = useState<ScimUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef                       = useRef<HTMLInputElement>(null);

  const loadUsers = useCallback(async () => {
    if (allUsers.length > 0) return;
    setLoadingUsers(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/Users?startIndex=1&count=100`);
      if (!res.ok) return;
      const data = await res.json();
      setAllUsers(data.Resources || []);
    } finally {
      setLoadingUsers(false);
    }
  }, [userId, allUsers.length]);

  useEffect(() => {
    if (mode === "edit") loadUsers();
  }, [mode, loadUsers]);

  const startEdit = () => {
    setDisplayName(group.displayName);
    setMembers([...(group.members || [])]);
    setSearch("");
    setMode("edit");
  };

  const cancel = () => { setSearch(""); setShowDropdown(false); setMode("view"); };

  const save = async () => {
    if (!displayName.trim()) { toast.error("Display name is required."); return; }
    setSaving(true);
    try {
      const updated = { ...group, displayName: displayName.trim(), members };
      const res = await fetch(`/api/${userId}/scim/v2/Groups/${group.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(updated),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to update group.");
      toast.success("Group updated successfully.");
      onUpdate();
      setMode("view");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeMember = (id: string) =>
    setMembers((p) => p.filter((m) => m.value !== id));

  const addMember = (user: ScimUser) => {
    if (members.some((m) => m.value === user.id)) {
      toast.info(`${user.displayName || user.userName} is already a member.`);
      return;
    }
    setMembers((p) => [
      ...p,
      {
        value:   user.id,
        display: user.name?.formatted || user.displayName || user.userName,
        $ref:    `${window.location.origin}/api/${userId}/scim/v2/Users/${user.id}`,
        type:    "User",
      },
    ]);
    setSearch("");
    setShowDropdown(false);
  };

  const memberIds = new Set(members.map((m) => m.value));
  const filtered  = search.trim().length > 0
    ? allUsers.filter((u) => {
        const q = search.toLowerCase();
        return (
          (u.displayName || "").toLowerCase().includes(q) ||
          u.userName.toLowerCase().includes(q) ||
          (u.name?.formatted || "").toLowerCase().includes(q)
        );
      }).filter((u) => !memberIds.has(u.id)).slice(0, 8)
    : [];

  // In edit mode show the pending member list, so the count never disagrees with
  // the rows beneath it.
  const shownMembers = mode === "edit" ? members : (group.members || []);
  const draft = { ...group, displayName: displayName.trim() || group.displayName, members };

  return (
    <div className="space-y-3">

      {/* ── Identity header ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3.5 py-3">
        <div className="flex min-w-0 items-start gap-3">
          {/* Same hash as the collapsed row, so expanding does not change the
              group's colour out from under you. */}
          <ResourceTile icon={<Boxes className="h-4 w-4" />} hashKey={group.displayName} size="lg" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">
                {mode === "edit" ? (displayName || group.displayName) : group.displayName}
              </p>
              <Badge variant="secondary" className="h-5 tabular-nums text-[10px]">
                {shownMembers.length} member{shownMembers.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <CopyValue value={group.id} />
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {mode === "view" ? (
            <Button size="sm" variant="outline" onClick={startEdit} className="h-7 gap-1.5 text-xs">
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={cancel} disabled={saving} className="h-7 gap-1.5 text-xs">
                <X className="h-3 w-3" /> Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving} className="h-7 gap-1.5 text-xs">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {mode === "edit" && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Unsaved changes are lost on cancel. Saving issues a SCIM{" "}
          <code className="font-mono">PUT</code>, which <strong>replaces the whole
          resource</strong> — the member list is sent as-is, so removals here are
          removals on the server.
        </p>
      )}

      {/* ── Detail bands ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border">

        <Band label="Name" first>
          {mode === "view" ? (
            <p className="text-sm font-medium">{group.displayName}</p>
          ) : (
            <div className="max-w-sm space-y-0.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Display Name <span className="text-destructive">*</span>
              </Label>
              <Input
                className="h-7 text-xs"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Engineering Team"
              />
            </div>
          )}
        </Band>

        <Band label={`Members (${shownMembers.length})`}>
          <div className="space-y-2">
            {mode === "edit" && (
              <div className="relative max-w-sm">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  className="h-7 pl-7 text-xs"
                  placeholder={loadingUsers ? "Loading users…" : "Search to add a member…"}
                  value={search}
                  disabled={loadingUsers}
                  onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                />
                {showDropdown && filtered.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                    {filtered.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors hover:bg-muted"
                        onMouseDown={() => addMember(user)}
                      >
                        <MemberAvatar name={user.name?.formatted || user.displayName} id={user.id} />
                        <div className="min-w-0 text-left">
                          <p className="truncate font-medium">{user.name?.formatted || user.displayName || user.userName}</p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">{user.userName}</p>
                        </div>
                        <UserPlus className="ml-auto h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {shownMembers.length > 0 ? (
              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {shownMembers.map((member) => (
                  <div
                    key={member.value}
                    className="group/member flex items-center gap-2.5 rounded-md border px-2 py-1.5"
                  >
                    <MemberAvatar name={member.display} id={member.value} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{member.display || "Unknown"}</p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">{member.value}</p>
                    </div>
                    {member.type && (
                      <Badge variant="outline" className="h-4 flex-shrink-0 px-1.5 py-0 text-[10px]">
                        {member.type}
                      </Badge>
                    )}
                    {mode === "edit" && (
                      <button
                        type="button"
                        onClick={() => removeMember(member.value)}
                        aria-label={`Remove ${member.display || member.value}`}
                        className="flex-shrink-0 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover/member:opacity-100 focus-visible:opacity-100"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Muted>
                {mode === "edit"
                  ? "No members yet — search above to add some."
                  : "No members in this group."}
              </Muted>
            )}
          </div>
        </Band>

        <Band label="Meta">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <InlineList>
              <Inline label="schema"   value={group.schemas?.[0]} mono />
              <Inline label="type"     value={group.meta?.resourceType} />
              <Inline label="created"  value={group.meta?.created      ? new Date(group.meta.created).toLocaleString()      : undefined} />
              <Inline label="modified" value={group.meta?.lastModified ? new Date(group.meta.lastModified).toLocaleString() : undefined} />
            </InlineList>
            {group.meta?.version && (
              <span className="inline-flex items-baseline gap-1.5">
                <LabelText>etag</LabelText>
                <CopyValue value={group.meta.version} />
              </span>
            )}
            {group.meta?.location && (
              <span className="inline-flex min-w-0 items-baseline gap-1.5">
                <LabelText>location</LabelText>
                <CopyValue value={group.meta.location} className="max-w-[28rem]" />
              </span>
            )}
          </div>
        </Band>

        {/* Raw resource — the only collapsed thing, because it is bulky and
            secondary. In edit mode it shows the DRAFT, so you can read the exact
            body a Save would PUT before committing to it. */}
        <Collapsible>
          <CollapsibleTrigger className="group/json flex w-full items-center gap-2 border-t px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]/json:rotate-90" />
            {mode === "edit" ? "Pending resource (unsaved draft)" : "Raw JSON"}
            <span className="ml-auto font-normal normal-case tracking-normal">
              what the service provider receives
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t p-3">
            <JsonViewer data={mode === "edit" ? draft : group} className="max-h-[340px]" />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
