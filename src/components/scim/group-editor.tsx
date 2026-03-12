"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ScimGroup } from "@/lib/scim/models/scimSchemas";
import { ScimUser } from "@/lib/scim/models/scimSchemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Save, X, Loader2, UserPlus, UserMinus, Search } from "lucide-react";
import { toast } from "sonner";
import { avatarColor } from "@/app/scim/users/columns";

interface Member { value: string; display?: string; $ref?: string; type?: string }

function memberInitials(display?: string): string {
  if (!display) return "?";
  const parts = display.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : display.slice(0, 2).toUpperCase();
}

function Avatar({ name, id }: { name?: string; id: string }) {
  return (
    <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${avatarColor(id)}`}>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {mode === "edit" ? "Editing group — unsaved changes will be lost on cancel." : "Click Edit to modify this group."}
        </span>
        {mode === "view" ? (
          <Button size="sm" variant="outline" onClick={startEdit} className="h-7 text-xs gap-1.5">
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={cancel} disabled={saving} className="h-7 text-xs gap-1.5">
              <X className="h-3 w-3" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving} className="h-7 text-xs gap-1.5">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-1">
            Group Info
          </h4>

          <div className="min-w-0">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">
              Display Name
            </label>
            {mode === "view" ? (
              <p className="text-sm font-medium">{group.displayName}</p>
            ) : (
              <Input
                className="h-7 text-xs"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Engineering Team"
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {[
              ["ID",            group.id],
              ["Schema",        group.schemas?.[0]],
              ["Resource Type", group.meta?.resourceType],
              ["Created",       group.meta?.created ? new Date(group.meta.created).toLocaleString() : undefined],
              ["Last Modified", group.meta?.lastModified ? new Date(group.meta.lastModified).toLocaleString() : undefined],
              ["Version",       group.meta?.version],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-xs font-mono text-foreground truncate">{value || <span className="text-muted-foreground/40">—</span>}</dd>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-1">
            Members ({members.length})
          </h4>

          {mode === "edit" && (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchRef}
                  className="h-7 text-xs pl-7"
                  placeholder={loadingUsers ? "Loading users…" : "Search to add a member…"}
                  value={search}
                  disabled={loadingUsers}
                  onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                />
              </div>
              {showDropdown && filtered.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
                  {filtered.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                      onMouseDown={() => addMember(user)}
                    >
                      <Avatar name={user.name?.formatted || user.displayName} id={user.id} />
                      <div className="min-w-0 text-left">
                        <p className="font-medium truncate">{user.name?.formatted || user.displayName || user.userName}</p>
                        <p className="text-muted-foreground font-mono truncate text-[10px]">{user.userName}</p>
                      </div>
                      <UserPlus className="h-3 w-3 text-muted-foreground ml-auto flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {members.length > 0 ? (
              members.map((member) => (
                <div key={member.value} className="flex items-center gap-2.5 group/member">
                  <Avatar name={member.display} id={member.value} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{member.display || "Unknown"}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{member.value}</p>
                  </div>
                  {member.type && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">{member.type}</Badge>
                  )}
                  {mode === "edit" && (
                    <button
                      type="button"
                      onClick={() => removeMember(member.value)}
                      className="opacity-0 group-hover/member:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
                      title="Remove member"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground/50 font-mono">
                {mode === "edit" ? "No members yet — search above to add some." : "No members in this group."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
