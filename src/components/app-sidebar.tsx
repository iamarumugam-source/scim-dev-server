"use client";
import {
  UsersRound,
  Boxes,
  BuildingIcon,
  ChevronRight,
  ShieldCheck,
  ScanSearch,
  KeyRound,
  FlaskConical,
  Fingerprint,
  LayoutDashboard,
  Webhook,
  ScrollText,
  Puzzle,
  Activity,
  LockKeyhole,
  BookOpen,
  WandSparkles,
  Eraser,
  BadgeCheck,
  Crown,
  LifeBuoy,
  Minus,
  Plus,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { IconDashboard, IconLogs } from "@tabler/icons-react";
import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Button } from "./ui/button";
import NavUser from "./user-menu";
import { KeyboardShortcuts } from "./keyboard-shortcuts";

import { Input } from "./ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";

const FormSchema = z.object({
  generateUsers: z.boolean(),
  generateGroups: z.boolean(),
  generateEntitlements: z.boolean(),
  generateRoles: z.boolean(),
  userCount: z.transform(Number).pipe(z.number().min(1).max(1000)),
  groupCount: z.transform(Number).pipe(z.number().min(1).max(50)),
  deleteExisting: z.boolean(),
});

// Menu items.
const items = [
  { title: "Dashboard", url: "/scim", icon: LayoutDashboard },
  { title: "API", url: "/scim/keys", icon: Webhook },
  { title: "Users", url: "/scim/users", icon: UsersRound },
  { title: "Groups", url: "/scim/groups", icon: Boxes },
  { title: "Entitlements", url: "/scim/entitlements", icon: BadgeCheck },
  { title: "Roles", url: "/scim/roles", icon: Crown },
  { title: "Logs", url: "/scim/logs", icon: ScrollText },
  { title: "Extensions", url: "/scim/extensions", icon: Puzzle },
];

const otherTools = [
  { title: "HAR Analyser", url: "/har-analyser", icon: ScanSearch },
  { title: "JWE Decoder", url: "/jwe", icon: LockKeyhole },
];

type FormValues = z.infer<typeof FormSchema>;

