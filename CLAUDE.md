# SCIM Dev Server — Claude Code Instructions

## Project Overview

A SCIM 2.0 development server and admin dashboard. It simulates a SCIM-compliant identity provider
backend, enabling developers to test Okta (and other IdP) provisioning integrations. Features
include multi-tenant SCIM endpoints, API key management, request logging, analytics, a HAR
analyser, JWE utilities, and an AI-assisted JSON template generator.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack in dev) |
| Language | TypeScript 5 — strict mode |
| Styling | Tailwind CSS v4 |
| UI Components | Shadcn/ui (new-york style, Radix UI primitives, Lucide icons) |
| Database | Supabase (PostgreSQL) — service-role key on server, anon key on client |
| Auth | NextAuth 4 + Okta OAuth 2.0 |
| Validation | Zod + React Hook Form |
| Charts | Recharts |
| Code Editor | CodeMirror |
| Build | Turbopack (`dev`), standard Next.js (`build`) |

## Dev Commands

```bash
npm run dev     # Start dev server (Turbopack, port 3000)
npm run build   # Production build
npm run lint    # ESLint
```

## Key Directories

```
src/
├── app/
│   ├── api/[userId]/scim/v2/   # SCIM 2.0 REST endpoints (multi-tenant)
│   ├── api/auth/               # NextAuth
│   ├── api/ai/                 # AI suggestion endpoints
│   └── scim/                   # Admin dashboard pages
├── components/
│   ├── ui/                     # Shadcn primitives (do not modify directly)
│   ├── scim/                   # Feature-specific components
│   ├── har/                    # HAR analyser components
│   └── jwe/                    # JWE utility components
├── lib/
│   └── scim/
│       ├── db.ts               # Supabase singleton client
│       ├── apiHelper.ts        # protectWithApiKey guard + Okta JWT validation
│       ├── logging.ts          # logExternalRequest utility
│       ├── models/scimSchemas.ts  # SCIM TypeScript types
│       └── services/           # Business logic (UserService, GroupService, etc.)
└── types/next-auth.d.ts        # Session type augmentation
```

## Architecture Patterns

### API Route Convention

Every SCIM API route (`src/app/api/[userId]/scim/v2/`) follows this exact pattern:

```ts
import { protectWithApiKey } from "@/lib/scim/apiHelper";
import { logExternalRequest } from "@/lib/scim/logging";

// Always await params — Next.js 15 requires it
const { userId } = await params;

// Auth guard — returns null (allow) or a 401 NextResponse
const unauthorizedResponse = await protectWithApiKey(request);
if (unauthorizedResponse) {
  return createAndLogResponse(request, errorData, { status: 401 }, userId);
}
```

Use `createAndLogResponse` for all responses so every request is logged:

```ts
function createAndLogResponse(
  request: NextRequest,
  data: unknown,
  options: { status: number },
  userId: string
): NextResponse {
  const response = NextResponse.json(data, options);
  logExternalRequest(request, response, data, userId);
  return response;
}
```

SCIM error shape:
```ts
{ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "...", status: "404" }
```

### Service Convention

Services are classes in `src/lib/scim/services/`. They import the shared `supabase` singleton:

```ts
import { supabase } from "../db";

export class FooService {
  async getFoo(id: string, tenantId: string) {
    const { data, error } = await supabase
      .from("scim_foos")
      .select("resource")
      .eq("id", id)
      .eq("tenantId", tenantId)
      .single();

    if (error?.code === "PGRST116") return null; // not found
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return data?.resource ?? null;
  }
}
```

- Always filter by `tenantId` (the `userId` URL param) to enforce tenant isolation.
- PGRST116 = row not found; 22P02 = invalid UUID — both map to `null`, not an error.
- Store full SCIM resource JSON in a `resource` JSONB column; mirror searchable fields as
  dedicated columns (e.g., `username`, `active`, `tenantId`).

### Multi-Tenant Routing

All SCIM API routes live under `/api/[userId]/scim/v2/`. The `userId` segment is the tenant
identifier. Always pass it through to the service layer.

### Component Convention

- Use Shadcn components from `@/components/ui/` — never re-implement primitives.
- Import path alias: `@/*` resolves to `src/*`.
- Dark mode uses the `class` strategy — use Tailwind `dark:` variants.
- Form state: React Hook Form + Zod schema validation.

### Authentication

`protectWithApiKey` allows requests via any of:
1. Active NextAuth session (admin UI)
2. Bearer API key (hashed, stored in `api_keys` table)
3. Valid Okta JWT (verified against JWKS endpoint)

## Database (Supabase)

- **Server routes**: use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) — already configured in `db.ts`.
- **Client components**: use `NEXT_PUBLIC_SUPABASE_ANON_KEY` (respects RLS).
- RLS is enabled on all tables — new tables must define policies.
- Migrations live in `supabase/migrations/` as plain SQL files.
- Naming: snake_case for tables and columns; UUID primary keys.

## Environment Variables

Required in `.env.local`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# NextAuth
NEXTAUTH_SECRET=
NEXT_PUBLIC_BASE_URL=

# Okta
OKTA_CLIENT_ID=
OKTA_CLIENT_SECRET=
OKTA_ISSUER=

# LLM (AI features)
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
```

## Custom Slash Commands

| Command | Purpose |
|---|---|
| `/new-route` | Scaffold a new SCIM API route |
| `/new-service` | Scaffold a new service class |
| `/new-page` | Scaffold a new admin dashboard page |
| `/db-migration` | Scaffold a Supabase migration file |
