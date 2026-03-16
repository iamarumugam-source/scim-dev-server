"use client";

import { useSession } from "next-auth/react";
import ApiKeyManager from "@/components/ApiKeyManager";
import { usePageTracking } from "@/hooks/usePageTracking";
import { Unlock, Zap, KeyRound, Server } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EndpointField } from "@/components/scim/keys/endpoint-field";
import { CopyButton } from "@/components/scim/keys/copy-button";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

export default function ApiPage() {
  usePageTracking();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";

  const scimEndpoint = `${BASE_URL}/api/${userId}/scim/v2`;
  const authorizeUrl = `${BASE_URL}/api/oauth2/authorize`;
  const tokenUrl     = `${BASE_URL}/api/oauth2/token`;

  return (
    <div className="container mx-auto py-6 space-y-8">
      <p className="text-sm text-muted-foreground">
        Configure how Okta authenticates against this SCIM server — using OAuth 2.0 or a static bearer token.
      </p>

      {/* ── SCIM Endpoint ────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/40">
              <Server className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">SCIM Endpoint</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use this URL as the SCIM base URL in your identity provider, regardless of which authentication method you choose.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">URL</p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
              <code className="flex-1 text-xs font-mono text-foreground truncate min-w-0">{scimEndpoint}</code>
              <CopyButton value={scimEndpoint} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── OAuth 2.0 ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
                  <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Authorization Endpoint</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set this as your app&apos;s <strong className="text-foreground">Authorization endpoint</strong> in the SCIM provisioning settings.
                  </p>
                </div>
              </div>
              <EndpointField method="GET" value={authorizeUrl} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950/40">
                  <KeyRound className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Token Endpoint</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set this as your app&apos;s <strong className="text-foreground">Token endpoint</strong>.
                  </p>
                </div>
              </div>
              <EndpointField method="POST" value={tokenUrl} />
            </CardContent>
          </Card>
        </div>

        {/* Client credentials note */}
        <Card className="bg-muted/20">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/40 mt-0.5">
              <Unlock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-medium">Client credentials are not validated</p>
              <p className="text-xs text-muted-foreground">
                You can enter <strong className="text-foreground">any value</strong> for{" "}
                <code className="font-mono text-[11px]">client_id</code> and{" "}
                <code className="font-mono text-[11px]">client_secret</code> when configuring your Okta SCIM app.
                Authentication is handled entirely by the OAuth flow with your Okta org.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Setup steps */}
        <Accordion type="single" collapsible className="rounded-lg border border-border bg-card overflow-hidden">
          <AccordionItem value="setup" className="border-0">
            <AccordionTrigger className="px-5 py-4 text-sm font-semibold hover:no-underline hover:bg-muted/30 transition-colors">
              How to configure in Okta
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-0">
              <ol className="space-y-2.5 text-xs text-muted-foreground">
                {[
                  "In Okta Admin Console, go to Applications → your SCIM app → Provisioning → API Integration.",
                  "Enable OAuth 2.0 authentication and select Authorization Code flow.",
                  "Paste the Authorization Endpoint and Token Endpoint URLs above.",
                  "Enter any value for Client ID and Client Secret (not validated).",
                  "Set the SCIM Base URL to the SCIM endpoint shown at the top of this page.",
                  "Click Test API Credentials — Okta will run the full OAuth flow automatically.",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or use static bearer tokens</span>
        <Separator className="flex-1" />
      </div>

      {/* ── API Keys ──────────────────────────────────────────────────────── */}
      <ApiKeyManager />
    </div>
  );
}
