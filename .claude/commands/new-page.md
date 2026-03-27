Scaffold a new admin dashboard page for this project.

The user will describe what page they want (e.g. "a Widgets management page").

Steps:
1. Create the page file at `src/app/scim/<resource>/page.tsx` (or another path if the user specifies).
2. Follow the conventions of existing dashboard pages:
   - `"use client"` directive at the top (most dashboard pages are client components).
   - Import Shadcn UI components from `@/components/ui/` — use `Card`, `Button`, `Table`, `Dialog`, `Input`, `Badge`, etc. as appropriate.
   - Use `@/components/ui/table` for data tables; avoid third-party table libraries unless already used in the project.
   - For forms use React Hook Form with a Zod schema.
   - Fetch data via `fetch` calls to the corresponding `/api/[userId]/scim/v2/` routes, using the session `userId`.
   - Use Lucide icons from `lucide-react`.
   - Support dark mode via Tailwind `dark:` variants — do not hard-code light-mode colours.
   - Mirror the layout of existing pages (`src/app/scim/users/page.tsx` is a good reference).
3. If dedicated sub-components are warranted, create them under `src/components/scim/<resource>/`.
4. Do not add features or state beyond what was described.

Ask the user: what is the page title, what data does it display, and what actions (create / edit / delete) should it support?
