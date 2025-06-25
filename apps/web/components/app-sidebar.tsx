"use client";

import { Archive, FileSliders, Microscope, RadioReceiver, Webcam } from "lucide-react";
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
import { NavUser } from "./nav-user";

interface UserData {
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
  navExperiments: NavigationItem[];
  navHardware: NavigationItem[];
}

interface Translations {
  openJII: string;
  logoAlt: string;
  signIn: string;
  experimentsTitle: string;
  hardwareTitle: string;
}

// Icon mapping for string-based icons
const iconMap = {
  Microscope,
  Archive,
  Webcam,
  FileSliders,
  RadioReceiver,
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
  // Convert string-based icons to actual icon components
  const processedNavExperiments = navigationData.navExperiments.map((item) => ({
    ...item,
    icon: iconMap[item.icon as keyof typeof iconMap],
  }));

  const processedNavHardware = navigationData.navHardware.map((item) => ({
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
        <NavItems items={processedNavExperiments} title={translations.experimentsTitle} />
        <NavItems items={processedNavHardware} title={translations.hardwareTitle} />
      </SidebarContent>
      <SidebarFooter>
        {user ? (
          <NavUser
            user={{
              name: user.name ?? "User",
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
