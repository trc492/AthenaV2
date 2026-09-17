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
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
                    <SidebarMenuButton tooltip={item.title}>
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
                            <Link href={subItem.url}>
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
                asChild
                tooltip={item.title}
                isActive={routeIsActive(item.url!)}
              >
                <Link href={item.url!}>
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
