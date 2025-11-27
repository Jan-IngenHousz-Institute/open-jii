"use client";

import {
  Archive,
  BookOpen,
  CirclePlus,
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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@repo/ui/components";

import { NavItems } from "./nav-items";

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
  create: string;
  protocol: string;
  experiment: string;
  macro: string;

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
  locale: string;
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
    <Sidebar collapsible="icon" className="group-data-[collapsible=icon]:w-[5rem]" {...props}>
      <SidebarHeader>
        <Image
          src="/logo-open-yellow.svg"
          alt={translations.openJII}
          width={48}
          height={12}
          className="mt-2 align-middle group-data-[state=collapsed]:hidden"
        />
        <Image src="/logo-jii-yellow.svg" alt={translations.logoAlt} width={50} height={50} />
      </SidebarHeader>
      <SidebarContent>
        <NavItems items={processedNavDashboard} />
        <NavItems items={processedNavExperiments} />
        <NavItems items={processedNavHardware} />
        <NavItems items={processedNavMacros} />
      </SidebarContent>
      <SidebarFooter className="px-8 pb-6 pt-2 group-data-[collapsible=icon]:px-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="group/btn text-primary hover:border-primary/30 relative flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-md border bg-white px-2 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-white hover:to-gray-50/50 hover:shadow-md active:scale-[0.97] group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:px-2">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full" />
              <CirclePlus
                className="text-primary relative -mt-px h-[15px] w-[15px] shrink-0 transition-all duration-300 group-hover/btn:rotate-180 group-hover/btn:scale-110"
                strokeWidth={2}
              />
              <span className="relative -mt-px group-data-[collapsible=icon]:hidden">
                {translations.create}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="center"
            sideOffset={8}
            className="animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 w-[var(--radix-dropdown-menu-trigger-width)] duration-200"
          >
            <DropdownMenuItem asChild>
              <Link
                href={`/${locale}/platform/protocols/new`}
                className="group/item cursor-pointer text-sm transition-all duration-200 hover:bg-gray-100 hover:pl-3"
              >
                <span className="transition-transform duration-200 group-hover/item:translate-x-1">
                  {translations.protocol}
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={`/${locale}/platform/experiments/new`}
                className="group/item cursor-pointer text-sm transition-all duration-200 hover:bg-gray-100 hover:pl-3"
              >
                <span className="transition-transform duration-200 group-hover/item:translate-x-1">
                  {translations.experiment}
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={`/${locale}/platform/macros/new`}
                className="group/item cursor-pointer text-sm transition-all duration-200 hover:bg-gray-100 hover:pl-3"
              >
                <span className="transition-transform duration-200 group-hover/item:translate-x-1">
                  {translations.macro}
                </span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
