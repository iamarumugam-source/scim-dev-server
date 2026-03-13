"use client";

import { ShieldCheck, Network, KeyRound, ArrowRight, Sparkles, Github } from "lucide-react";
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
    aiFeatures: ["AI Template Builder"],
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
    aiFeatures: ["AI Request Analysis"],
  },
  {
    title: "JWE Decoder",
    href: "/jwe",
    icon: KeyRound,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "hover:border-amber-300 dark:hover:border-amber-700",
    description:
      "Decode and inspect JSON Web Encryption tokens. Paste a JWE to view its header, decrypt the payload, and examine the embedded claims. All processed in your browser.",
    features: ["Header Inspection", "Payload Decryption", "Claims Viewer"],
  },
];

export default function HomePage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <p className="text-sm text-muted-foreground max-w-xl">
        A set of developer tools for working with Okta, covering SCIM provisioning,
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
              <div className="space-y-1.5">
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
                {"aiFeatures" in tool && tool.aiFeatures && (
                  <div className="flex flex-wrap gap-1.5">
                    {tool.aiFeatures.map((f) => (
                      <span
                        key={f}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center gap-1"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-amber-500 flex-shrink-0" />
          AI features are only available when running locally. Clone the repo and set{" "}
          <code className="font-mono text-primary">LLM_BASE_URL</code>,{" "}
          <code className="font-mono text-primary">LLM_API_KEY</code>, and{" "}
          <code className="font-mono text-primary">LLM_MODEL</code>.
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/iamarumugam-source/scim-dev-server"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            iamarumugam-source/scim-dev-server
          </a>
          <span className="text-border">·</span>
          <a
            href="slack://channel?team=E017NDYFGQL&id=C0AKWV1GCHM"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
            #dse-internal-tooling
          </a>
        </div>
      </div>
    </div>
  );
}
