import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PreviewAccessService } from "@/lib/scim/services/previewAccessService";

/**
 * Labs / preview access allowlist — governs sidebar visibility of the
 * experimental tools. Non-tenanted: the rows are accounts, not tenant data.
 *
 * Bootstrap: while the allowlist is empty, everyone is "allowed" and anyone may
 * add the first entry — so the feature can be turned on from the UI without an
 * id ever being written into source. Once at least one account is listed, only
 * listed accounts may view or manage it.
 */

async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

/** GET — is the caller allowed, plus the list (list only visible once non-empty). */
export async function GET() {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const svc     = new PreviewAccessService();
  const empty   = await svc.isEmpty();
  const allowed = empty || (await svc.isAllowed(uid));

  return NextResponse.json({
    allowed,
    bootstrap: empty,
    currentUserId: uid,
    // Don't expose the roster to non-members once the gate is live.
    users: allowed ? await svc.list() : [],
  });
}

/** POST { userId?, label? } — grant. Omit userId to add your own account. */
export async function POST(req: NextRequest) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const svc   = new PreviewAccessService();
  const empty = await svc.isEmpty();
  // Bootstrap lets the first person self-add; after that, only members manage.
  if (!empty && !(await svc.isAllowed(uid))) {
    return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  }

  let body: { userId?: string; label?: string } = {};
  try { body = await req.json(); } catch { /* body optional — defaults to self */ }

  const target = (body.userId ?? "").trim() || uid;
  const label  = (body.label ?? "").trim() || null;

  await svc.add(target, label);
  return NextResponse.json({ ok: true, added: target });
}

/** DELETE ?userId= — revoke. Members only (never bootstrap-open). */
export async function DELETE(req: NextRequest) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const svc = new PreviewAccessService();
  if (!(await svc.isAllowed(uid))) {
    return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  }

  const target = new URL(req.url).searchParams.get("userId");
  if (!target) return NextResponse.json({ detail: "userId is required." }, { status: 400 });

  await svc.remove(target);
  return NextResponse.json({ ok: true, removed: target });
}
