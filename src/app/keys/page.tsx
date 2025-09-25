"use client";

import ApiKeyManager from "@/components/ApiKeyManager";

export default function ApiKeysPage() {
  return (
    <>
      <div className="container mx-auto py-10">
        <h1 className="text-2xl font-bold mb-4">API Key Management</h1>
        <ApiKeyManager />
      </div>
    </>
  );
}
