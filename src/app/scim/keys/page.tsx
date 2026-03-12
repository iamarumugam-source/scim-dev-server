"use client";

import ApiKeyManager from "@/components/ApiKeyManager";

export default function ApiKeysPage() {
  return (
    <div className="container mx-auto py-10 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage bearer tokens used by your identity provider to authenticate SCIM requests.
        </p>
      </div>
      <ApiKeyManager />
    </div>
  );
}
