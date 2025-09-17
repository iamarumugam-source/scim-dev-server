"use client";
import { UsersRound, KeyIcon } from "lucide-react";

import {
  IconCirclePlusFilled,
  IconInnerShadowTop,
  IconClearAll,
  IconDashboard,
  IconListDetails,
} from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

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

import { Button } from "./ui/button";
import NavUser from "./user-menu";

import { Input } from "./ui/input";
import { Label } from "@/components/ui/label";

// Menu items.
const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: IconDashboard,
  },

  {
    title: "API Keys",
    url: "/keys",
    icon: KeyIcon,
  },
  {
    title: "Users",
    url: "#",
    icon: IconListDetails,
  },
  {
    title: "Groups",
    url: "#",
    icon: UsersRound,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const handleGenerateClick = () => {
    // Dispatch a custom event that the dashboard page will listen for.
    document.dispatchEvent(new CustomEvent("generateData"));
  };

  const handleClearCacheClick = () => {
    // Dispatch another custom event for clearing the cache.
    document.dispatchEvent(new CustomEvent("clearCache"));
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">
                  Okta SCIM Server
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              <SidebarMenuItem className="flex items-center gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Generate Mock"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground dark:text-sidebar-accent-foreground 
                  dark:hover:text-sidebar-accent-foreground dark:active:text-sidebar-accent-foreground
                  min-w-8 duration-200 ease-linear"
                      // onClick={handleGenerateClick}
                    >
                      <IconCirclePlusFilled />
                      <span>Generate Mock</span>
                    </SidebarMenuButton>
                  </DialogTrigger>
                  <form>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          How would you like to generate mock data?
                        </DialogTitle>
                        <DialogDescription>
                          This action cannot be undone. Are you sure you want to
                          permanently delete this file from our servers?
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4">
                        <div className="grid gap-3">
                          <Label htmlFor="name-1">Name</Label>
                          <Input
                            id="name-1"
                            name="name"
                            defaultValue="Pedro Duarte"
                          />
                        </div>
                        <div className="grid gap-3">
                          <Label htmlFor="username-1">Username</Label>
                          <Input
                            id="username-1"
                            name="username"
                            defaultValue="@peduarte"
                          />
                        </div>
                      </div>

                      <DialogFooter>
                        <Button
                          className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground dark:text-sidebar-accent-foreground 
                  dark:hover:text-sidebar-accent-foreground dark:active:text-sidebar-accent-foreground
                  min-w-8 duration-200 ease-linear"
                          type="submit"
                        >
                          Confirm
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </form>
                </Dialog>
                <Button
                  size="icon"
                  className="size-8 group-data-[collapsible=icon]:opacity-0"
                  variant="outline"
                  onClick={handleClearCacheClick}
                >
                  <IconClearAll />
                </Button>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
