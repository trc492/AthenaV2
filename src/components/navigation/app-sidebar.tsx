"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Database,
  ListOrdered,
  ChartColumnIncreasing,
  Table,
  Home,
  Settings,
  CalendarClock,
  Swords,
  UserCheck,
  DatabaseIcon,
  Users,
  KeyRound,
  FileJson,
  Bell
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
const data = {
  user: {
    name: "Noah Fang",
    username: "writerfrighter",
    avatar: "/TRCLogo.webp",
  },
  navMain: [
    { title: "Home", url: "/", icon: Home },
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    {
      title: "Team List",
      url: "/dashboard/teamlist",
      icon: Table,
    },
    {
      title: "Matchup",
      url: "/dashboard/matchup",
      icon: Swords,
    },
    {
      title: "Scouting",
      icon: Database,
      items: [
        {
          title: "Schedule",
          url: "/dashboard/schedule",
          icon: CalendarClock,
        },
        {
          title: "Pit Scouting",
          url: "/dashboard/pitscouting",
        },
        {
          title: "Match Scouting",
          url: "/dashboard/matchscouting",
        },
        {
          title: "Scouter Performance",
          url: "/dashboard/spr",
          icon: UserCheck,
        },
      ],
    },
    {
      title: "Analysis",
      url: "/dashboard/analysis",
      icon: ChartColumnIncreasing,
    },
    {
      title: "Picklist",
      url: "/dashboard/picklist",
      icon: ListOrdered,
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
          "/TRCLogo.webp",
      }
    : {
        name: "Guest",
        username: "guest",
        avatar: "/TRCLogo.webp",
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
