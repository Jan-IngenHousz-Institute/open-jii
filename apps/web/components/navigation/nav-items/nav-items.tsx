"use client";

import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@repo/ui/components/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  navigable?: boolean;
  items?: {
    title: string;
    url: string;
  }[];
  children?: NavItem[];
}

/**
 * A row matches its own URL, and a deeper URL under it only when the row is
 * itself nested — otherwise `/platform` would light up on every page.
 */
function isActivePath(pathname: string, url: string) {
  const segments = url.split("/").filter((s) => s.length > 0);
  return pathname === url || (pathname.startsWith(url + "/") && segments.length > 2);
}

export function NavItems({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobileNavigation = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <SidebarMenu>
      {items.map((item) => {
        if (item.children && item.children.length > 0 && item.navigable === false) {
          return (
            <NavGroup
              key={item.title}
              item={item}
              pathname={pathname}
              onNavigate={closeMobileNavigation}
            />
          );
        }

        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              asChild
              isActive={isActivePath(pathname, item.url)}
              tooltip={item.title}
            >
              <Link href={item.url} onClick={closeMobileNavigation}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function NavGroup({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const anyChildActive = item.children?.some((child) => isActivePath(pathname, child.url));

  return (
    <Collapsible asChild defaultOpen={anyChildActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children?.map((child) => (
              <SidebarMenuSubItem key={child.title}>
                <SidebarMenuSubButton asChild isActive={isActivePath(pathname, child.url)}>
                  <Link href={child.url} onClick={onNavigate}>
                    {child.icon && <child.icon />}
                    <span>{child.title}</span>
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
