"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import { Sidebar, SidebarRail, SidebarTrigger, useSidebar } from "@repo/ui/components";

import { NavItems } from "../nav-items/nav-items";
import { iconMap } from "../navigation-config";

interface NavigationItem {
  title: string;
  url: string;
  icon: string;
  isActive?: boolean;
  items: {
    title: string;
    url: string;
  }[];
}

interface NavigationData {
  navDashboard: NavigationItem[];
  navExperiments: NavigationItem[];
  navProtocols: NavigationItem[];
  navMacros: NavigationItem[];
}

interface Translations {
  openJII: string;
  logoAlt: string;
  signIn: string;
  experimentsTitle: string;
  protocolTitle: string;
  macrosTitle: string;
}

export function AppSidebar({
  locale,
  navigationData,
  translations,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  locale: string;
  navigationData: NavigationData;
  translations: Translations;
}) {
  const { toggleSidebar, state } = useSidebar();
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const handleSearchClick = () => {
    if (state === "collapsed") {
      toggleSidebar();
      // Focus the input after sidebar opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 200);
    }
  };

  // Convert string-based icons to actual icon components
  const processedNavDashboard = navigationData.navDashboard.map((item) => ({
    ...item,
    icon: iconMap[item.icon as keyof typeof iconMap],
  }));

  const processedNavExperiments = navigationData.navExperiments.map((item) => ({
    ...item,
    icon: iconMap[item.icon as keyof typeof iconMap],
  }));

  const processedNavProtocols = navigationData.navProtocols.map((item) => ({
    ...item,
    icon: iconMap[item.icon as keyof typeof iconMap],
  }));

  const processedNavMacros = navigationData.navMacros.map((item) => ({
    ...item,
    icon: iconMap[item.icon as keyof typeof iconMap],
  }));

  return (
    <Sidebar
      collapsible="icon"
      className="[&_[data-sidebar=sidebar]]:from-sidebar-gradient-from [&_[data-sidebar=sidebar]]:to-sidebar-gradient-to hidden md:flex [&_[data-sidebar=sidebar]]:bg-gradient-to-b"
      {...props}
    >
      <div className="flex flex-col gap-8 pb-8 group-data-[collapsible=icon]:gap-8">
        <div className="flex h-16 items-center justify-between px-4 group-data-[collapsible=icon]:h-16 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-3">
          <Link href={`/${locale}/platform`} className="flex items-center gap-2">
            <Image
              src="/openJII_logo_RGB_horizontal yellow.png"
              alt={translations.logoAlt}
              width={160}
              height={40}
              className="h-auto w-full max-w-[140px] group-data-[collapsible=icon]:hidden"
            />
            <Image
              src="/openJII-logo-vertical-yellow.png"
              alt={translations.logoAlt}
              width={42}
              height={42}
              className="hidden h-[36px] w-auto group-data-[collapsible=icon]:block"
            />
          </Link>
          <SidebarTrigger className="bg-jii-dark-green hover:bg-sidebar-trigger-hover flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white group-data-[state=collapsed]:hidden" />
        </div>
        <div className="relative h-12 px-4 group-data-[collapsible=icon]:px-0">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by keyword..."
            className="placeholder:text-sidebar-search-placeholder h-12 w-full rounded-lg border border-white/10 bg-transparent px-4 pl-10 text-[13px] text-white focus:border-white/20 focus:outline-none group-data-[collapsible=icon]:hidden"
          />
          <Search className="text-sidebar-search-icon absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 group-data-[collapsible=icon]:hidden" />
          <button
            onClick={handleSearchClick}
            className="hidden h-12 w-12 items-center justify-center rounded-lg border border-white/10 text-white transition-colors hover:bg-white/10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:flex"
          >
            <Search className="text-sidebar-search-icon h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-4 px-4 group-data-[collapsible=icon]:gap-4 group-data-[collapsible=icon]:px-0">
          <NavItems items={processedNavDashboard} />
          <NavItems items={processedNavExperiments} />
          <NavItems items={processedNavProtocols} />
          <NavItems items={processedNavMacros} />
        </div>
      </div>
      <SidebarRail />
    </Sidebar>
  );
}
