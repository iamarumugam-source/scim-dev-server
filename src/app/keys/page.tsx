"use client";

import ApiKeyManager from "@/components/ApiKeyManager";
import { Toaster } from "sonner";

export default function ApiKeysPage() {
  return (
    <>
      <Toaster richColors position="top-right" />
      {/* <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4"></div> */}
      <div className="max-w-8xl m-20">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-bold">API Key Management</h1>
            <p className="text-muted-foreground">
              Generate and manage API keys for external systems.
            </p>
          </div>
        </div>
        <ApiKeyManager />
      </div>
    </>
  );
}
