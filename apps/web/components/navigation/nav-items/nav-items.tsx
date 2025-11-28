"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@repo/ui/components";

export function NavItems({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          // /en/platform has 2 segments: en, platform
          // /en/platform/experiments has 3 segments: en, platform, experiments
          const itemSegments = item.url.split("/").filter((s) => s.length > 0);
          const isActive =
            pathname === item.url ||
            (pathname.startsWith(item.url + "/") && itemSegments.length > 2);

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                <Link
                  href={item.url}
                  className="transition-all duration-200 group-data-[collapsible=icon]:justify-center"
                >
                  {item.icon && (
                    <item.icon
                      className={`transition-all duration-200 ${isActive ? "text-white" : ""}`}
                    />
                  )}
                  <span
                    className={`transition-all duration-200 group-data-[collapsible=icon]:hidden ${isActive ? "text-white" : ""}`}
                  >
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
