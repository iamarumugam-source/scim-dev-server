"use client";

// Thin wrapper over CatalogList + CatalogEditor — see the Entitlements page and
// those components for the shared design notes. Roles have no `type` field,
// which is the only structural difference between the two resources.

import { Crown } from "lucide-react";
import { useSession } from "next-auth/react";
import { ScimRole } from "@/lib/scim/models/scimSchemas";
import { CatalogList } from "@/components/scim/catalog-list";
import { CatalogEditor } from "@/components/scim/catalog-editor";

export default function RolesPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";

  return (
    <CatalogList<ScimRole>
      resource="Roles"
      noun="role"
      nounPlural="roles"
      icon={<Crown className="h-3.5 w-3.5" />}
      schema="urn:okta:scim:schemas:core:1.0:Role"
      renderEditor={(role, onUpdate) => (
        <CatalogEditor
          item={role}
          userId={userId}
          resource="Roles"
          noun="role"
          icon={<Crown className="h-4 w-4" />}
          onUpdate={onUpdate}
          onDelete={onUpdate}
        />
      )}
    />
  );
}
