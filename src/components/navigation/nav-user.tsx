"use client";

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  LogOut,
  Trophy,
} from "lucide-react";

import { useAccountSettingsDialog } from "@/app/dashboard/dashboard-shell";
import { useNotificationSettingsDialog } from "@/app/dashboard/dashboard-shell";
import { signOut } from "next-auth/react";
import { useGameConfig } from "@/hooks/use-game-config";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    username: string;
    avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  const { competitionType, setCompetitionType } = useGameConfig();

  // Call the hook unconditionally at the top level
  const accountSettingsDialog = useAccountSettingsDialog();
  const openAccountSettings = accountSettingsDialog?.openAccountSettings;
  const notificationSettingsDialog = useNotificationSettingsDialog();
  const openNotificationSettings =
    notificationSettingsDialog?.openNotificationSettings;

  const handleLogout = async () => {
    await signOut({ redirect: false });
    window.location.assign("/");
  };

  const handleSwitchProgram = () => {
    const newType = competitionType === "FRC" ? "FTC" : "FRC";
    setCompetitionType(newType);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg bg-white">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.username}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg bg-white">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.username}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => openAccountSettings && openAccountSettings()}
              >
                <BadgeCheck />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  openNotificationSettings && openNotificationSettings()
                }
              >
                <Bell />
                Notifications
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSwitchProgram}>
                <Trophy
                  className={
                    competitionType === "FTC"
                      ? "text-blue-500"
                      : "text-orange-500"
                  }
                />
                <span
                  className={
                    competitionType === "FTC"
                      ? "text-blue-500"
                      : "text-orange-500"
                  }
                >
                  Switch to {competitionType === "FRC" ? "FTC" : "FRC"}
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
