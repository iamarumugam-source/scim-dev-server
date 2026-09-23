"use client";

// Entitlements and Roles share their entire list AND editor behaviour, so both
// pages are thin wrappers over CatalogList + CatalogEditor. See those components
// for the design notes — in particular why search and sort are client-side (no
// server-side filter on either endpoint).
//
// `type` is the only structural difference between the two resources.

import { BadgeCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { ScimEntitlement } from "@/lib/scim/models/scimSchemas";
import { CatalogList } from "@/components/scim/catalog-list";
import { CatalogEditor } from "@/components/scim/catalog-editor";

export default function EntitlementsPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";

  return (
    <CatalogList<ScimEntitlement>
      resource="Entitlements"
      noun="entitlement"
      nounPlural="entitlements"
      icon={<BadgeCheck className="h-3.5 w-3.5" />}
      hasType
      schema="urn:okta:scim:schemas:core:1.0:Entitlement"
      renderEditor={(entitlement, onUpdate) => (
        <CatalogEditor
          item={entitlement}
          userId={userId}
          resource="Entitlements"
          noun="entitlement"
          icon={<BadgeCheck className="h-4 w-4" />}
          hasType
          onUpdate={onUpdate}
          onDelete={onUpdate}
        />
      )}
    />
  );
}
