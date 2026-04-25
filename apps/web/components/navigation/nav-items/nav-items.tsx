"use client";

import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cva } from "@repo/ui/lib/utils";

const navIconVariants = cva("h-5 w-5 shrink-0", {
  variants: {
    isActive: {
      true: "fill-white",
      false: "",
    },
  },
  defaultVariants: {
    isActive: false,
  },
});

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

export function NavItems({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        if (item.children && item.children.length > 0 && item.navigable === false) {
          return <NavGroup key={item.title} item={item} pathname={pathname} />;
        }

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
              {item.icon && <item.icon className={navIconVariants({ isActive })} />}
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

function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const anyChildActive = item.children?.some((child) => {
    const segs = child.url.split("/").filter((s) => s.length > 0);
    return pathname === child.url || (pathname.startsWith(child.url + "/") && segs.length > 2);
  });
  const [open, setOpen] = useState(!!anyChildActive);

  return (
    <div className="group-data-[collapsible=icon]:contents">
      {/* Group header - not a link */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-12 w-full items-center gap-2 rounded-lg px-4 text-white transition-colors duration-200 hover:bg-white/10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:p-0 ${
          anyChildActive ? "font-semibold" : "font-medium"
        }`}
      >
        {item.icon && <item.icon className={navIconVariants({ isActive: !!anyChildActive })} />}
        <span className="text-sm leading-[18px] tracking-[0.02em] group-data-[collapsible=icon]:hidden">
          {item.title}
        </span>
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-white/60 transition-transform group-data-[collapsible=icon]:hidden ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Children */}
      {open && (
        <div className="flex flex-col gap-0.5 pl-4 group-data-[collapsible=icon]:contents group-data-[collapsible=icon]:pl-0">
          {item.children?.map((child) => {
            const childSegs = child.url.split("/").filter((s) => s.length > 0);
            const isChildActive =
              pathname === child.url ||
              (pathname.startsWith(child.url + "/") && childSegs.length > 2);

            return (
              <Link
                key={child.title}
                href={child.url}
                className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm text-white transition-colors duration-200 hover:bg-white/10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:transition-none group-data-[collapsible=icon]:hover:!mx-0 group-data-[collapsible=icon]:hover:!w-full group-data-[collapsible=icon]:hover:!rounded-none ${
                  isChildActive
                    ? "bg-sidebar-active-bg font-semibold group-data-[collapsible=icon]:!mx-0 group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:!rounded-none group-data-[collapsible=icon]:bg-white/10"
                    : "font-medium"
                }`}
              >
                {child.icon && (
                  <child.icon className={navIconVariants({ isActive: isChildActive })} />
                )}
                <span className="leading-[18px] tracking-[0.02em] group-data-[collapsible=icon]:hidden">
                  {child.title}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
