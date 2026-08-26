"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { mainNavigation, userNavigation, iconMap } from "@/components/navigation/navigation-config";
import { NavigationMobileNavItem } from "@/components/navigation/navigation-mobile-nav-item/navigation-mobile-nav-item";
import { ActivityPopover } from "@/components/navigation/navigation-topbar/activity-popover";
import { WhatsNewFooterItem } from "@/components/whats-new/whats-new-footer-item";
import { Menu, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState } from "react";
import { useSignOut } from "~/hooks/auth/useSignOut/useSignOut";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { User } from "@repo/auth/types";
import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "@repo/cms";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
import { SidebarTrigger, useSidebar } from "@repo/ui/components/sidebar";
import { ThemeToggle } from "@repo/ui/components/theme";

import { NavUser } from "../nav-user/nav-user";

interface NavigationTopbarProps {
  locale: string;
  user: User;
  releaseNotes?: ReleaseNoteFields[];
}

export function NavigationTopbar({ locale, user, releaseNotes = [] }: NavigationTopbarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMultiLanguageEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);
  const isDevicesEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.IOT_DEVICES);
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
  const allNavItems = Object.entries(mainNavigation)
    .filter(([key]) => key !== "devices" || isDevicesEnabled)
    .map(([, nav]) => nav)
    .flatMap((nav) => {
      if ("children" in nav && nav.children.length > 0 && nav.navigable === false) {
        return nav.children.map((child) => ({
          title: t(child.titleKey, { ns: child.namespace }),
          url: child.url(locale),
          icon: child.icon,
        }));
      }
      return {
        title: t(nav.titleKey, { ns: nav.namespace }),
        url: nav.url(locale),
        icon: nav.icon,
      };
    });

  return (
    <>
      <header
        className="bg-card sticky z-40 flex h-16 w-full items-center gap-2 border-b px-4"
        style={{ top: "var(--banner-offset, 0px)" }}
      >
        <div className="flex w-full items-center gap-2">
          {state === "collapsed" && <SidebarTrigger className="hidden md:flex" />}

          <Link href={`/${locale}/platform`} className="md:hidden">
            <Image
              src="/openJII_logo_RGB_horizontal_green_yellow_trimmed.svg"
              alt="JII Logo"
              width={170}
              height={50}
              className="h-9 w-auto dark:hidden"
            />
            <Image
              src="/openJII_logo_RGB_horizontal_yellow_transparentBG.png"
              alt="JII Logo"
              width={170}
              height={50}
              className="hidden h-9 w-auto dark:block"
            />
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {/* Activity bell - OJD-1506 */}
            <ActivityPopover />

            {/* Light / dark / system, in the bell's own treatment. */}
            <ThemeToggle className="text-foreground/70 hover:text-foreground" />

            <div className="hidden items-center gap-2 md:flex">
              {/* Language Switcher */}
              <LanguageSwitcher locale={locale} />

              {/* User Dropdown */}
              <NavUser
                user={{
                  id: user.id,
                  email: user.email,
                }}
                locale={locale}
                compact
              />
            </div>

            {/* Mobile: Hamburger menu. Sized to the bell rather than to stock
                `size="icon"`, so the three controls read as one set. */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
              className="text-primary md:hidden"
            >
              <Menu className="size-[18px]" />
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
            <div className="bg-sidebar text-sidebar-foreground flex min-h-screen flex-col">
              {/* Header */}
              <SheetHeader className="flex flex-row items-center justify-between px-4 pb-6 pt-4">
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <SheetDescription className="sr-only">Navigation menu</SheetDescription>
                <Image
                  src="/openJII_logo_RGB_horizontal_green_yellow_trimmed.svg"
                  alt="JII Logo"
                  width={170}
                  height={50}
                  className="h-9 w-auto dark:hidden"
                />
                <Image
                  src="/openJII_logo_RGB_horizontal_yellow_transparentBG.png"
                  alt="JII Logo"
                  width={170}
                  height={50}
                  className="hidden h-9 w-auto dark:block"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground h-auto w-auto p-2"
                >
                  <X className="!h-6 !w-6" />
                </Button>
              </SheetHeader>

              <div className="flex flex-1 flex-col justify-between">
                <div>
                  {/* Search Bar */}
                  <div className="relative h-12 px-4 pb-4">
                    <Input
                      type="text"
                      placeholder="Search by keyword..."
                      className="border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/50 h-12 w-full rounded-lg px-4 pl-10 text-[13px] md:text-[13px]"
                    />
                    <Search className="text-sidebar-foreground/60 absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2" />
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
                            isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/80"
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
                  <div className="space-y-1 py-2 pb-8">
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
                        <div className="text-sidebar-foreground/80 mx-4 flex w-full items-center justify-between rounded-lg py-3">
                          <span className="font-medium">{t("common.language")}</span>
                          <span className="text-sidebar-foreground/60 text-sm">
                            {locale.toUpperCase()}
                          </span>
                        </div>
                        {availableLocales.map((loc) => (
                          <Link
                            key={loc.code}
                            href={`/${loc.code}/platform`}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`mx-4 flex w-full items-center justify-between rounded-lg py-2.5 pl-4 transition-colors ${
                              locale === loc.code
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/70"
                            }`}
                          >
                            <span className="text-sm">{loc.name}</span>
                          </Link>
                        ))}
                      </>
                    )}

                    {/* Sign Out */}
                    <Button
                      variant="ghost"
                      onClick={handleSignOut}
                      disabled={signOut.isPending}
                      className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mx-4 h-auto w-full justify-start rounded-lg px-0 py-3 transition-colors"
                    >
                      <span className="font-medium">
                        {t("navigation.logout", {
                          ns: "navigation",
                        })}
                      </span>
                    </Button>
                  </div>
                </div>

                <div className="border-sidebar-border border-t py-3">
                  <WhatsNewFooterItem
                    entries={releaseNotes}
                    onOpen={() => setIsMobileMenuOpen(false)}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
