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
} from "@/components/ui/sidebar";
import { SearchForm } from "@/components/forms/search-form";
import { useSession } from "next-auth/react";
import { useGameConfig } from "@/hooks/use-game-config";
import { PermissionGuard } from "../auth/PermissionGuard";
import { ROLES } from "@/lib/auth/roles";
import { APP_LOGO } from "@/lib/app-config";
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
          <EventSwitcher />
        </div>
        <SearchForm className="mt-1 ms-2" />
        <NavMain items={data.navMain} />
        <PermissionGuard roles={[ROLES.ADMIN, ROLES.LEAD_SCOUT]}>
          <NavAdmin items={data.navAdmin} />
        </PermissionGuard>
        
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
