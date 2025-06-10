"use client";

import {
  Archive,
  FileSliders,
  Microscope,
  RadioReceiver,
  Webcam,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import { useTranslation } from "@repo/i18n/client";
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

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: UserData | null;
}) {
  const { t, i18n } = useTranslation(undefined, "navigation");
  const { t: tAuth } = useTranslation(undefined, "common");
  const locale = i18n.language;

  // Navigation data with translations
  const data = {
    navExperiments: [
      {
        title: t("sidebar.experiments"),
        url: "#",
        icon: Microscope,
        isActive: true,
        items: [
          {
            title: t("sidebar.newExperiment"),
            url: `/${locale}/platform/experiments/new`,
          },
          {
            title: t("sidebar.overview"),
            url: `/${locale}/platform/experiments`,
          },
        ],
      },
      {
        title: t("sidebar.archive"),
        url: "#",
        icon: Archive,
        items: [
          {
            title: t("sidebar.public"),
            url: "#",
          },
          {
            title: t("sidebar.private"),
            url: "#",
          },
        ],
      },
    ],
    navHardware: [
      {
        title: t("sidebar.sensors"),
        url: "#",
        icon: Webcam,
        items: [
          {
            title: t("sidebar.multispeq"),
            url: "#",
          },
        ],
      },
      {
        title: t("sidebar.protocols"),
        url: "#",
        icon: FileSliders,
        items: [
          {
            title: t("sidebar.protocol1"),
            url: "#",
          },
        ],
      },
      {
        title: t("sidebar.otherDevices"),
        url: "#",
        icon: RadioReceiver,
        items: [
          {
            title: t("sidebar.otherDevice1"),
            url: "#",
          },
        ],
      },
    ],
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {" "}
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href={`/${locale}/platform/`}>
                <Image src="/logo.png" alt="JII logo" width={50} height={50} />
                <span className="text-base font-semibold">openJII</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavItems
          items={data.navExperiments}
          title={t("sidebar.experiments")}
        />
        <NavItems items={data.navHardware} title={t("sidebar.hardware")} />
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
              <SidebarMenuButton
                asChild
                className="data-[slot=sidebar-menu-button]:!p-1.5"
              >
                <Link href={`/${locale}/`}>
                  <span className="text-base font-semibold">
                    {tAuth("signIn")}
                  </span>
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
