"use client";

import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  LifeBuoy,
  LogOut,
  MessageCircleQuestion,
} from "lucide-react";
import { User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { env } from "~/env";
import { useSignOut } from "~/hooks/auth";
import { useGetUserProfile } from "~/hooks/profile/useGetUserProfile/useGetUserProfile";

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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components";

interface NavUserProps {
  user: {
    id: string;
    email: string;
    avatar: string;
  };
  locale: string;
  compact?: boolean;
}

export function NavUser({ user, locale, compact = false }: NavUserProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const signOut = useSignOut();

  const { data: userProfile } = useGetUserProfile(user.id);
  const userProfileBody = userProfile?.body;
  const displayName =
    userProfileBody?.firstName && userProfileBody.lastName
      ? `${userProfileBody.firstName} ${userProfileBody.lastName}`
      : "";

  const handleSignOut = async () => {
    await signOut.mutateAsync();
    router.push("/");
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  if (compact) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex h-10 items-center gap-2 px-2">
            <Avatar className="h-8 w-8 rounded-full">
              <AvatarImage src={user.avatar} alt={displayName} />
              <AvatarFallback className="rounded-full">
                {displayName ? displayName.substring(0, 2).toUpperCase() : "JII"}
              </AvatarFallback>
            </Avatar>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
          side="bottom"
          align="end"
          sideOffset={4}
        >
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 py-1.5 text-left text-sm">
              <Avatar className="h-8 w-8 rounded-lg">
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
          <DropdownMenuItem
            onClick={handleSignOut}
            disabled={signOut.isPending}
            className="flex w-full cursor-default items-center"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("navigation.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

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
              <div className="flex items-center gap-2 py-1.5 text-left text-sm">
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
            <DropdownMenuItem
              onClick={handleSignOut}
              disabled={signOut.isPending}
              className="flex w-full cursor-default items-center"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("navigation.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
