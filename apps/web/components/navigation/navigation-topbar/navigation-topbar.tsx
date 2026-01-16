"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { mainNavigation, userNavigation, iconMap } from "@/components/navigation/navigation-config";
import { NavigationMobileNavItem } from "@/components/navigation/navigation-mobile-nav-item/navigation-mobile-nav-item";
import { Bell, Menu, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState } from "react";
import { useSignOut } from "~/hooks/auth";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { User } from "@repo/auth/types";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SidebarTrigger,
  useSidebar,
} from "@repo/ui/components";

import { NavUser } from "../nav-user/nav-user";

interface NavigationTopbarProps {
  locale: string;
  user: User;
}

export function NavigationTopbar({ locale, user }: NavigationTopbarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMultiLanguageEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);
  const { state } = useSidebar();
  const signOut = useSignOut();

  const handleSignOut = async () => {
    setIsMobileMenuOpen(false);
    await signOut.mutateAsync();
    router.push("/");
  };

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
      <header className="sticky top-0 z-40 flex h-16 w-full items-center gap-2 border-b bg-white px-4">
        <div className="flex w-full items-center gap-2">
          {state === "collapsed" && <SidebarTrigger className="hidden md:flex" />}

          <Link href={`/${locale}/platform`} className="md:hidden">
            <Image
              src="/logo-jii-yellow.svg"
              alt="JII Logo"
              width={40}
              height={40}
              className="h-8 w-auto"
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
                email: user.email,
                avatar: user.image ?? "",
              }}
              locale={locale}
              compact
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
            <div className="bg-sidebar-mobile-bg flex min-h-screen flex-col">
              {/* Header */}
              <SheetHeader className="flex flex-row items-center justify-end px-4 pb-2 pt-4">
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <SheetDescription className="sr-only">Navigation menu</SheetDescription>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="h-auto w-auto p-2 text-white hover:bg-white/10"
                >
                  <X className="h-12 w-12" />
                </Button>
              </SheetHeader>

              <div className="flex flex-1 flex-col justify-between">
                <div>
                  {/* Search Bar */}
                  <div className="relative h-12 px-4 pb-4">
                    <input
                      type="text"
                      placeholder="Search by keyword..."
                      className="placeholder:text-sidebar-search-placeholder h-12 w-full rounded-lg border border-white/10 bg-transparent px-4 pl-10 text-[13px] text-white focus:border-white/20 focus:outline-none"
                    />
                    <Search className="text-sidebar-search-icon absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2" />
                  </div>

                  {/* Navigation Items */}
                  <nav className="space-y-1 py-6">
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
                          className={`mx-4 flex items-center gap-3 rounded-lg py-3 transition-colors ${
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

                  {/* Additional Navigation Links */}
                  <div className="space-y-1 py-2">
                    {Object.values(userNavigation).map((item) => (
                      <NavigationMobileNavItem
                        key={item.titleKey}
                        item={item}
                        locale={locale}
                        onItemClick={() => setIsMobileMenuOpen(false)}
                      />
                    ))}

                    {/* Language */}
                    {availableLocales.length > 1 && (
                      <>
                        <div className="mx-4 flex w-full items-center justify-between rounded-lg py-3 text-white/80">
                          <span className="font-medium">{t("common.language")}</span>
                          <span className="text-sm text-white/60">{locale.toUpperCase()}</span>
                        </div>
                        {availableLocales.map((loc) => (
                          <Link
                            key={loc.code}
                            href={`/${loc.code}/platform`}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`mx-4 flex w-full items-center justify-between rounded-lg py-2.5 pl-4 transition-colors ${
                              locale === loc.code ? "bg-white/10 text-white" : "text-white/70"
                            }`}
                          >
                            <span className="text-sm">{loc.name}</span>
                          </Link>
                        ))}
                      </>
                    )}

                    {/* Sign Out */}
                    <button
                      onClick={handleSignOut}
                      disabled={signOut.isPending}
                      className="mx-4 flex w-full items-center rounded-lg py-3 text-white/80 transition-colors disabled:opacity-50"
                    >
                      <span className="font-medium">
                        {t("navigation.logout", {
                          ns: "navigation",
                        })}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
