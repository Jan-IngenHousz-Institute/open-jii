"use client";

import { ChevronsUpDown, LifeBuoy, LogOut, MessageCircleQuestion } from "lucide-react";
import { User as UserIcon } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@repo/i18n";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/ui/components";

import { useGetUserProfile } from "../../hooks/profile/useGetUserProfile/useGetUserProfile";

export function NavUser({
  user,
  locale,
}: {
  user: {
    id: string;
    email: string;
    avatar: string;
  };
  locale: string;
}) {
  const { isMobile } = useSidebar();
  const { t } = useTranslation();

  // Fetch user profile for first/last name
  const { data: userProfile } = useGetUserProfile(user.id);
  const userProfileBody = userProfile?.body;
  // Prefer profile name if available
  const displayName =
    userProfileBody?.firstName && userProfileBody.lastName
      ? `${userProfileBody.firstName} ${userProfileBody.lastName}`
      : "";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg group-data-[collapsible=icon]:ml-2">
                <AvatarImage src={user.avatar} alt={displayName} />
                <AvatarFallback className="rounded-lg">
                  {displayName ? displayName.substring(0, 2).toUpperCase() : "JII"}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg group-data-[collapsible=icon]:ml-2">
                  <AvatarImage src={user.avatar} alt={displayName} />
                  <AvatarFallback className="rounded-lg">
                    {displayName ? displayName.substring(0, 2).toUpperCase() : "JII"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {/* ACCOUNT */}
            <DropdownMenuItem asChild>
              <Link
                href={`/${locale}/platform/account/settings`}
                className="flex w-full cursor-default items-center"
              >
                <Avatar className="bg-muted mr-2 h-4 w-4">
                  <AvatarFallback className="rounded-lg">
                    <UserIcon className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                {t("auth.account")}
              </Link>
            </DropdownMenuItem>

            {/* SUPPORT */}
            <DropdownMenuItem asChild>
              <Link
                href="https://docs.openjii.org"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full cursor-default items-center"
              >
                <Avatar className="bg-muted mr-2 h-4 w-4">
                  <AvatarFallback className="rounded-lg">
                    <LifeBuoy className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                {t("navigation.support")}
              </Link>
            </DropdownMenuItem>

            {/* FAQ */}
            <DropdownMenuItem asChild>
              <Link href={`/${locale}/faq`} className="flex w-full cursor-default items-center">
                <Avatar className="bg-muted mr-2 h-4 w-4">
                  <AvatarFallback className="rounded-lg">
                    <MessageCircleQuestion className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                {t("navigation.faq")}
              </Link>
            </DropdownMenuItem>

            {/* SIGN OUT */}
            <DropdownMenuItem asChild>
              <Link
                href={`/${locale}/platform/signout`}
                className="flex w-full cursor-default items-center"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t("navigation.logout")}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
