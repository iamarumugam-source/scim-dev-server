"use client";
import { UsersRound, Boxes, BuildingIcon, ChevronRight, ShieldCheck, ScanSearch, KeyRound, FlaskConical, Fingerprint, LayoutDashboard, Webhook, ScrollText, Puzzle, Activity, LockKeyhole, BookOpen, WandSparkles, Eraser, BadgeCheck, Crown } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

import {
  IconDashboard,
  IconLogs,
} from "@tabler/icons-react";
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

import { Input } from "./ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

const FormSchema = z.object({
  generateUsers:        z.boolean(),
  generateGroups:       z.boolean(),
  generateEntitlements: z.boolean(),
  generateRoles:        z.boolean(),
  userCount:            z.transform(Number).pipe(z.number().min(1).max(1000)),
  groupCount:           z.transform(Number).pipe(z.number().min(1).max(50)),
  deleteExisting:       z.boolean(),
});

// Menu items.
const items = [
  { title: "Dashboard",  url: "/scim",           icon: LayoutDashboard },
  { title: "API",        url: "/scim/keys",       icon: Webhook         },
  { title: "Users",      url: "/scim/users",      icon: UsersRound      },
  { title: "Groups",       url: "/scim/groups",       icon: Boxes      },
  { title: "Entitlements", url: "/scim/entitlements", icon: BadgeCheck },
  { title: "Roles",        url: "/scim/roles",        icon: Crown      },
  { title: "Logs",         url: "/scim/logs",         icon: ScrollText },
  { title: "Extensions", url: "/scim/extensions", icon: Puzzle          },
];

const otherTools = [
  { title: "HAR Analyser", url: "/har-analyser", icon: ScanSearch  },
  { title: "JWE Decoder",  url: "/jwe",          icon: LockKeyhole },
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
  const [resetSelections, setResetSelections] = useState({
    users:        true,
    groups:       true,
    entitlements: true,
    roles:        true,
    logs:         true,
    pageViews:    true,
  });

  const pathname = usePathname();
  const [scimOpen, setScimOpen] = useState(pathname.startsWith("/scim"));

const userId = session?.user?.id;

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      generateUsers:        true,
      generateGroups:       true,
      generateEntitlements: true,
      generateRoles:        true,
      userCount:            10,
      groupCount:           2,
      deleteExisting:       false,
    },
  });

  function onSubmit(data: FormValues) {
    handleGenerateData(data);
  }

  const handleGenerateData = useCallback(
    async (data: FormValues) => {
      if (isGenerating) return;

      if (data.deleteExisting) toast.info("Removing existing users, groups, entitlements, and roles...");

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
      users:        "Users",
      groups:       "Groups",
      entitlements: "Entitlements",
      roles:        "Roles",
      logs:         "Logs",
      pageViews:    "Page views",
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
                      className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground dark:text-sidebar-accent-foreground dark:hover:text-sidebar-accent-foreground dark:active:text-sidebar-accent-foreground min-w-8 duration-200 ease-linear"
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
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">What to generate</p>

                          {/* Users */}
                          <FormField
                            control={form.control}
                            name="generateUsers"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between space-y-0">
                                <div className="flex items-center gap-2.5">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">Users</FormLabel>
                                </div>
                                {field.value && (
                                  <FormField
                                    control={form.control}
                                    name="userCount"
                                    render={({ field: f }) => (
                                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                                        <FormLabel className="text-xs text-muted-foreground font-normal whitespace-nowrap">Count</FormLabel>
                                        <FormControl>
                                          <Input {...f} type="number" className="h-7 w-20 text-xs" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}
                              </FormItem>
                            )}
                          />

                          {/* Groups */}
                          <FormField
                            control={form.control}
                            name="generateGroups"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between space-y-0">
                                <div className="flex items-center gap-2.5">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">Groups</FormLabel>
                                </div>
                                {field.value && (
                                  <FormField
                                    control={form.control}
                                    name="groupCount"
                                    render={({ field: f }) => (
                                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                                        <FormLabel className="text-xs text-muted-foreground font-normal whitespace-nowrap">Count</FormLabel>
                                        <FormControl>
                                          <Input {...f} type="number" className="h-7 w-20 text-xs" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}
                              </FormItem>
                            )}
                          />

                          {/* Entitlements */}
                          <FormField
                            control={form.control}
                            name="generateEntitlements"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-y-0 gap-2.5">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer flex-1">Entitlements</FormLabel>
                                <span className="text-xs text-muted-foreground">from catalog</span>
                              </FormItem>
                            )}
                          />

                          {/* Roles */}
                          <FormField
                            control={form.control}
                            name="generateRoles"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-y-0 gap-2.5">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer flex-1">Roles</FormLabel>
                                <span className="text-xs text-muted-foreground">from catalog</span>
                              </FormItem>
                            )}
                          />
                        </div>

                        <Separator />

                        {/* Delete existing */}
                        <FormField
                          control={form.control}
                          name="deleteExisting"
                          render={({ field }) => (
                            <FormItem className="flex flex-row gap-2.5 items-start space-y-0">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
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
                            <Button variant="outline">Cancel</Button>
                          </DialogClose>
                          <Button type="submit" disabled={isGenerating}>
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
                      className="size-8 group-data-[collapsible=icon]:opacity-0 border justify-center text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/10 transition-colors"
                      variant="outline"
                    >
                      <Eraser />
                    </SidebarMenuButton>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset Data</DialogTitle>
                      <DialogDescription>
                        Select what to permanently delete. This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>

                    <Separator />

                    <div className="space-y-3 py-1">
                      {([
                        { key: "users",        label: "Users",        desc: "All provisioned user accounts" },
                        { key: "groups",       label: "Groups",       desc: "All user groups and memberships" },
                        { key: "entitlements", label: "Entitlements", desc: "All entitlement definitions" },
                        { key: "roles",        label: "Roles",        desc: "All role definitions" },
                        { key: "logs",         label: "Logs",         desc: "All API request logs" },
                        { key: "pageViews",    label: "Page views",   desc: "Page view counters" },
                      ] as const).map(({ key, label, desc }) => (
                        <div key={key} className="flex items-start gap-3">
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
                      ))}
                    </div>

                    <Separator />

                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        variant="destructive"
                        onClick={handleReset}
                        disabled={isResetting || !Object.values(resetSelections).some(Boolean)}
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
            <Collapsible asChild open={scimOpen} onOpenChange={setScimOpen}>
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
                <SidebarMenuButton asChild size="sm" isActive={pathname === "/changelog"}>
                  <a href="/changelog">
                    <BookOpen />
                    <span>Changelog</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem key="contact">
                <SidebarMenuButton asChild size="sm">
                  <a href="slack://channel?team=E017NDYFGQL&id=C0AKWV1GCHM">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                    </svg>
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
    </Sidebar>
  );
}