const clearCache = () => {
  try {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith("scim_users_") || key.startsWith("scim_groups_")) {
        sessionStorage.removeItem(key);
      }
    });
    console.log("Session cache cleared by sidebar.");
  } catch (error) {
    console.error("Could not clear session storage:", error);
  }
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { data: session } = useSession();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsReseting] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const { toggleSidebar } = useSidebar();
  const [resetSelections, setResetSelections] = useState({
    users: true,
    groups: true,
    entitlements: true,
    roles: true,
    logs: true,
    pageViews: true,
  });

  const router = useRouter();
  const pathname = usePathname();
  const [scimOpen, setScimOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebar_scim_open");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  const handleScimOpenChange = (open: boolean) => {
    setScimOpen(open);
    try {
      localStorage.setItem("sidebar_scim_open", String(open));
    } catch {}
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useHotkeys("meta+backslash", () => toggleSidebar(),           { preventDefault: true });
  useHotkeys("shift+slash",    () => setIsShortcutsOpen(true),  { preventDefault: true });
  useHotkeys("meta+g",         () => setIsDialogOpen(true),     { preventDefault: true });
  useHotkeys("meta+backspace",  () => setIsResetDialogOpen(true), { preventDefault: true });
  useHotkeys("meta+l",         () => router.push("/scim/logs"), { preventDefault: true });

  const userId = session?.user?.id;

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      generateUsers: true,
      generateGroups: true,
      generateEntitlements: true,
      generateRoles: true,
      userCount: 10,
      groupCount: 2,
      deleteExisting: false,
    },
  });

  function onSubmit(data: FormValues) {
    handleGenerateData(data);
  }

  const handleGenerateData = useCallback(
    async (data: FormValues) => {
      if (isGenerating) return;

      if (data.deleteExisting)
        toast.info(
          "Removing existing users, groups, entitlements, and roles...",
        );

      setIsGenerating(true);
      toast.info("Generating users, groups, entitlements, and roles...");
      try {
        const res = await fetch(`/api/${userId}/scim/v2/generate`, {
          method: "POST",
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.detail || "An unknown error occurred.");
        }

        const result = await res.json();
        toast.success(result.message ?? "Data generated successfully.");

        clearCache();

        setIsDialogOpen(false);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (e: any) {
        toast.error(`Error generating data: ${e.message}`);
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, userId],
  );

  const handleReset = useCallback(async () => {
    if (isResetting) return;

    setIsReseting(true);

    const RESET_LABELS: Record<string, string> = {
      users: "Users",
      groups: "Groups",
      entitlements: "Entitlements",
      roles: "Roles",
      logs: "Logs",
      pageViews: "Page views",
    };

    const selectedLabels = Object.entries(resetSelections)
      .filter(([, v]) => v)
      .map(([k]) => RESET_LABELS[k] ?? k);

    if (selectedLabels.length === 0) {
      toast.error("Select at least one item to reset.");
      setIsReseting(false);
      return;
    }

    toast.info(`Deleting ${selectedLabels.join(", ")}…`);

    try {
      const res = await fetch(`/api/${userId}/resourceReset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resetSelections),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "An unknown error occurred.");
      }

      toast.success(`${selectedLabels.join(", ")} deleted successfully.`);

      clearCache();

      setIsResetDialogOpen(false);

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e: any) {
      toast.error(`Error resetting data: ${e.message}`);
    } finally {
      setIsReseting(false);
    }
  }, [isResetting, userId, resetSelections]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/">
                <Image
                  src="/okta.svg"
                  alt="Okta SCIM"
                  width={40}
                  height={40}
                  className="!size-5 dark:invert"
                />
                <span className="text-base font-semibold">Okta Tools</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              <SidebarMenuItem className="flex items-center gap-2">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Generate Mock"
                      className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground dark:text-sidebar-accent-foreground dark:hover:text-sidebar-accent-foreground dark:active:text-sidebar-accent-foreground min-w-8 duration-200 ease-linear"
                    >
                      <WandSparkles />
                      <span>Generate Mock</span>
                    </SidebarMenuButton>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        How would you like to generate mock data?
                      </DialogTitle>
                      <DialogDescription>
                        Generates users, groups, entitlements, and roles. You
                        can add on top of existing data or wipe it first.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="w-full space-y-5"
                      >
                        {/* What to generate */}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                            What to generate
                          </p>
                          <div className="flex flex-col gap-2">

                            {/* Users */}
                            <FormField
                              control={form.control}
                              name="generateUsers"
                              render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <div className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-3">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal cursor-pointer">Users</FormLabel>
                                    </div>
                                    {field.value && (
                                      <FormField
                                        control={form.control}
                                        name="userCount"
                                        render={({ field: f }) => (
                                          <FormItem className="space-y-0">
                                            <FormControl>
                                              <div className="flex items-center rounded-full border border-input bg-background overflow-hidden h-8">
                                                <input
                                                  type="number"
                                                  value={f.value}
                                                  min={1}
                                                  max={1000}
                                                  onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) f.onChange(Math.min(1000, Math.max(1, v))); }}
                                                  className="w-12 text-sm tabular-nums font-medium text-center bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                                <div className="w-px self-stretch bg-border" />
                                                <button type="button" className="h-full w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => f.onChange(Math.max(1, Number(f.value) - 1))}>
                                                  <Minus className="h-3.5 w-3.5" />
                                                </button>
                                                <div className="w-px self-stretch bg-border" />
                                                <button type="button" className="h-full w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => f.onChange(Math.min(1000, Number(f.value) + 1))}>
                                                  <Plus className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    )}
                                  </div>
                                  <Separator />
                                </FormItem>
                              )}
                            />

                            {/* Groups */}
                            <FormField
                              control={form.control}
                              name="generateGroups"
                              render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <div className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-3">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal cursor-pointer">Groups</FormLabel>
                                    </div>
                                    {field.value && (
                                      <FormField
                                        control={form.control}
                                        name="groupCount"
                                        render={({ field: f }) => (
                                          <FormItem className="space-y-0">
                                            <FormControl>
                                              <div className="flex items-center rounded-full border border-input bg-background overflow-hidden h-8">
                                                <input
                                                  type="number"
                                                  value={f.value}
                                                  min={1}
                                                  max={50}
                                                  onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) f.onChange(Math.min(50, Math.max(1, v))); }}
                                                  className="w-12 text-sm tabular-nums font-medium text-center bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                                <div className="w-px self-stretch bg-border" />
                                                <button type="button" className="h-full w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => f.onChange(Math.max(1, Number(f.value) - 1))}>
                                                  <Minus className="h-3.5 w-3.5" />
                                                </button>
                                                <div className="w-px self-stretch bg-border" />
                                                <button type="button" className="h-full w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => f.onChange(Math.min(50, Number(f.value) + 1))}>
                                                  <Plus className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    )}
                                  </div>
                                  <Separator />
                                </FormItem>
                              )}
                            />

                            {/* Entitlements */}
                            <FormField
                              control={form.control}
                              name="generateEntitlements"
                              render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <div className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-3">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal cursor-pointer">Entitlements</FormLabel>
                                    </div>
                                    <span className="text-xs text-muted-foreground">from catalog</span>
                                  </div>
                                  <Separator />
                                </FormItem>
                              )}
                            />

                            {/* Roles */}
                            <FormField
                              control={form.control}
                              name="generateRoles"
                              render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <div className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-3">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal cursor-pointer">Roles</FormLabel>
                                    </div>
                                    <span className="text-xs text-muted-foreground">from catalog</span>
                                  </div>
                                </FormItem>
                              )}
                            />

                          </div>
                        </div>

                        <Separator />

                        {/* Delete existing */}
                        <FormField
                          control={form.control}
                          name="deleteExisting"
                          render={({ field }) => (
                            <FormItem className="flex items-start gap-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="mt-0.5"
                                />
                              </FormControl>
                              <div className="space-y-0.5">
                                <FormLabel className="text-sm">Delete existing data first</FormLabel>
                                <FormDescription className="text-xs">
                                  Removes existing users, groups, entitlements, and roles before generating new ones.
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline" size="sm">
                              Cancel
                            </Button>
                          </DialogClose>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={isGenerating}
                          >
                            {isGenerating ? "Generating…" : "Generate"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
                <Dialog
                  open={isResetDialogOpen}
                  onOpenChange={setIsResetDialogOpen}
                >
                  <DialogTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Reset Data"
                      className="cursor-pointer size-8 group-data-[collapsible=icon]:opacity-0 border justify-center text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/10 transition-colors"
                      variant="outline"
                    >
                      <Eraser />
                    </SidebarMenuButton>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset Data</DialogTitle>
                      <DialogDescription>
                        Select what to permanently delete. This action cannot be
                        undone.
                      </DialogDescription>
                    </DialogHeader>

                    <Separator />

                    <div className="flex flex-col gap-2 py-1">
                      {(
                        [
                          { key: "users",        label: "Users",        desc: "All provisioned user accounts"    },
                          { key: "groups",       label: "Groups",       desc: "All user groups and memberships"  },
                          { key: "entitlements", label: "Entitlements", desc: "All entitlement definitions"      },
                          { key: "roles",        label: "Roles",        desc: "All role definitions"             },
                          { key: "logs",         label: "Logs",         desc: "All API request logs"             },
                          { key: "pageViews",    label: "Page views",   desc: "Page view counters"               },
                        ] as const
                      ).map(({ key, label, desc }, i, arr) => (
                        <div key={key}>
                          <div className="flex items-start gap-3 py-1.5">
                            <Checkbox
                              id={`reset-${key}`}
                              checked={resetSelections[key]}
                              onCheckedChange={(checked) =>
                                setResetSelections((p) => ({ ...p, [key]: checked === true }))
                              }
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <Label
                                htmlFor={`reset-${key}`}
                                className="text-sm font-medium cursor-pointer leading-none"
                              >
                                {label}
                              </Label>
                              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                            </div>
                          </div>
                          {i < arr.length - 1 && <Separator />}
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline" size="sm">
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleReset}
                        disabled={
                          isResetting ||
                          !Object.values(resetSelections).some(Boolean)
                        }
                      >
                        {isResetting ? "Deleting…" : "Delete selected"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarMenu>
            <Collapsible
              asChild
              open={scimOpen}
              onOpenChange={handleScimOpenChange}
            >
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith("/scim")}
                  tooltip="SCIM Tool"
                >
                  <a href="/scim">
                    <ShieldCheck />
                    <span>SCIM Tool</span>
                  </a>
                </SidebarMenuButton>
                <CollapsibleTrigger asChild>
                  <SidebarMenuAction
                    className={cn(
                      "transition-transform duration-200",
                      scimOpen && "rotate-90",
                    )}
                    showOnHover
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Toggle SCIM sub-menu</span>
                  </SidebarMenuAction>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {items.map((sub) => (
                      <SidebarMenuSubItem key={sub.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === sub.url}
                        >
                          <a href={sub.url}>
                            <sub.icon />
                            <span>{sub.title}</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
            {otherTools.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.url)}
                >
                  <a href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup className="relative flex w-full min-w-0 flex-col p-2 mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem key="changelog">
                <SidebarMenuButton
                  asChild
                  size="sm"
                  isActive={pathname === "/changelog"}
                >
                  <a href="/changelog">
                    <BookOpen />
                    <span>Changelog</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem key="contact">
                <SidebarMenuButton asChild size="sm">
                  <a href="slack://channel?team=E017NDYFGQL&id=C0AKWV1GCHM">
                    <LifeBuoy />
                    <span>Support</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      {/* ── Keyboard shortcuts reference ─────────────────────────────────── */}
      <Dialog open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 border-0 bg-transparent shadow-none">
          <KeyboardShortcuts />
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
