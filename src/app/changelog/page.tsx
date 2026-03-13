import { ScrollText, Plus, Wrench, Bug, Zap, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChangeType = "new" | "improved" | "fixed" | "breaking" | "security";

interface Change {
  type:  ChangeType;
  text:  string;
}

interface Version {
  version:     string;
  date:        string;
  title:       string;
  description?: string;
  changes:     Change[];
}

// ─── Change-type config ───────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ChangeType, { label: string; icon: React.ElementType; class: string }> = {
  new:      { label: "New",      icon: Plus,    class: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"     },
  improved: { label: "Improved", icon: Zap,     class: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
  fixed:    { label: "Fixed",    icon: Bug,     class: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"  },
  breaking: { label: "Breaking", icon: Wrench,  class: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  security: { label: "Security", icon: Shield,  class: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"     },
};

// ─── Changelog data ───────────────────────────────────────────────────────────

const VERSIONS: Version[] = [
  {
    version: "1.0.0",
    date:    "2026-03-13",
    title:   "AI Features",
    description: "Integrated LiteLLM-compatible LLM proxy for AI-powered analysis directly inside the tools.",
    changes: [
      { type: "new",      text: "HAR Analyser — AI Suggestions panel for OIDC error rows: streams analysis from a local LLM with Okta-specific troubleshooting steps" },
      { type: "new",      text: "HAR Analyser — 'Copy for LLM' button copies the full structured context (endpoint, params, error details) ready to paste into ChatGPT, Gemini, or Claude" },
      { type: "new",      text: "Extensions — AI Template Builder: chat panel (Sheet) powered by LLM to convert sample JSON into {{user.*}} / {{faker.*}} templates with iterative refinement" },
      { type: "new",      text: "New API routes: /api/ai/suggest (streaming OIDC error analysis) and /api/ai/json-template (streaming JSON-to-template conversion)" },
      { type: "new",      text: "LLM configuration via .env.local: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL — compatible with any OpenAI-compatible proxy (LiteLLM, Ollama, etc.)" },
      { type: "improved", text: "AI prompts include structured URL params, form-body params, and parsed Okta error fields for specific (non-generic) responses" },
    ],
  },
  {
    version: "0.10.0",
    date:    "2026-03-12",
    title:   "Schema Extensions",
    description: "Full SCIM schema extension builder — add arbitrary attributes to user responses on the fly without modifying stored data.",
    changes: [
      { type: "new",      text: "Schema Extensions page: create named extension schemas (URN-based), toggle per tenant, define fields" },
      { type: "new",      text: "Four field source types: User Property (dot-path), Random (Faker.js generator), Static value, Raw JSON (complex objects / arrays)" },
      { type: "new",      text: "Template interpolation engine: {{user.*}} and {{faker.*}} expressions inside Raw JSON string values, resolved per-request" },
      { type: "new",      text: "Spread mode: empty-named Raw JSON field with an object value merges its keys directly into the extension root" },
      { type: "new",      text: "Reference card: full table of user properties with descriptions, Faker generator categories with expressions, and link to fakerjs.dev docs" },
      { type: "new",      text: "Enable/disable Switch per extension — uses shadcn Switch with proper ARIA role, keyboard support, and in-flight guard preventing race conditions" },
      { type: "improved", text: "Extension config cached for 30 s server-side; cache invalidated on every write — zero overhead on normal user responses" },
      { type: "improved", text: "Broken into individual components: constants.ts, raw-json-editor.tsx, field-row.tsx, extension-card.tsx, reference-card.tsx" },
    ],
  },
  {
    version: "0.9.0",
    date:    "2026-03-11",
    title:   "Design System & Brand",
    description: "Okta brand colors, icon refresh, dark mode fixes, and component-level style consistency pass.",
    changes: [
      { type: "improved", text: "Primary color updated to Okta brand blue (#1662DD → oklch(0.54 0.20 268)) across buttons, links, active states, and focus rings" },
      { type: "fixed",    text: "Dark mode: --primary-foreground was set to a dark navy value causing unreadable text on primary buttons — corrected to near-white" },
      { type: "fixed",    text: "Dark mode: Okta SVG logo now uses dark:invert so it renders white in dark mode" },
      { type: "improved", text: "Sidebar icons refreshed: LayoutDashboard, Webhook (API), Layers (Groups), ScrollText (Logs), Puzzle (Extensions), Activity (HAR), LockKeyhole (JWE)" },
      { type: "improved", text: "Theme toggle replaced with flat ghost icon button (Moon/Sun via resolvedTheme) — no border, hover-only highlight" },
      { type: "improved", text: "GitHub header link matches theme toggle style — icon-only, flat, hover highlight" },
      { type: "improved", text: "User menu: colored avatar (deterministic from user ID), MoreHorizontal icon, userId shown in dropdown, redirects to /login on sign-out" },
      { type: "improved", text: "Generate Mock button uses bg-primary with correct dark mode handling; Reset button uses destructive hover style" },
      { type: "improved", text: "All copy buttons across the app trigger toast.success('Copied to clipboard') consistently" },
    ],
  },
  {
    version: "0.8.0",
    date:    "2026-03-10",
    title:   "JWE Decoder Improvements",
    description: "Full rewrite of the JWE/JWT decoder to support all key types Okta uses.",
    changes: [
      { type: "improved", text: "Auto-detects JWE (5 parts) vs JWT (3 parts) — JWTs decode without a key" },
      { type: "new",      text: "Key type support: RSA private (RSA-OAEP), EC private (ECDH-ES), symmetric (dir+AES), and JWKS (tries each key automatically)" },
      { type: "new",      text: "Output tabs: JWE Header, JWT Header / Claims, Raw — all rendered with JsonViewer" },
      { type: "new",      text: "Token type badge (JWE / JWT) with algorithm info displayed in output header" },
      { type: "improved", text: "Proper jose.importJWK() usage — old code passed raw JWK objects directly which only worked by accident for some key types" },
      { type: "improved", text: "UI redesigned to match current design patterns — header bars with icons, no messy className overrides" },
    ],
  },
  {
    version: "0.7.0",
    date:    "2026-03-09",
    title:   "HAR Analyser",
    description: "Brand new network traffic analysis tool inspired by Chrome DevTools, with Okta-specific intelligence.",
    changes: [
      { type: "new",      text: "HAR file upload with drag-and-drop; parses Chrome DevTools .har exports" },
      { type: "new",      text: "Chrome DevTools-style network table: method (colored text), status (colored text), URL, type, size, time, waterfall" },
      { type: "new",      text: "OIDC endpoint detection: 20+ Okta patterns (authorize, token, userinfo, JWKS, IDX…) highlighted with phase badges" },
      { type: "new",      text: "Okta request header detection (x-okta-*): rows highlighted with indigo badge" },
      { type: "new",      text: "Bottom detail drawer: Headers, URL Params (OIDC only), Preview, Response, Timing tabs; resizable with drag handle" },
      { type: "new",      text: "URL Params tab: annotates every OIDC parameter with plain-English descriptions; decode button for base64url values (state, request, id_token)" },
      { type: "new",      text: "Splunk tab: fetches /.well-known/okta-organization to get org cell, builds index=\"{cell}*\" \"{requestId}\" query with copy button" },
      { type: "new",      text: "Filter bar with URL search and type pills (All / Fetch/XHR / Doc / CSS / JS / Font / Img / OIDC)" },
      { type: "new",      text: "Waterfall column with proportional timing bars (TTFB + download)" },
      { type: "new",      text: "Status bar showing request count, bytes transferred, total load time" },
    ],
  },
  {
    version: "0.6.0",
    date:    "2026-03-08",
    title:   "OAuth Integration",
    description: "Full OAuth 2.0 authorization code middleware so Okta SCIM provisioning can authenticate via your Okta org.",
    changes: [
      { type: "new",      text: "GET /api/[userId]/oauth2/authorize — Phase 1: proxies to Okta auth server with relay-state encoding; Phase 2: relays code back to SCIM client" },
      { type: "new",      text: "POST /api/[userId]/oauth2/token — exchanges authorization code with Okta using OKTA_SIGNING_CLIENT/SECRET, returns real access token" },
      { type: "fixed",    text: "Previous implementation used redirect() from next/navigation (wrong in route handlers) and had hardcoded Vercel URLs" },
      { type: "improved", text: "State parameter encodes both redirect_uri AND client state as base64url JSON to survive the round-trip through Okta" },
      { type: "new",      text: "apiHelper: Okta JWT validation — Bearer tokens are now verified against Okta's JWKS; chain is session → stored API key → Okta JWT → 401" },
      { type: "improved", text: "API page redesigned: SCIM endpoint at top, OAuth endpoint cards (method badge + URL in one row), accordion for setup steps" },
    ],
  },
  {
    version: "0.5.0",
    date:    "2026-03-07",
    title:   "Logs & API Keys",
    description: "Log viewer improvements and a unified API configuration page.",
    changes: [
      { type: "improved", text: "Log viewer: lazy loading (20/page), load-more button, refresh, skeleton loading rows, expandable request/response with JsonViewer" },
      { type: "improved", text: "Log viewer: method and status shown as plain colored text (blue/green/amber/red) matching HAR analyser style — no Badge components" },
      { type: "improved", text: "Log viewer: column headers use uppercase tracking-wide pattern consistent with other tables" },
      { type: "new",      text: "API page: SCIM endpoint card at top (Server icon, teal), two OAuth endpoint cards (Zap / KeyRound icons with method badge + copyable URL)" },
      { type: "new",      text: "API page: Client credentials info card, accordion for Okta setup steps (shadcn Accordion)" },
      { type: "improved", text: "API keys table: Generate New Key button moved next to table header; key rows have colored KeyRound avatar, prefix badge, formatted dates" },
      { type: "fixed",    text: "API keys: revoke now uses toast confirmation (action/cancel) instead of browser confirm()" },
    ],
  },
  {
    version: "0.4.0",
    date:    "2026-03-06",
    title:   "SCIM Management Improvements",
    description: "Inline editing for users and groups, richer table displays, and better mock data generation.",
    changes: [
      { type: "improved", text: "Users table: colored initials avatar, username + UUID row, title below name, status with CheckCircle2/XCircle icons, group count badge" },
      { type: "new",      text: "Users: expandable row inline editor — edit displayName, name parts, title, locale, timezone, active toggle, primary email; saves via PUT" },
      { type: "improved", text: "Groups table: Group ID column, Users icon, member count badge, Last Modified column, hover-expand row" },
      { type: "new",      text: "Groups: inline member management — search box loads up to 100 users, autocomplete dropdown, hover-to-remove per member; saves via PUT" },
      { type: "improved", text: "Group enable/disable now syncs bidirectionally: adding/removing a member updates the user's groups[] array and vice versa" },
      { type: "improved", text: "Generate Mock: department-based group names, realistic user profiles (title, userType, locale, timezone), guaranteed group membership for every new user" },
      { type: "improved", text: "DataTable: expandable rows via renderExpandedRow prop, page info 'Showing X–Y of Z', ChevronLeft/Right pagination icons" },
    ],
  },
  {
    version: "0.3.0",
    date:    "2026-03-05",
    title:   "Dashboard & Analytics",
    description: "New dashboard with live tenant statistics, API health metrics, and page view tracking.",
    changes: [
      { type: "new",      text: "Dashboard: Total Users, Total Groups, Total API Calls, Active API Keys stat cards with icon avatars" },
      { type: "new",      text: "Dashboard: API health section — success rate gauge, method breakdown bars, user active/inactive split" },
      { type: "new",      text: "Dashboard: 7-day call volume chart (proportional bar chart using divs, no external library)" },
      { type: "new",      text: "Dashboard: Top 5 endpoints by call count with relative bars; last 5 failed requests with status badge, path, and timestamp" },
      { type: "new",      text: "GET /api/[userId]/scim/v2/stats endpoint aggregates logs, users, groups, API keys, and page views in a single parallel query" },
      { type: "new",      text: "POST /api/[userId]/analytics: page view tracking stored in scim_analytics table; usePageTracking() hook added to all SCIM pages" },
      { type: "new",      text: "Dashboard: Quick Access grid linking to Users, Groups, API, Logs" },
    ],
  },
  {
    version: "0.2.0",
    date:    "2026-03-04",
    title:   "Navigation & Routing",
    description: "Full routing restructure, new tools, and a much more coherent sidebar layout.",
    changes: [
      { type: "new",      text: "SCIM pages moved to /scim/* routes (Dashboard, API Keys, Users, Groups, Logs); old paths redirect" },
      { type: "new",      text: "Home page (/) redesigned as a tools overview with SCIM Tool, HAR Analyser, JWE Decoder cards" },
      { type: "new",      text: "Sidebar: SCIM Tool collapsible (shows sub-pages when on /scim/*), Tools section with HAR Analyser and JWE Decoder" },
      { type: "new",      text: "Sidebar: SCIM icon navigates to /scim in collapsed mode; chevron toggle is a separate SidebarMenuAction" },
      { type: "improved", text: "Sidebar collapse state persisted via sidebar_state cookie — no re-expansion on navigation" },
      { type: "new",      text: "HAR Analyser page added (client-only, no auth required)" },
      { type: "improved", text: "Login page: custom branded card with Okta logo, error code mapping, no sidebar" },
      { type: "fixed",    text: "Middleware: static assets (.svg, .png, images) excluded from auth to fix Okta logo not loading on login page" },
    ],
  },
  {
    version: "0.1.0",
    date:    "2026-03-01",
    title:   "Initial Release",
    description: "Foundation: SCIM 2.0 server with Okta OIDC authentication, basic user and group management.",
    changes: [
      { type: "new", text: "SCIM 2.0 API: Users (GET, POST, PUT, DELETE) and Groups (GET, POST, PUT, PATCH, DELETE)" },
      { type: "new", text: "OAuth2 SCIM protection: session-based (NextAuth) and API key bearer token authentication" },
      { type: "new", text: "Multi-tenant architecture: all data scoped by userId from the authenticated session" },
      { type: "new", text: "NextAuth v4 with Okta OIDC provider; JWT session strategy" },
      { type: "new", text: "Supabase (PostgreSQL) backend: scim_users, scim_groups, scim_logs, api_keys tables" },
      { type: "new", text: "Request logging: all external SCIM calls logged with request + response data" },
      { type: "new", text: "Mock data generator: configurable user/group counts with Faker.js, delete-existing option" },
      { type: "new", text: "JWE decoder: paste private JWK + encrypted token to decrypt and inspect claims" },
    ],
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function ChangeItem({ change }: { change: Change }) {
  const { label, icon: Icon, class: cls } = TYPE_CONFIG[change.type];
  return (
    <li className="flex items-start gap-2.5 py-1">
      <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 mt-0.5", cls)}>
        <Icon className="h-2.5 w-2.5" />
        {label}
      </span>
      <span className="text-sm text-foreground/80 leading-relaxed">{change.text}</span>
    </li>
  );
}

function VersionBlock({ v, isLatest }: { v: Version; isLatest: boolean }) {
  return (
    <div className="relative pl-8">
      {/* Timeline dot */}
      <div className={cn(
        "absolute left-0 top-[18px] h-3 w-3 rounded-full border-2 border-background ring-2",
        isLatest ? "bg-primary ring-primary/30" : "bg-muted-foreground/40 ring-muted-foreground/10",
      )} />
      {/* Timeline line */}
      <div className="absolute left-[5px] top-[30px] bottom-0 w-px bg-border/60" />

      <div className="rounded-lg border border-border bg-card overflow-hidden mb-6">
        {/* Version header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={cn(
              "text-sm font-bold font-mono px-2 py-0.5 rounded border",
              isLatest
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-muted text-muted-foreground border-border",
            )}>
              v{v.version}
            </span>
            <h2 className="text-base font-semibold">{v.title}</h2>
            {isLatest && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                Latest
              </span>
            )}
          </div>
          <time className="text-xs text-muted-foreground tabular-nums flex-shrink-0 mt-0.5">
            {new Date(v.date).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}
          </time>
        </div>

        {/* Description */}
        {v.description && (
          <p className="px-5 pt-3 pb-0 text-sm text-muted-foreground">{v.description}</p>
        )}

        {/* Changes */}
        <ul className="px-5 py-3 space-y-0.5">
          {v.changes.map((c, i) => <ChangeItem key={i} change={c} />)}
        </ul>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChangelogPage() {
  return (
    <div className="container mx-auto py-10 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <ScrollText className="h-4 w-4 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Changelog</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          A running log of all significant changes, features, and fixes to the Okta Admin Tools.
        </p>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mt-4">
          {(Object.entries(TYPE_CONFIG) as [ChangeType, (typeof TYPE_CONFIG)[ChangeType]][]).map(([, cfg]) => (
            <span key={cfg.label} className={cn("flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold", cfg.class)}>
              <cfg.icon className="h-2.5 w-2.5" />
              {cfg.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        {VERSIONS.map((v, i) => (
          <VersionBlock key={v.version} v={v} isLatest={i === 0} />
        ))}
      </div>
    </div>
  );
}
