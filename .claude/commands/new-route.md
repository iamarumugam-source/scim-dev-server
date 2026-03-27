Scaffold a new SCIM API route for this project.

The user will describe what resource or endpoint they want (e.g. "a route for /Widgets under the tenant namespace").

Steps:
1. Determine the correct file path under `src/app/api/[userId]/scim/v2/` following the existing naming conventions (PascalCase resource folders, `[id]/route.ts` for single-resource routes).
2. Create the route file using the established pattern:
   - Import and use `protectWithApiKey` from `@/lib/scim/apiHelper` as the auth guard.
   - Define a local `createAndLogResponse` helper that calls `logExternalRequest` from `@/lib/scim/logging`.
   - Always `await params` before destructuring `userId` (Next.js 15 requirement).
   - Return SCIM-compliant error shapes: `{ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "...", status: "4xx" }`.
   - Implement only the HTTP methods requested (GET list, GET by id, POST, PUT, PATCH, DELETE).
3. If a service class is needed and doesn't exist yet, note that `/new-service` should be run next.
4. Do not add methods or error cases beyond what was requested.

Ask the user: what is the resource name, which HTTP methods are needed, and does a corresponding service already exist?
