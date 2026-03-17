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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useHotkeys } from "react-hotkeys-hook";
import React from "react";

import { META_THEME_COLORS } from "@/config/site";
import { useMetaColor } from "@/hooks/use-meta-color";
import { useSound } from "@/hooks/use-sound";
import { SOUNDS } from "@/lib/sounds";
import { MoonIcon } from "@/components/animated-icons/moon";
import { SunMediumIcon } from "@/components/animated-icons/sun-medium";

// ─── Breadcrumb map ───────────────────────────────────────────────────────────

type Crumb = { label: string; href?: string };

const TOOLS: Crumb = { label: "Tools", href: "/" };
const SCIM: Crumb = { label: "SCIM", href: "/scim" };

const BREADCRUMBS: Record<string, Crumb[]> = {
  "/": [{ label: "Tools" }],
  "/scim": [TOOLS, SCIM, { label: "Dashboard" }],
  "/scim/keys": [TOOLS, SCIM, { label: "API" }],
  "/scim/users": [TOOLS, SCIM, { label: "Users" }],
  "/scim/groups": [TOOLS, SCIM, { label: "Groups" }],
  "/scim/logs": [TOOLS, SCIM, { label: "Logs" }],
  "/scim/extensions": [TOOLS, SCIM, { label: "Extensions" }],
  "/scim/entitlements": [TOOLS, SCIM, { label: "Entitlements" }],
  "/scim/roles": [TOOLS, SCIM, { label: "Roles" }],
  "/har-analyser": [TOOLS, { label: "HAR Analyser" }],
  "/jwe": [TOOLS, { label: "JWE Decoder" }],
  "/changelog": [TOOLS, { label: "Changelog" }],
  "/time-converter": [TOOLS, { label: "Time Buddy" }],
};

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { setMetaColor } = useMetaColor();
  const playClick = useSound(SOUNDS.click);

  const switchTheme = (sound = true) => {
    if (sound) playClick(0.2);
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
    setMetaColor(
      resolvedTheme === "dark"
        ? META_THEME_COLORS.light
        : META_THEME_COLORS.dark,
    );
  };

  useHotkeys("meta+d", () => switchTheme(false), { preventDefault: true });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => switchTheme()}
        >
          <MoonIcon
            size={16}
            className="relative hidden after:absolute after:-inset-2 dark:block"
          />
          <SunMediumIcon
            size={16}
            className="relative block after:absolute after:-inset-2 dark:hidden"
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Toggle theme</TooltipContent>
    </Tooltip>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function SiteHeader() {
  const pathname = usePathname();
  const crumbs = BREADCRUMBS[pathname] ?? [
    { label: pathname.split("/").filter(Boolean).pop() ?? "" },
  ];

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />

        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {i === crumbs.length - 1 ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : crumb.href ? (
                    <BreadcrumbLink href={crumb.href}>
                      {crumb.label}
                    </BreadcrumbLink>
                  ) : (
                    <span className="text-muted-foreground">{crumb.label}</span>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
