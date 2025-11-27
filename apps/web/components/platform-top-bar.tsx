"use client";

import { Bell, ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import type { User } from "@repo/auth/types";
import { useTranslation } from "@repo/i18n";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  SidebarTrigger,
} from "@repo/ui/components";

import { useGetUserProfile } from "../hooks/profile/useGetUserProfile/useGetUserProfile";
import { LanguageSwitcher } from "./language-switcher";

interface PlatformTopBarProps {
  locale: string;
  user: User;
}

export function PlatformTopBar({ locale, user }: PlatformTopBarProps) {
  const { t } = useTranslation();

  // Fetch user profile for first/last name
  const { data: userProfile } = useGetUserProfile(user.id);
  const userProfileBody = userProfile?.body;
  const displayName =
    userProfileBody?.firstName && userProfileBody.lastName
      ? `${userProfileBody.firstName} ${userProfileBody.lastName}`
      : (user.name ?? user.email ?? "");

  const initials = React.useMemo(() => {
    if (userProfileBody?.firstName && userProfileBody.lastName) {
      return `${userProfileBody.firstName[0]}${userProfileBody.lastName[0]}`.toUpperCase();
    }
    if (user.name) {
      const parts = user.name.split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return user.name.substring(0, 2).toUpperCase();
    }
    return "U";
  }, [userProfileBody, user.name]);

  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center gap-2 border-b bg-white px-4">
      <div className="flex w-full items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4" />
        <Link href={`/${locale}/platform`}>
          <Image
            src="/openJII_logo_RGB_horizontal.svg"
            alt="JII Logo"
            width={160}
            height={75}
            className="h-16 w-auto"
          />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {/* Notifications */}
          <Button variant="ghost" size="icon" aria-label={t("common.common.notifications")}>
            <Bell className="h-5 w-5" />
          </Button>

          {/* Language Switcher */}
          <LanguageSwitcher locale={locale} />

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.image ?? undefined} alt={displayName} />
                  <AvatarFallback className="text-sm">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium lg:inline">{initials}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image ?? undefined} alt={displayName} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-sm font-medium">{displayName}</p>
                    <p className="text-muted-foreground text-xs">{user.email}</p>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/platform/account/settings`}>{t("auth.account")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/platform/signout`}>{t("navigation.logout")}</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
