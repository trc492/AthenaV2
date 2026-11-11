"use client";

import { type LucideIcon, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOnboarding, useTourHighlight } from "@/components/onboarding/onboarding-provider";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url?: string;
    icon?: LucideIcon;
    items?: {
      title: string;
      isActive?: boolean;
      url: string;
    }[];
  }[];
}) {
  const pathname = usePathname();
  const { completeAction } = useOnboarding();
  const competitionHighlight = useTourHighlight("competition");
  const settingsHighlight = useTourHighlight("settings");
  const { isMobile, setOpenMobile, setOpen, state } = useSidebar();
  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };
  const routeIsActive = (url: string) =>
    url === "/" ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const hasChildren = !!item.items?.length;
          const sectionIsActive = item.items?.some((subItem) =>
            routeIsActive(subItem.url),
          );

          if (hasChildren) {
            return (
              <Collapsible
                key={item.title}
                defaultOpen={sectionIsActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      data-tour-target={item.title === "Competition" ? "competition" : undefined}
                      className={item.title === "Competition" ? competitionHighlight : undefined}
                      tooltip={item.title}
                      isActive={sectionIsActive}
                      onClick={() => {
                        if (item.title === "Competition") completeAction("competition");
                        if (!isMobile && state === "collapsed") setOpen(true);
                      }}
                    >
                      {item.icon && <item.icon />}
                      <span className="flex w-full items-center group-data-[collapsible=icon]:hidden">
                        {item.title}
                        <ChevronRight className="p-1 ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </span>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                    <SidebarMenuSub>
                      {item.items!.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={routeIsActive(subItem.url)}
                          >
                            <Link href={subItem.url} onClick={closeMobileSidebar}>
                              {subItem.title}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          }

          // no children
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                data-tour-target={item.title === "Settings" ? "settings" : undefined}
                className={item.title === "Settings" ? settingsHighlight : undefined}
                asChild
                tooltip={item.title}
                isActive={routeIsActive(item.url!)}
              >
                <Link href={item.url!} onClick={() => { if (item.title === "Settings") completeAction("settings"); closeMobileSidebar(); }}>
                  {item.icon && <item.icon className="size-4" />}

                  <span className="group-data-[collapsible=icon]:hidden">
                    {item.title}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
