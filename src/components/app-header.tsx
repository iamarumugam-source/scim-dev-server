"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { IconBrandGithub } from "@tabler/icons-react";

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

export function SiteHeader() {
  const pathname = usePathname();
  const pageTitles: Record<string, string> = {
    "/": "Home",
    "/scim": "Dashboard",
    "/scim/keys": "API",
    "/scim/users": "Users",
    "/scim/groups": "Groups",
    "/scim/logs": "Logs",
    "/scim/extensions": "Schema Extensions",
    "/har-analyser": "HAR Analyser",
    "/jwe": "JWE Decoder",
  };

  const pageTitle = pageTitles[pathname] || "";

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{pageTitle}</h1>
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
