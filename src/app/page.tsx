"use client";

import { ShieldCheck, ScanSearch, KeyRound, ArrowRight, Sparkles, Github, Slack } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const TOOLS = [
  {
    title: "SCIM Tool",
    href: "/scim",
    icon: ShieldCheck,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    description:
      "Manage SCIM 2.0 provisioning for your Okta tenant. Inspect users and groups, manage API keys, and monitor incoming provisioning requests in real time.",
    features: ["Users & Groups", "API Keys", "Request Logs"],
    aiFeatures: ["AI Template Builder"],
  },
  {
    title: "HAR Analyser",
    href: "/har-analyser",
    icon: ScanSearch,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
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
          <Link key={tool.title} href={tool.href} className="group block h-full">
            <Card className="h-full hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${tool.bg}`}>
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
                      <Badge key={f} variant="secondary" className="text-[11px] font-normal rounded-full">
                        {f}
                      </Badge>
                    ))}
                  </div>
                  {"aiFeatures" in tool && tool.aiFeatures && (
                    <div className="flex flex-wrap gap-1.5">
                      {tool.aiFeatures.map((f) => (
                        <Badge
                          key={f}
                          variant="outline"
                          className="text-[11px] font-normal rounded-full gap-1 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40"
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          {f}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-amber-500 flex-shrink-0" />
          AI features are only available when running locally. Clone the repo and set{" "}
          <code className="font-mono text-primary">LLM_BASE_URL</code>,{" "}
          <code className="font-mono text-primary">LLM_API_KEY</code>, and{" "}
          <code className="font-mono text-primary">LLM_MODEL</code>.
        </p>
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://github.com/iamarumugam-source/scim-dev-server"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
              >
                <Github className="h-3.5 w-3.5" />
                iamarumugam-source/scim-dev-server
              </a>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs space-y-0.5">
              <p className="font-medium">Source code</p>
              <p className="text-xs opacity-80">View, clone, or contribute to this project on GitHub.</p>
            </TooltipContent>
          </Tooltip>

          <span className="text-border">·</span>

          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="slack://channel?team=E017NDYFGQL&id=C0AKWV1GCHM"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
              >
                <Slack className="h-3.5 w-3.5" />
                #dse-internal-tooling
              </a>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs space-y-0.5">
              <p className="font-medium">Support</p>
              <p className="text-xs opacity-80">Join #dse-internal-tooling on Slack to request access or get help.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
