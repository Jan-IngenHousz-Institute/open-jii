"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import {
  mainNavigation,
  userNavigation,
  createNavigation,
  iconMap,
} from "@/components/navigation/navigation-config";
import { useGetUserProfile } from "@/hooks/profile/useGetUserProfile/useGetUserProfile";
import { Bell, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState } from "react";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { User } from "@repo/auth/types";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ScrollArea,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SidebarTrigger,
} from "@repo/ui/components";

import { NavUser } from "../nav-user/nav-user";

interface NavigationTopbarProps {
  locale: string;
  user: User;
}

export function NavigationTopbar({ locale, user }: NavigationTopbarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMultiLanguageEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

  const { data: userProfile } = useGetUserProfile(user.id);
  const userProfileBody = userProfile?.body;
  const displayName =
    userProfileBody?.firstName && userProfileBody.lastName
      ? `${userProfileBody.firstName} ${userProfileBody.lastName}`
      : (user.email ?? "User");

  // Language options
  const allLocales = [
    { code: "en", name: "English" },
    { code: "de", name: "Deutsch" },
  ];

  const availableLocales = isMultiLanguageEnabled
    ? allLocales
    : allLocales.filter((l) => l.code === "en");

  // Build navigation items from config for mobile
  const allNavItems = Object.values(mainNavigation).map((nav) => ({
    title: t(nav.titleKey, { ns: nav.namespace }),
    url: nav.url(locale),
    icon: nav.icon,
  }));

  return (
    <>
      <header className="fixed top-0 z-50 flex h-16 w-full items-center gap-2 border-b bg-white px-4">
        <div className="flex w-full items-center gap-2">
          {/* Desktop: Sidebar trigger and separator */}
          <SidebarTrigger className="-ml-1 hidden md:flex" />
          <Separator orientation="vertical" className="mx-2 hidden h-4 md:flex" />

          <Link href={`/${locale}/platform`}>
            <Image
              src="/openJII_logo_RGB_horizontal.svg"
              alt="JII Logo"
              width={160}
              height={75}
              className="hidden h-16 w-auto md:block"
            />
            <Image
              src="/openJII-logo-vertical-yellow.svg"
              alt="JII Logo"
              width={40}
              height={40}
              className="h-10 w-auto md:hidden"
            />
          </Link>

          {/* Desktop: Full navigation */}
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.notifications")}
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

          {/* Mobile: Hamburger menu */}
          <div className="ml-auto flex md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Sheet */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-full border-0 p-0 md:hidden"
          onInteractOutside={() => setIsMobileMenuOpen(false)}
        >
          <ScrollArea className="h-screen w-full">
            <div className="flex min-h-screen flex-col bg-[#0f3d3e]">
              {/* Header */}
              <SheetHeader className="flex flex-row items-center justify-between border-b border-white/10 px-6 py-4">
                <SheetTitle className="text-xl font-semibold text-white">
                  Hi, {displayName.split(" ")[0]}
                </SheetTitle>
                <SheetDescription className="sr-only">Navigation menu</SheetDescription>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-white hover:bg-white/10"
                >
                  <X className="h-6 w-6" />
                </Button>
              </SheetHeader>

              <div className="flex flex-1 flex-col justify-between">
                <div>
                  {/* Navigation Items */}
                  <nav className="space-y-1 px-4 py-6">
                    {allNavItems.map((item) => {
                      const Icon = iconMap[item.icon as keyof typeof iconMap];
                      // Same active logic as desktop sidebar
                      const itemSegments = item.url.split("/").filter((s) => s.length > 0);
                      const isActive =
                        pathname === item.url ||
                        (pathname.startsWith(item.url + "/") && itemSegments.length > 2);

                      return (
                        <Link
                          key={item.title}
                          href={item.url}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-white/5 hover:text-white ${
                            isActive ? "text-white" : "text-white/80"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className={isActive ? "font-extrabold underline" : "font-medium"}>
                            {item.title}
                          </span>
                        </Link>
                      );
                    })}
                  </nav>

                  {/* Settings Section */}
                  <div className="space-y-1 px-2 py-2">
                    {/* Notifications */}
                    <button
                      disabled
                      className="flex w-full cursor-default items-center rounded-lg px-4 py-3 text-white/40"
                    >
                      <span className="font-medium">{t("common.notifications")}</span>
                    </button>

                    {/* Language */}
                    {availableLocales.length > 1 && (
                      <>
                        <div className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-white/80">
                          <span className="font-medium">{t("common.language")}</span>
                          <span className="text-sm text-white/60">{locale.toUpperCase()}</span>
                        </div>
                        {availableLocales.map((loc) => (
                          <Link
                            key={loc.code}
                            href={`/${loc.code}/platform`}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex w-full items-center justify-between rounded-lg px-4 py-2.5 pl-8 transition-colors ${
                              locale === loc.code
                                ? "bg-white/10 text-white"
                                : "text-white/70 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <span className="text-sm">{loc.name}</span>
                          </Link>
                        ))}
                      </>
                    )}

                    {/* User Navigation Items */}
                    {Object.values(userNavigation).map((item) => (
                      <Link
                        key={item.titleKey}
                        href={item.url(locale)}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex w-full items-center rounded-lg px-4 py-3 text-white/80 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <span className="font-medium">
                          {t(item.titleKey, { ns: item.namespace })}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Create Button - Fixed at bottom */}
                <div className="border-t border-white/10 px-4 py-6 pb-8">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white px-4 text-base font-medium text-[#0f3d3e] transition-all hover:scale-[1.02]">
                        {t(createNavigation.buttonKey, { ns: "common" })}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="top"
                      align="center"
                      className="mx-4 w-[calc(100vw-2rem)]"
                    >
                      {createNavigation.items.map((item) => (
                        <DropdownMenuItem key={item.titleKey} asChild>
                          <Link
                            href={item.url(locale)}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="cursor-pointer py-4 text-base"
                          >
                            {t(item.titleKey, { ns: item.namespace })}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
