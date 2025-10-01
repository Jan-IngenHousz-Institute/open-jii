"use client";

import {
  Archive,
  BookOpen,
  Code,
  FileSliders,
  Home,
  Microscope,
  RadioReceiver,
  Webcam,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import type { Locale } from "@repo/i18n";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@repo/ui/components";

import { NavItems } from "./nav-items";
import { NavUser } from "./nav-user/nav-user";

interface UserData {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface NavigationItem {
  title: string;
  url: string;
  icon: string | LucideIcon;
  isActive?: boolean;
  items: {
    title: string;
    url: string;
  }[];
}

interface NavigationData {
  navDashboard: NavigationItem[];
  navExperiments: NavigationItem[];
  navExperimentsArchive?: NavigationItem[];
  navHardware: NavigationItem[];
  navMacros: NavigationItem[];
}

interface Translations {
  openJII: string;
  logoAlt: string;
  signIn: string;

  experimentsTitle: string;
  experimentsArchiveTitle: string;
  hardwareTitle: string;
  macrosTitle: string;
}

// Icon mapping for string-based icons
const iconMap = {
  Home,
  BookOpen,
  Microscope,
  Archive,
  Webcam,
  FileSliders,
  RadioReceiver,
  Code,
} as const;

export function AppSidebar({
  user,
  locale,
  navigationData,
  translations,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: UserData | null;
  locale: Locale;
  navigationData: NavigationData;
  translations: Translations;
}) {
  const processedNavDashboard = navigationData.navDashboard.map((item) => ({
    ...item,
    icon: iconMap[item.icon as keyof typeof iconMap],
  }));

  // Convert string-based icons to actual icon components
  const processedNavExperiments = navigationData.navExperiments.map((item) => ({
    ...item,
    icon: iconMap[item.icon as keyof typeof iconMap],
  }));

  const processedNavExperimentsArchive =
    navigationData.navExperimentsArchive?.map((item) => ({
      ...item,
      icon: iconMap[item.icon as keyof typeof iconMap],
    })) ?? [];

  const processedNavHardware = navigationData.navHardware.map((item) => ({
    ...item,
    icon: iconMap[item.icon as keyof typeof iconMap],
  }));

  const processedNavMacros = navigationData.navMacros.map((item) => ({
    ...item,
    icon: iconMap[item.icon as keyof typeof iconMap],
  }));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link href={`/platform/`} locale={locale}>
                <Image src="/logo.png" alt={translations.logoAlt} width={50} height={50} />
                <span className="text-base font-semibold">{translations.openJII}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavItems items={processedNavDashboard} />
        <NavItems items={processedNavExperiments} />
        {processedNavExperimentsArchive.length > 0 && (
          <NavItems items={processedNavExperimentsArchive} />
        )}
        <NavItems items={processedNavHardware} />
        <NavItems items={processedNavMacros} />
      </SidebarContent>
      <SidebarFooter>
        {user ? (
          <NavUser
            locale={locale}
            user={{
              id: user.id ?? "",
              email: user.email ?? "",
              avatar: user.image ?? "/avatars/default.jpg",
            }}
          />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
                <Link href="/" locale={locale}>
                  <span className="text-base font-semibold">{translations.signIn}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
