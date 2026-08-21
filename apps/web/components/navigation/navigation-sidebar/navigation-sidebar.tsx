"use client";

import { CommandKHint } from "@/components/command/kbd";
import { COMMAND_PALETTE_OPEN_EVENT } from "@/components/shortcuts/shortcuts-root";
import { WhatsNewFooterItem } from "@/components/whats-new/whats-new-footer-item";
import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "@repo/cms";
import { Button } from "@repo/ui/components/button";
import { Sidebar, SidebarRail, SidebarTrigger } from "@repo/ui/components/sidebar";

import { NavItems } from "../nav-items/nav-items";
import { iconMap } from "../navigation-config";

function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));
}

interface NavigationItem {
  title: string;
  url: string;
  icon?: string;
  isActive?: boolean;
  navigable?: boolean;
  items?: {
    title: string;
    url: string;
  }[];
  children?: NavigationItem[];
}

interface NavigationData {
  navDashboard: NavigationItem[];
  navExperiments: NavigationItem[];
  navDevices: NavigationItem[];
  navWorkbooks: NavigationItem[];
  navOrganizations: NavigationItem[];
  navLibrary: NavigationItem[];
}

interface Translations {
  openJII: string;
  logoAlt: string;
  signIn: string;
  experimentsTitle: string;
  libraryTitle: string;
  workbooksTitle: string;
  organizationsTitle: string;
}

export function AppSidebar({
  locale,
  navigationData,
  translations,
  releaseNotes = [],
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  locale: string;
  navigationData: NavigationData;
  translations: Translations;
  releaseNotes?: ReleaseNoteFields[];
}) {
  // const { toggleSidebar, state } = useSidebar();
  // const searchInputRef = React.useRef<HTMLInputElement>(null);

  // const handleSearchClick = () => {
  //   if (state === "collapsed") {
  //     toggleSidebar();
  //     // Focus the input after sidebar opens
  //     setTimeout(() => {
  //       searchInputRef.current?.focus();
  //     }, 200);
  //   }
  // };

  // Convert string-based icons to actual icon components
  type MappedNavItem = Omit<NavigationItem, "icon" | "children"> & {
    icon?: (typeof iconMap)[keyof typeof iconMap];
    children?: MappedNavItem[];
  };

  const mapItem = (item: NavigationItem): MappedNavItem => ({
    ...item,
    icon: item.icon ? iconMap[item.icon as keyof typeof iconMap] : undefined,
    children: item.children?.map(mapItem),
  });

  const processedNavDashboard = navigationData.navDashboard.map(mapItem);
  const processedNavExperiments = navigationData.navExperiments.map(mapItem);
  const processedNavDevices = navigationData.navDevices.map(mapItem);
  const processedNavWorkbooks = navigationData.navWorkbooks.map(mapItem);
  const processedNavOrganizations = navigationData.navOrganizations.map(mapItem);
  const processedNavLibrary = navigationData.navLibrary.map(mapItem);

  return (
    <Sidebar collapsible="hidden" className="hidden md:flex" {...props}>
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href={`/${locale}/platform`} className="flex items-center gap-2">
            <Image
              src="/openJII_logo_RGB_horizontal_yellow_transparentBG.png"
              alt={translations.logoAlt}
              width={116}
              height={34}
              className="h-auto w-full max-w-[120px]"
            />
          </Link>
          <SidebarTrigger className="bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" />
        </div>

        <div className="px-4 pb-2">
          <Button
            type="button"
            variant="ghost"
            onClick={openCommandPalette}
            aria-label="Open command palette"
            className="border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring h-9 w-full justify-start gap-2 border px-3 text-left font-normal"
          >
            <Search className="size-4 shrink-0" />
            <span className="flex-1 truncate">Search…</span>
            <CommandKHint />
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <NavItems items={processedNavDashboard} />
          <NavItems items={processedNavExperiments} />
          <NavItems items={processedNavDevices} />
          <NavItems items={processedNavWorkbooks} />
          <NavItems items={processedNavOrganizations} />
          <NavItems items={processedNavLibrary} />
        </div>

        <div className="border-sidebar-border border-t px-4 py-2">
          <WhatsNewFooterItem entries={releaseNotes} />
        </div>
      </div>
      <SidebarRail resizable />
    </Sidebar>
  );
}
