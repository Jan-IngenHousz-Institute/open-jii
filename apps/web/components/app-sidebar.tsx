"use client";

import {
  Archive,
  BookOpen,
  Code,
  FileSliders,
  Home,
  LogIn,
  Microscope,
  RadioReceiver,
  Webcam,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import type { Locale } from "@repo/i18n";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
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
  navHardware: NavigationItem[];
  navMacros: NavigationItem[];
}

interface Translations {
  openJII: string;
  logoAlt: string;
  signIn: string;

  experimentsTitle: string;
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
        <span className="text-highlight text-xl font-semibold group-data-[state=collapsed]:hidden">
          open
        </span>
        <Image src="/logo-platform-yellow.svg" alt={translations.logoAlt} width={50} height={50} />
      </SidebarHeader>
      <SidebarContent>
        <NavItems items={processedNavDashboard} />
        <NavItems items={processedNavExperiments} />
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
          <SidebarMenuButton
            asChild
            tooltip={translations.signIn}
            className="group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!gap-0 group-data-[collapsible=icon]:!px-0"
          >
            <Link href="/" locale={locale}>
              <LogIn className="group-data-[collapsible=icon]:mx-auto" />
              <span className="text-base font-semibold group-data-[collapsible=icon]:hidden">
                {translations.signIn}
              </span>
            </Link>
          </SidebarMenuButton>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
