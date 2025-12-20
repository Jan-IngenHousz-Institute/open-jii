"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <>
      {items.map((item) => {
        // /en/platform has 2 segments: en, platform
        // /en/platform/experiments has 3 segments: en, platform, experiments
        const itemSegments = item.url.split("/").filter((s) => s.length > 0);
        const isActive =
          pathname === item.url || (pathname.startsWith(item.url + "/") && itemSegments.length > 2);

        return (
          <div key={item.title} className="group-data-[collapsible=icon]:contents">
            <Link
              href={item.url}
              className={`flex h-12 items-center gap-2 rounded-lg px-4 text-white transition-colors duration-200 hover:bg-white/10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:transition-none group-data-[collapsible=icon]:hover:!mx-0 group-data-[collapsible=icon]:hover:!w-full group-data-[collapsible=icon]:hover:!rounded-none ${
                isActive
                  ? "bg-sidebar-active-bg font-semibold group-data-[collapsible=icon]:!mx-0 group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:!rounded-none group-data-[collapsible=icon]:bg-white/10"
                  : "font-medium"
              }`}
            >
              {item.icon && <item.icon className="h-5 w-5 shrink-0" />}
              <span className="text-sm leading-[18px] tracking-[0.02em] group-data-[collapsible=icon]:hidden">
                {item.title}
              </span>
            </Link>
          </div>
        );
      })}
    </>
  );
}
