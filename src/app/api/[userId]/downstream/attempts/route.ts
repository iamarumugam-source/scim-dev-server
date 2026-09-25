import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { DownstreamOidcService } from "@/lib/scim/services/downstreamOidcService";
import { UserService } from "@/lib/scim/services/userService";

interface RouteParams { params: Promise<{ userId: string }> }

/**
 * Login attempt results.
 *
 * Session-gated: the attempt id in the callback's redirect is a UUID, but it is
 * not a capability on its own — reading a row requires a session for the owning
 * tenant. Guessing the UUID is not enough.
 *
 * `?id=` returns one attempt plus the matched SCIM resource so the page can render
 * the comparison; without it, the most recent attempts.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { id?: string }).id !== userId) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const id  = new URL(req.url).searchParams.get("id");
  const svc = new DownstreamOidcService();

  try {
    if (!id) {
      return NextResponse.json({ attempts: await svc.listAttempts(userId, 10) });
    }

    const attempt = await svc.getAttempt(userId, id);
    if (!attempt) return NextResponse.json({ detail: "Attempt not found." }, { status: 404 });

    // Fetch the matched user fresh rather than snapshotting it at callback time:
    // if the record changed since (say the operator deactivated them to test the
    // deny path), the comparison should reflect what is true now.
    let scimUser = null;
    if (attempt.matchedScimUserId) {
      try { scimUser = await new UserService().getUserById(attempt.matchedScimUserId); }
      catch { /* comparison degrades to "no SCIM match" */ }
    }

    return NextResponse.json({ attempt, scimUser });
  } catch (err) {
    return NextResponse.json({ detail: (err as Error).message }, { status: 500 });
  }
}
