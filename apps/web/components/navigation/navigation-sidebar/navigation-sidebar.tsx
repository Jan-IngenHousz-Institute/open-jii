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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
} from "@repo/ui/components/sidebar";

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

  // Kept as six named sections though they render as one flat list: each holds a
  // single top-level row, so a label would only repeat the row beneath it, and the
  // docs sidebar this follows separates sections with a label rather than with air.
  const sections: { key: string; items: MappedNavItem[] }[] = [
    { key: "dashboard", items: navigationData.navDashboard.map(mapItem) },
    { key: "experiments", items: navigationData.navExperiments.map(mapItem) },
    { key: "devices", items: navigationData.navDevices.map(mapItem) },
    { key: "workbooks", items: navigationData.navWorkbooks.map(mapItem) },
    { key: "organizations", items: navigationData.navOrganizations.map(mapItem) },
    { key: "library", items: navigationData.navLibrary.map(mapItem) },
  ];

  return (
    <Sidebar collapsible="hidden" className="hidden md:flex" {...props}>
      <SidebarHeader className="gap-3 p-4 pb-2">
        {/* SidebarHeader is a column, so the brand row is laid out here. */}
        <div className="flex items-center gap-2">
          <Link href={`/${locale}/platform`} className="flex min-w-0 items-center gap-2">
            <Image
              src="/openJII_logo_RGB_horizontal_green_yellow_trimmed.svg"
              alt={translations.logoAlt}
              width={170}
              height={50}
              className="h-7 w-auto dark:hidden"
            />
            <Image
              src="/openJII_logo_RGB_horizontal_yellow_transparentBG.png"
              alt={translations.logoAlt}
              width={170}
              height={50}
              className="hidden h-7 w-auto dark:block"
            />
          </Link>
          <SidebarTrigger className="ml-auto shrink-0" />
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={openCommandPalette}
          aria-label="Open command palette"
          className="border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring w-full justify-start gap-2 rounded-lg border p-2 text-left font-normal"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 truncate">Search…</span>
          <CommandKHint />
        </Button>
      </SidebarHeader>

      {/* The docs sidebar puts its padding on the body and none on the sections. */}
      <SidebarContent className="p-4 pt-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <NavItems items={sections.flatMap((section) => section.items)} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4 pt-2">
        <WhatsNewFooterItem entries={releaseNotes} />
      </SidebarFooter>
      <SidebarRail resizable />
    </Sidebar>
  );
}
