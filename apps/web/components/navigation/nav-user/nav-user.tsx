"use client";

import { userNavigation, iconMap } from "@/components/navigation/navigation-config";
import { useGetUserProfile } from "@/hooks/profile/useGetUserProfile/useGetUserProfile";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="group flex items-center gap-2 hover:bg-transparent hover:opacity-70 data-[state=open]:bg-transparent"
        >
          <UserAvatar avatar={user.avatar} displayName={displayName} />
          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <UserAvatar avatar={user.avatar} displayName={displayName} />
            <UserInfo displayName={displayName} email={user.email} />
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <MenuItems locale={locale} t={t} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
