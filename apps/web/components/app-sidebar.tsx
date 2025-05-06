"use client";

import {
  Archive,
  FileSliders,
  Microscope,
  RadioReceiver,
  Webcam,
} from "lucide-react";
import Image from "next/image";
import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@repo/ui/sidebar";

import { NavItems } from "./nav-items";
import { NavUser } from "./nav-user";

// This is sample data.
const data = {
  user: {
    name: "Jan IngenHousz",
    email: "jan@openjii.org",
    avatar: "/avatars/shadcn.jpg",
  },
  navExperiments: [
    {
      title: "Experiments",
      url: "#",
      icon: Microscope,
      isActive: true,
      items: [
        {
          title: "Public",
          url: "/openjii/experiments?category=public",
        },
        {
          title: "Private",
          url: "/openjii/experiments?category=private",
        },
      ],
    },
    {
      title: "Archive",
      url: "#",
      icon: Archive,
      items: [
        {
          title: "Public",
          url: "#",
        },
        {
          title: "Private",
          url: "#",
        },
      ],
    },
  ],
  navHardware: [
    {
      title: "Sensors",
      url: "#",
      icon: Webcam,
      items: [
        {
          title: "MultispeQ",
          url: "#",
        },
      ],
    },
    {
      title: "Protocols",
      url: "#",
      icon: FileSliders,
      items: [
        {
          title: "Protocol 1",
          url: "#",
        },
      ],
    },
    {
      title: "Other devices",
      url: "#",
      icon: RadioReceiver,
      items: [
        {
          title: "Other device 1",
          url: "#",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/openjii/">
                <Image src="/logo.png" alt="JII logo" width={50} height={50} />
                <span className="text-base font-semibold">openJII</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavItems items={data.navExperiments} title="Experiments" />
        <NavItems items={data.navHardware} title="Hardware" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
