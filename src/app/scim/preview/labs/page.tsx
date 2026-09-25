"use client";

// ─── UNLINKED PREVIEW ─────────────────────────────────────────────────────────
//
// Manages the Labs allowlist — which accounts see the experimental tools in the
// sidebar. Nav-visibility only; it does not protect the preview routes, which
// stay reachable by URL and each operate on the caller's own tenant.
//
// Bootstrap: while the allowlist is empty, anyone can open this and add the first
// account. Once someone is on it, only listed accounts can manage it. The first
// id is read from the live session ("Allow this account"), never typed in.

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  KeyRound, Loader2, UserPlus, Trash2, ShieldAlert, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyValue } from "@/components/scim/detail-bands";
import { VizTokens, Section } from "@/components/scim/dashboard/viz";

interface PreviewUser { userId: string; label: string | null; addedAt: string }
interface AccessResponse {
  allowed: boolean;
  bootstrap: boolean;
  currentUserId: string;
  users: PreviewUser[];
}

export default function LabsAccessPage() {
  const { data: session } = useSession();
  const sessionReady = Boolean(session?.user);

  const [state,   setState]   = useState<AccessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);
  const [newId,   setNewId]   = useState("");
  const [newLabel, setNewLabel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/preview-access");
      if (!res.ok) throw new Error(res.statusText);
      setState(await res.json());
    } catch (e) {
      toast.error(`Could not load access list: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (sessionReady) load(); }, [sessionReady, load]);

  const add = async (body: { userId?: string; label?: string }) => {
    setBusy(true);
    try {
      const res = await fetch("/api/preview-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      toast.success(`Granted access to ${data.added}`);
      setNewId(""); setNewLabel("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/preview-access?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      toast.success(`Revoked ${data.removed}`);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const selfListed = state?.users.some((u) => u.userId === state.currentUserId);

  return (
    <motion.div
      className="viz container mx-auto max-w-3xl space-y-7 py-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <VizTokens />

      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <KeyRound className="text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-200">Labs access</AlertTitle>
        <AlertDescription className="text-amber-800/80 dark:text-amber-300/70">
          Controls who sees the experimental tools in the sidebar. This hides the nav entries;
          it does not lock the routes — each preview page still operates only on the caller&apos;s
          own tenant.
        </AlertDescription>
      </Alert>

      <div>
        <h1 className="text-lg font-semibold tracking-tight">Manage Labs access</h1>
        <p className="text-xs text-muted-foreground">
          Accounts on this list see the Labs group. Others do not.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : !state ? (
        <Muted>Could not load.</Muted>
      ) : (
        <>
          {state.bootstrap && (
            <Alert>
              <ShieldAlert />
              <AlertTitle>Nobody is on the list yet</AlertTitle>
              <AlertDescription>
                While the list is empty, everyone sees Labs. Add your account to lock it down —
                after that, only listed accounts see it or can manage this page.
              </AlertDescription>
            </Alert>
          )}

          <Section title="Your account">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Signed in as</CardTitle>
                <CardDescription>The id is read from your session, not typed in.</CardDescription>
                <CardAction>
                  {selfListed
                    ? <Badge variant="outline" className="gap-1 border-[color:var(--status-good)] text-[color:var(--status-good)]">
                        <CheckCircle2 className="h-3 w-3" /> Allowed
                      </Badge>
                    : null}
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3">
                <CopyValue value={state.currentUserId} className="text-xs" />
                {!selfListed && (
                  <Button size="sm" className="gap-1.5" disabled={busy}
                    onClick={() => add({ label: "me" })}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    Allow this account
                  </Button>
                )}
              </CardContent>
            </Card>
          </Section>

          <Section title="Allowed accounts" hint={`${state.users.length}`}>
            {state.users.length === 0 ? (
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><KeyRound className="h-4 w-4" /></EmptyMedia>
                  <EmptyTitle className="text-sm">No accounts listed</EmptyTitle>
                  <EmptyDescription className="text-xs">Add yours above to begin.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                {state.users.map((u, i) => (
                  <div key={u.userId}
                    className={`flex items-center gap-3 px-3 py-2 ${i > 0 ? "border-t" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs font-medium">{u.userId}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {u.label ? `${u.label} · ` : ""}added {new Date(u.addedAt).toLocaleDateString()}
                        {u.userId === state.currentUserId ? " · you" : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm"
                      className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={busy} onClick={() => remove(u.userId)}>
                      <Trash2 className="h-3 w-3" /> Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {(state.allowed) && (
            <Section title="Add another account">
              <Card>
                <CardContent className="flex flex-wrap items-end gap-2 pt-6">
                  <div className="min-w-[200px] flex-1 space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      User ID
                    </Label>
                    <Input value={newId} onChange={(e) => setNewId(e.target.value)}
                      placeholder="00u…" className="h-8 font-mono text-xs" />
                  </div>
                  <div className="min-w-[120px] space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Label (optional)
                    </Label>
                    <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="teammate" className="h-8 text-xs" />
                  </div>
                  <Button size="sm" className="h-8 gap-1.5" disabled={busy || !newId.trim()}
                    onClick={() => add({ userId: newId.trim(), label: newLabel.trim() })}>
                    <UserPlus className="h-3.5 w-3.5" /> Grant
                  </Button>
                </CardContent>
              </Card>
            </Section>
          )}
        </>
      )}
    </motion.div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
