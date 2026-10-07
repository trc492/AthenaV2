"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Database,
  ChartColumnIncreasing,
  Settings,
  DatabaseIcon,
  Users,
  KeyRound,
  FileJson,
  Bell,
  RadioTower,
  LogOut,
  CalendarDays,
} from "lucide-react";

import { NavMain } from "@/components/navigation/nav-main";
import { NavUser } from "@/components/navigation/nav-user";
import { NavAdmin } from "@/components/navigation/nav-admin";
import { EventSwitcher } from "@/components/events/event-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { SearchForm } from "@/components/forms/search-form";
import { useSession, signOut } from "next-auth/react";
import { useGameConfig } from "@/hooks/use-game-config";
import { PermissionGuard } from "../auth/PermissionGuard";
import { ROLES } from "@/lib/auth/roles";
import { APP_LOGO } from "@/lib/app-config";
import { isGuestPage } from "@/lib/auth/guest-policy";
const data = {
  navMain: [
    { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
    {
      title: "Competition",
      icon: RadioTower,
      items: [
        {
          title: "Schedule",
          url: "/dashboard/schedule",
        },
        {
          title: "Start Pit Scouting",
          url: "/scout/pitscout",
        },
        {
          title: "Start Match Scouting",
          url: "/scout/matchscout",
        },
        {
          title: "Match Preview",
          url: "/dashboard/matchup",
        },
      ],
    },
    {
      title: "Data",
      icon: Database,
      items: [
        { title: "Teams", url: "/dashboard/teamlist" },
        { title: "Pit Entries", url: "/dashboard/pitscouting" },
        { title: "Match Entries", url: "/dashboard/matchscouting" },
        { title: "Scouter Performance", url: "/dashboard/spr" },
      ],
    },
    {
      title: "Strategy",
      icon: ChartColumnIncreasing,
      items: [
        { title: "Analysis", url: "/dashboard/analysis" },
        { title: "Picklist", url: "/dashboard/picklist" },
      ],
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings,
    },
  ],
  navAdmin: [
    {
      name: "Guest Links",
      url: "/dashboard/guest-links",
      icon: KeyRound,
    },
    {
      name: "Database",
      url: "/dashboard/admin/database",
      icon: DatabaseIcon,
    },
    {
      name: "Team Management",
      url: "/dashboard/admin/team",
      icon: Users,
    },
    {
      name: "Game Configuration",
      url: "/dashboard/admin/game-config",
      icon: FileJson,
    },
    {
      name: "API Keys",
      url: "/dashboard/admin/keys",
      icon: KeyRound,
    },
    {
      name: "Notifications",
      url: "/dashboard/admin/notifications",
      icon: Bell,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession();
  const guest = session?.guestEvent;
  const navigation = guest ? data.navMain.filter((item) => !item.url || isGuestPage(item.url)).map((item) => ({ ...item, items: item.items?.filter((child) => isGuestPage(child.url)) })) : data.navMain;
  const { competitionType } = useGameConfig();

  // Use session data if available, otherwise fallback to default
  const userData = session?.user
    ? {
        name: session.user.name || "User",
        username: session.user.username || "user",
        avatar:
          session.user.image ||
          session.user.avatarUrl ||
          APP_LOGO,
      }
    : {
        name: "Guest",
        username: "guest",
        avatar: APP_LOGO,
      };

  const competitionName =
    competitionType === "FRC"
      ? "FIRST Robotics Competition"
      : "FIRST Tech Challenge";

  return (
    <Sidebar collapsible="icon" {...props} variant="floating">
      <SidebarHeader
        className={`${competitionType === "FRC" ? "bg-blue-200 dark:bg-blue-900" : "bg-orange-200 dark:bg-orange-900"} rounded-t-sm mb-1.5 text-slate-900 dark:text-slate-100`}
      >
        <div className={`px-2 group-data-[collapsible=icon]:hidden`}>
          <p className="text-xs font-semibold text-center uppercase tracking-wider">
            {competitionName}
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <div className="mx-2 mt-1">
          {guest ? (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  tooltip={`${guest.name} · ${guest.competitionType} ${guest.year} · Read-only guest`}
                  className="h-auto min-h-12 cursor-default group-data-[collapsible=icon]:min-h-8 group-data-[collapsible=icon]:justify-center"
                  asChild
                >
                  <div>
                    <CalendarDays className="shrink-0" aria-hidden="true" />
                    <div className="min-w-0 space-y-1 group-data-[collapsible=icon]:hidden">
                      <p className="whitespace-normal break-words text-sm font-semibold">{guest.name}</p>
                      <p className="whitespace-normal text-xs text-muted-foreground">{guest.competitionType} {guest.year} · Read-only guest</p>
                    </div>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          ) : <EventSwitcher />}
        </div>
        <SearchForm className="mt-1 ms-2" />
        <NavMain items={navigation} />
        <PermissionGuard roles={[ROLES.ADMIN, ROLES.LEAD_SCOUT]}>
          <NavAdmin items={data.navAdmin} />
        </PermissionGuard>
        
      </SidebarContent>
      <SidebarFooter>
        {guest ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                variant="outline"
                tooltip="Leave guest access"
                aria-label="Leave guest access"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut aria-hidden="true" />
                <span className="group-data-[collapsible=icon]:hidden">Leave guest access</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : <NavUser user={userData} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
