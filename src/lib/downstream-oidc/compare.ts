import type { ScimUser } from "@/lib/scim/models/scimSchemas";

// Pure comparison logic, kept out of the page so it is testable and cannot drift
// as the UI changes.

export type RowStatus = "match" | "differs" | "oidc-only" | "scim-only";

export interface ComparisonRow {
  claim:      string;
  scimPath:   string;
  oidcValue:  string | null;
  scimValue:  string | null;
  status:     RowStatus;
  note?:      string;
}

export interface Finding {
  outcome: "pass" | "warn" | "fail";
  title:   string;
  detail:  string;
}

export interface Comparison {
  rows:      ComparisonRow[];
  findings:  Finding[];
  matchedBy: "externalId" | "userName" | "email" | null;
}

function primaryEmail(u: ScimUser): string | null {
  return u.emails?.find((e) => e.primary)?.value ?? u.emails?.[0]?.value ?? null;
}

function norm(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function compareOidcToScim(
  claims: Record<string, unknown>,
  scim: ScimUser | null,
): Comparison {
  const findings: Finding[] = [];

  // How the record was matched — itself diagnostic. Matching only on email while
  // externalId differs is an identity-linking hazard worth surfacing.
  let matchedBy: Comparison["matchedBy"] = null;
  if (scim) {
    const sub = norm(claims.sub);
    if (sub && norm(scim.externalId) && norm(scim.externalId) === sub) matchedBy = "externalId";
    else if (norm(claims.preferred_username) &&
             norm(claims.preferred_username)?.toLowerCase() === norm(scim.userName)?.toLowerCase()) matchedBy = "userName";
    else matchedBy = "email";
  }

  const rows: ComparisonRow[] = [];
  const row = (
    claim: string, scimPath: string,
    oidc: string | null, scimVal: string | null,
    opts?: { ci?: boolean; note?: string },
  ) => {
    let status: RowStatus;
    if (oidc != null && scimVal != null) {
      const eq = opts?.ci
        ? oidc.toLowerCase() === scimVal.toLowerCase()
        : oidc === scimVal;
      status = eq ? "match" : "differs";
    } else if (oidc != null) status = "oidc-only";
    else status = "scim-only";
    rows.push({ claim, scimPath, oidcValue: oidc, scimValue: scimVal, status, note: opts?.note });
  };

  if (scim) {
    row("sub", "externalId", norm(claims.sub), norm(scim.externalId),
        { note: scim.externalId ? undefined : "SCIM record has no externalId — Okta's identifier was not stored" });
    row("preferred_username", "userName", norm(claims.preferred_username), norm(scim.userName), { ci: true });
    row("email", "emails[primary]", norm(claims.email), primaryEmail(scim), { ci: true });
    row("given_name", "name.givenName", norm(claims.given_name), norm(scim.name?.givenName));
    row("family_name", "name.familyName", norm(claims.family_name), norm(scim.name?.familyName));
    row("name", "displayName", norm(claims.name), norm(scim.displayName ?? scim.name?.formatted));
    row("zoneinfo", "timezone", norm(claims.zoneinfo), norm(scim.timezone));
    row("locale", "locale", norm(claims.locale), norm(scim.locale));

    // ── Findings ────────────────────────────────────────────────────────────
    // The headline: the IdP authenticated a user that provisioning says is off.
    if (scim.active === false) {
      findings.push({
        outcome: "fail",
        title:   "OIDC login succeeded, but SCIM says this user is inactive",
        detail:  "Okta authenticated them; only the downstream app's own gate stands between a "
               + "deprovisioned user and a session. An app that trusts login alone would let them in.",
      });
    }
    if (matchedBy === "email" && norm(scim.externalId) && norm(scim.externalId) !== norm(claims.sub)) {
      findings.push({
        outcome: "warn",
        title:   "Matched by email, but externalId does not equal the OIDC sub",
        detail:  "The OIDC identity and the SCIM record may be two records for one person — an "
               + "identity-linking hazard if the app keys on sub.",
      });
    }
    const emailRow = rows.find((r) => r.claim === "email");
    if (emailRow?.status === "differs") {
      findings.push({
        outcome: "warn",
        title:   "Email in the token differs from the provisioned email",
        detail:  "Account-takeover-shaped if the downstream app keys sessions on email.",
      });
    }
    const unameRow = rows.find((r) => r.claim === "preferred_username");
    if (unameRow?.status === "differs") {
      findings.push({
        outcome: "warn",
        title:   "Username mapping differs between the OIDC app and SCIM",
        detail:  "preferred_username does not match SCIM userName — the OIDC app and the SCIM app "
               + "in Okta are mapping the username from different attributes.",
      });
    }
    if (!findings.some((f) => f.outcome === "fail")) {
      findings.unshift({
        outcome: "pass",
        title:   "Login maps cleanly to an active provisioned user",
        detail:  `Matched by ${matchedBy}. The app can establish a session.`,
      });
    }
  } else {
    findings.push({
      outcome: "fail",
      title:   "No SCIM user matched this login",
      detail:  "The user authenticated through Okta but was never provisioned here (or was "
             + "deprovisioned). A downstream app would JIT-create them or fail.",
    });
    row("sub", "externalId", norm(claims.sub), null);
    row("preferred_username", "userName", norm(claims.preferred_username), null);
    row("email", "emails[primary]", norm(claims.email), null);
  }

  return { rows, findings, matchedBy };
}
