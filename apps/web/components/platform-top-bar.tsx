"use client";

import { Bell } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { User } from "@repo/auth/types";
import { useTranslation } from "@repo/i18n";
import { Button, Separator, SidebarTrigger } from "@repo/ui/components";

import { LanguageSwitcher } from "./language-switcher";
import { NavUser } from "./nav-user/nav-user";

interface PlatformTopBarProps {
  locale: string;
  user: User;
}

export function PlatformTopBar({ locale, user }: PlatformTopBarProps) {
  const { t } = useTranslation();

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
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.common.notifications")}
            disabled
            className="cursor-default hover:bg-transparent"
          >
            <Bell className="h-5 w-5" />
          </Button>

          {/* Language Switcher */}
          <LanguageSwitcher locale={locale} />

          {/* User Dropdown */}
          <NavUser
            user={{
              id: user.id,
              email: user.email ?? "",
              avatar: user.image ?? "",
            }}
            locale={locale}
          />
        </div>
      </div>
    </header>
  );
}
