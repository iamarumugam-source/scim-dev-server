"use client";

import { ShieldCheck, Network, KeyRound, ArrowRight } from "lucide-react";
import Link from "next/link";

const TOOLS = [
  {
    title: "SCIM Tool",
    href: "/scim",
    icon: ShieldCheck,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "hover:border-blue-300 dark:hover:border-blue-700",
    description:
      "Manage SCIM 2.0 provisioning for your Okta tenant. Inspect users and groups, manage API keys, and monitor incoming provisioning requests in real time.",
    features: ["Users & Groups", "API Keys", "Request Logs"],
  },
  {
    title: "HAR Analyser",
    href: "/har-analyser",
    icon: Network,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "hover:border-violet-300 dark:hover:border-violet-700",
    description:
      "Upload a HAR capture from Chrome DevTools and inspect every request. Highlights OIDC flow steps, detects Okta headers, and generates ready-to-copy Splunk queries.",
    features: ["OIDC Flow Detection", "Splunk Query Builder", "Waterfall View"],
  },
  {
    title: "JWE Decoder",
    href: "/jwe",
    icon: KeyRound,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "hover:border-amber-300 dark:hover:border-amber-700",
    description:
      "Decode and inspect JSON Web Encryption tokens. Paste a JWE to view its header, decrypt the payload, and examine the embedded claims — all processed in your browser.",
    features: ["Header Inspection", "Payload Decryption", "Claims Viewer"],
  },
];

export default function HomePage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <p className="text-sm text-muted-foreground max-w-xl">
        A set of developer tools for working with Okta — covering SCIM provisioning,
        network traffic analysis, and token inspection.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link key={tool.title} href={tool.href} className="group block">
            <div
              className={`h-full rounded-lg border border-border bg-card p-5 transition-all ${tool.border} hover:shadow-sm space-y-4`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${tool.bg}`}
                  >
                    <tool.icon className={`h-5 w-5 ${tool.color}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                      {tool.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-0.5" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tool.features.map((f) => (
                  <span
                    key={f}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
