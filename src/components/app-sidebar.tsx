"use client";
import { UsersRound, KeyIcon, BuildingIcon, ChevronRight, ShieldCheck, Network, KeyRound, FlaskConical } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

import {
  IconCirclePlusFilled,
  IconDashboard,
  IconBrandSlack,
  IconLogs,
  IconRestore,
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
  userCount: z.transform(Number).pipe(z.number().min(5).max(1000)),
  groupCount: z.transform(Number).pipe(z.number().min(1).max(50)),
  deleteExisting: z.boolean(),
});

// Menu items.
const items = [
  {
    title: "Dashboard",
    url: "/scim",
    icon: IconDashboard,
  },
  {
    title: "API Keys",
    url: "/scim/keys",
    icon: KeyIcon,
  },
  {
    title: "Users",
    url: "/scim/users",
    icon: UsersRound,
  },
  {
    title: "Groups",
    url: "/scim/groups",
    icon: BuildingIcon,
  },
  {
    title: "Logs",
    url: "/scim/logs",
    icon: IconLogs,
  },
  {
    title: "Extensions",
    url: "/scim/extensions",
    icon: FlaskConical,
  },
];

const otherTools = [
  {
    title: "HAR Analyser",
    url: "/har-analyser",
    icon: Network,
  },
  {
    title: "JWE Decoder",
    url: "/jwe",
    icon: KeyRound,
  },
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

  const pathname = usePathname();
  const [scimOpen, setScimOpen] = useState(pathname.startsWith("/scim"));

  useEffect(() => {
    if (pathname.startsWith("/scim")) setScimOpen(true);
  }, [pathname]);

  const userId = session?.user?.id;

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
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

      if (data.deleteExisting) toast.info("Removing existing data...");

      setIsGenerating(true);
      toast.info("Generating new sample data...");
      try {
        const res = await fetch(`/api/${userId}/scim/v2/generate`, {
          method: "POST",
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.detail || "An unknown error occurred.");
        }

        toast.success(
          "New data generated successfully! Fetching updated lists...",
        );

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

    toast.error("Deleting/Resetting all users and groups");

    try {
      const res = await fetch(`/api/${userId}/resourceReset`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "An unknown error occurred.");
      }

      toast.success("Data reset completed...");

      clearCache();

      setIsResetDialogOpen(false);

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e: any) {
      toast.error(`Error generating data: ${e.message}`);
    } finally {
      setIsReseting(false);
    }
  }, [isResetting, userId]);

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
                      className="bg-blue-800 text-primary-foreground hover:bg-blue/800 hover:text-primary-foreground active:bg-blue-800 active:text-primary-foreground dark:text-sidebar-accent-foreground 
                  dark:hover:text-sidebar-accent-foreground dark:active:text-sidebar-accent-foreground
                  min-w-8 duration-200 ease-linear"
                      // onClick={handleGenerateClick}
                    >
                      <IconCirclePlusFilled />

                      <span>Generate Mock</span>
                    </SidebarMenuButton>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        How would you like to generate mock data?
                      </DialogTitle>
                      <DialogDescription>
                        You can create new Users on top of the existing list or
                        you can delete existing users and groups and add a new.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="w-full space-y-6"
                      >
                        <FormField
                          control={form.control}
                          name="userCount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>User Count</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="groupCount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Group Count</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="deleteExisting"
                          render={({ field }) => (
                            <FormItem className="flex flex-row">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  Delete existing mock data?
                                </FormLabel>
                                <FormDescription>
                                  If checked, all existing users and groups for
                                  your account will be removed before new ones
                                  are generated.
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                          </DialogClose>
                          <Button
                            className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground dark:text-sidebar-accent-foreground 
                  dark:hover:text-sidebar-accent-foreground dark:active:text-sidebar-accent-foreground
                  min-w-8 duration-200 ease-linear"
                            type="submit"
                          >
                            Confirm
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
                      className="size-8 group-data-[collapsible=icon]:opacity-0 border-2 justify-center"
                      variant="outline"
                    >
                      <IconRestore />
                    </SidebarMenuButton>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset Data</DialogTitle>
                      <DialogDescription>
                        This action cannot be undone. Are you sure you want to
                        permanently delete users, groups and logs from this
                        server?
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground dark:text-sidebar-accent-foreground 
                  dark:hover:text-sidebar-accent-foreground dark:active:text-sidebar-accent-foreground
                  min-w-8 duration-200 ease-linear"
                        onClick={handleReset}
                      >
                        Confirm
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
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton isActive={pathname.startsWith("/scim")}>
                    <ShieldCheck />
                    <span>SCIM Tool</span>
                    <ChevronRight
                      className={cn(
                        "ml-auto h-4 w-4 transition-transform duration-200",
                        scimOpen && "rotate-90",
                      )}
                    />
                  </SidebarMenuButton>
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
              <SidebarMenuItem key="contact">
                <SidebarMenuButton asChild size="sm">
                  <a href="slack://user?team=E017NDYFGQL&id=U096NTCSRMY">
                    <IconBrandSlack />
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
