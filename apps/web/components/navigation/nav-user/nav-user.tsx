"use client";

import { ChevronsUpDown, LifeBuoy, LogOut, MessageCircleQuestion } from "lucide-react";
import { User as UserIcon } from "lucide-react";
import Link from "next/link";
import { env } from "~/env";

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
} from "@repo/ui/components";

interface NavUserProps {
  user: {
    id: string;
    email: string;
    avatar: string;
  };
  locale: string;
}

function UserAvatar({ avatar, displayName }: { avatar: string; displayName: string }) {
  // Get initials from display name
  const getInitials = () => {
    if (!displayName) return "";

    const names = displayName.trim().split(/\s+/);
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  };

  return (
    <Avatar className="h-8 w-8">
      <AvatarImage src={avatar} alt={displayName} />
      <AvatarFallback>{getInitials()}</AvatarFallback>
    </Avatar>
  );
}

function UserInfo({ displayName, email }: { displayName: string; email: string }) {
  return (
    <div className="flex flex-col space-y-0.5">
      <p className="text-sm font-medium">{displayName}</p>
      <p className="text-muted-foreground text-xs">{email}</p>
    </div>
  );
}

function MenuItems({
  locale,
  t,
}: {
  locale: string;
  t: (key: string, options?: { ns?: string }) => string;
}) {
  return (
    <>
      {Object.values(userNavigation).map((item) => {
        const Icon = iconMap[item.icon as keyof typeof iconMap];
        return (
          <DropdownMenuItem key={item.titleKey} asChild>
            <Link href={item.url(locale)} className="flex w-full cursor-default items-center">
              <Icon className="mr-2 h-4 w-4" />
              {t(item.titleKey, { ns: item.namespace })}
            </Link>
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

export function NavUser({ user, locale }: NavUserProps) {
  const { t } = useTranslation();

  const { data: userProfile } = useGetUserProfile(user.id);
  const userProfileBody = userProfile?.body;
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
                <AvatarFallback className="rounded-lg">JII</AvatarFallback>
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
                href={env.NEXT_PUBLIC_DOCS_URL}
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
