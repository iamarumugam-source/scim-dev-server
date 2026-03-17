"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "motion/react";
import ApiKeyManager from "@/components/ApiKeyManager";
import { usePageTracking } from "@/hooks/usePageTracking";
import { Unlock, Zap, KeyRound, Server, ListOrdered } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EndpointField } from "@/components/scim/keys/endpoint-field";
import { CopyButton } from "@/components/scim/keys/copy-button";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

async function deriveClientSecret(tenantId: string): Promise<string> {
  const data   = new TextEncoder().encode(tenantId + ":scim-oauth-secret");
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export default function ApiPage() {
  usePageTracking();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";

  const [clientSecret, setClientSecret] = useState<string>("");

  useEffect(() => {
    if (!userId) return;
    deriveClientSecret(userId).then(setClientSecret);
  }, [userId]);

  const scimEndpoint = `${BASE_URL}/api/${userId}/scim/v2`;
  const authorizeUrl = `${BASE_URL}/api/oauth2/authorize`;
  const tokenUrl     = `${BASE_URL}/api/oauth2/token`;

  return (
    <motion.div
      className="container mx-auto py-6 space-y-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >

      {/* ── SCIM Endpoint ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">SCIM Endpoint</CardTitle>
          <CardDescription>
            Use this as the SCIM base URL in your identity provider, regardless of which authentication method you choose.
          </CardDescription>
          <CardAction>
            <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
              <Server className="h-4 w-4 text-foreground/60" />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">URL</p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 min-h-[36px]">
            {!userId
              ? <Skeleton className="h-4 flex-1" />
              : <><code className="flex-1 text-xs font-mono text-foreground truncate min-w-0">{scimEndpoint}</code><CopyButton value={scimEndpoint} /></>
            }
          </div>
        </CardContent>
      </Card>

      {/* ── OAuth 2.0 ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          {/* Authorization Endpoint */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Authorization Endpoint</CardTitle>
              <CardDescription>
                Set this as your app&apos;s <strong className="text-foreground">Authorization endpoint</strong> in the SCIM provisioning settings.
              </CardDescription>
              <CardAction>
                <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                  <Zap className="h-4 w-4 text-foreground/60" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <EndpointField method="GET" value={authorizeUrl} />
            </CardContent>
          </Card>

          {/* Token Endpoint */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Token Endpoint</CardTitle>
              <CardDescription>
                Set this as your app&apos;s <strong className="text-foreground">Token endpoint</strong>.
              </CardDescription>
              <CardAction>
                <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                  <KeyRound className="h-4 w-4 text-foreground/60" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <EndpointField method="POST" value={tokenUrl} />
            </CardContent>
          </Card>
        </div>

        {/* Client credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Client Credentials</CardTitle>
            <CardDescription>
              These credentials are not validated — authentication is handled entirely by the OAuth flow with your Okta org. Use these values when configuring your Okta SCIM app.
            </CardDescription>
            <CardAction>
              <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                <Unlock className="h-4 w-4 text-foreground/60" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { label: "Client ID",     value: userId },
                { label: "Client Secret", value: clientSecret },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 min-h-[36px]">
                    {!value
                      ? <Skeleton className="h-4 flex-1" />
                      : <><code className="flex-1 text-xs font-mono text-foreground truncate min-w-0">{value}</code><CopyButton value={value} /></>
                    }
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Setup steps */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm font-medium">How to configure in Okta</CardTitle>
            <CardDescription>
              Follow these steps to connect your Okta SCIM app using OAuth 2.0.
            </CardDescription>
            <CardAction>
              <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                <ListOrdered className="h-4 w-4 text-foreground/60" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {[
                "In Okta Admin Console, go to Applications → your SCIM app → Provisioning → API Integration.",
                "Enable OAuth 2.0 authentication and select Authorization Code flow.",
                "Paste the Authorization Endpoint and Token Endpoint URLs above.",
                "Copy the Client ID and Client Secret from the credentials card above.",
                "Set the SCIM Base URL to the SCIM endpoint shown at the top of this page.",
                "Click Test API Credentials — Okta will run the full OAuth flow automatically.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or use static bearer tokens</span>
        <Separator className="flex-1" />
      </div>

      {/* ── API Keys ──────────────────────────────────────────────────────── */}
      <ApiKeyManager />

    </motion.div>
  );
}
