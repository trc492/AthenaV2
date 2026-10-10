"use client";

import { AppSidebar } from "@/components/navigation/app-sidebar";
import { createContext, useContext, useState } from "react";
import dynamic from "next/dynamic";
import { ModeToggle } from "@/components/ui/light-dark-toggle";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeSelector } from "@/components/settings/theme-selector";
import { useSession } from "next-auth/react";
import DashboardLoading from "./loading";

const AccountSettingsDialog = dynamic(
  () => import("./account-settings").then((mod) => mod.AccountSettingsDialog),
  { ssr: false },
);

const NotificationSettingsDialog = dynamic(
  () =>
    import("./notification-settings-dialog").then(
      (mod) => mod.NotificationSettingsDialog,
    ),
  { ssr: false },
);

const AccountSettingsContext = createContext<
  { openAccountSettings: () => void } | undefined
>(undefined);

export function useAccountSettingsDialog() {
  const ctx = useContext(AccountSettingsContext);
  if (!ctx)
    throw new Error(
      "useAccountSettingsDialog must be used within AccountSettingsContext",
    );
  return ctx;
}

const NotificationSettingsContext = createContext<
  { openNotificationSettings: () => void } | undefined
>(undefined);

export function useNotificationSettingsDialog() {
  const ctx = useContext(NotificationSettingsContext);
  if (!ctx)
    throw new Error(
      "useNotificationSettingsDialog must be used within NotificationSettingsContext",
    );
  return ctx;
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  // Session revalidation keeps the existing session while status is loading.
  // Only replace the dashboard during the initial session load.
  const isInitialLoading = status === "loading" && !session;
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const openAccountSettings = () => setAccountOpen(true);
  const openNotificationSettings = () => setNotificationOpen(true);
  if (status === "unauthenticated") return <div className="p-8"><p>Your session has ended. Open a new guest link or sign in.</p><a href="/login">Sign in</a></div>;

  return (
    <AccountSettingsContext.Provider value={{ openAccountSettings }}>
      <NotificationSettingsContext.Provider
        value={{ openNotificationSettings }}
      >
        <SidebarProvider>
          {isInitialLoading ? <DashboardSidebarLoading /> : <AppSidebar />}
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              {session?.guestEvent && <span className="text-xs text-muted-foreground">Guest · {session.guestEvent.name}</span>}
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <div className="ml-auto flex items-center gap-2">
                <ModeToggle />
                <ThemeSelector />
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4">
              {isInitialLoading ? <DashboardLoading /> : children}
            </div>
          </SidebarInset>
          {accountOpen && (
            <AccountSettingsDialog
              open={accountOpen}
              onOpenChange={setAccountOpen}
            />
          )}
          {notificationOpen && (
            <NotificationSettingsDialog
              open={notificationOpen}
              onOpenChange={setNotificationOpen}
            />
          )}
        </SidebarProvider>
      </NotificationSettingsContext.Provider>
    </AccountSettingsContext.Provider>
  );
}

function DashboardSidebarLoading() {
  return (
    <Sidebar collapsible="icon" variant="floating" aria-label="Loading navigation">
      <SidebarHeader>
        <Skeleton className="mx-auto h-4 w-40" />
      </SidebarHeader>
      <SidebarContent className="gap-5 px-3 pt-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-full" />
        <div className="space-y-4 pt-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <Skeleton className="h-10 w-full" />
      </SidebarFooter>
    </Sidebar>
  );
}
