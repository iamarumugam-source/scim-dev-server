"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { IconBrandGithub } from "@tabler/icons-react";
import React from "react";

// ─── Breadcrumb map ───────────────────────────────────────────────────────────

type Crumb = { label: string; href?: string };

const BREADCRUMBS: Record<string, Crumb[]> = {
  "/":                 [{ label: "Home" }],
  "/scim":             [{ label: "SCIM", href: "/scim" }, { label: "Dashboard" }],
  "/scim/keys":        [{ label: "SCIM", href: "/scim" }, { label: "API" }],
  "/scim/users":       [{ label: "SCIM", href: "/scim" }, { label: "Users" }],
  "/scim/groups":      [{ label: "SCIM", href: "/scim" }, { label: "Groups" }],
  "/scim/logs":        [{ label: "SCIM", href: "/scim" }, { label: "Logs" }],
  "/scim/extensions":  [{ label: "SCIM", href: "/scim" }, { label: "Extensions" }],
  "/har-analyser":     [{ label: "Tools" }, { label: "HAR Analyser" }],
  "/jwe":              [{ label: "Tools" }, { label: "JWE Decoder" }],
  "/changelog":        [{ label: "Changelog" }],
};

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function SiteHeader() {
  const pathname = usePathname();
  const crumbs   = BREADCRUMBS[pathname] ?? [{ label: pathname.split("/").filter(Boolean).pop() ?? "" }];

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {i === crumbs.length - 1 ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : crumb.href ? (
                    <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                  ) : (
                    <span className="text-muted-foreground">{crumb.label}</span>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="https://github.com/iamarumugam-source/scim-dev-server"
            rel="noopener noreferrer"
            target="_blank"
            title="View on GitHub"
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <IconBrandGithub className="h-4 w-4" />
            <span className="sr-only">GitHub</span>
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
