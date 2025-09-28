"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { User, Home, BookOpen, LogOut, Menu, Sprout } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Session } from "@repo/auth/types";
import type { Locale } from "@repo/i18n";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components";

import { handleLogout } from "../../app/actions/auth";
import { useGetUserProfile } from "../../hooks/profile/useGetUserProfile/useGetUserProfile";

interface UnifiedNavbarProps {
  locale: Locale;
  session: Session | null;
}

// Extract UserMenu as a separate component to prevent re-renders
function UserMenu({
  locale,
  session,
  displayName,
  onSignOut,
}: {
  locale: Locale;
  session: Session | null;
  displayName: string;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();

  if (!session?.user) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex gap-2"
          aria-label={t("auth.userMenu", "User menu")}
        >
          {session.user.image ? (
            <Avatar className="h-6 w-6">
              <AvatarImage src={session.user.image} alt={displayName} />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <User className="h-4 w-4" />
          )}
          <span className="hidden max-w-32 truncate sm:inline">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled>
          <div className="flex w-full items-center gap-3">
            {session.user.image && (
              <Avatar className="h-8 w-8">
                <AvatarImage src={session.user.image} alt={displayName} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{displayName}</span>
              <span className="text-muted-foreground truncate text-xs">{session.user.email}</span>
            </div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Account link */}
        <DropdownMenuItem asChild>
          <Link
            href={`/${locale}/platform/account/settings`}
            className="flex w-full cursor-default items-center"
          >
            <Avatar className="bg-muted mr-2 h-4 w-4">
              <AvatarFallback className="rounded-lg">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            {t("auth.account")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <form action={onSignOut} className="w-full">
            <button type="submit" className="flex w-full cursor-pointer items-center">
              <LogOut className="mr-2 h-4 w-4" />
              {t("auth.signOut", "Sign Out")}
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UnifiedNavbar({ locale, session }: UnifiedNavbarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();

  const { data: userProfile } = useGetUserProfile(session?.user.id ?? "");
  const profile = userProfile?.body;
  const displayName =
    profile?.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : "";

  const handleSignOut = () => {
    return handleLogout({
      redirectTo: pathname.includes("/platform") ? `/${locale}` : pathname,
    });
  };

  // Navigation items
  const navItems = useMemo(
    () => [
      {
        href: `/${locale}`,
        label: t("navigation.home", "Home"),
        icon: Home,
        isActive: pathname === `/${locale}`,
      },
      {
        href: `/${locale}/about`,
        label: t("navigation.about", "About"),
        icon: User,
        isActive: pathname.startsWith(`/${locale}/about`),
      },
      {
        href: `/${locale}/blog`,
        label: t("navigation.blog", "Blog"),
        icon: BookOpen,
        isActive: pathname.startsWith(`/${locale}/blog`),
      },
      {
        href: `/${locale}/platform`,
        label: t("navigation.platform", "Platform"),
        icon: Sprout,
        isActive:
          pathname.startsWith(`/${locale}/platform`) ||
          pathname.startsWith(`/${locale}/login`) ||
          pathname.startsWith(`/${locale}/register`) ||
          pathname.startsWith(`/api/auth/verify-request`) ||
          pathname.startsWith(`/${locale}/verify-request`),
      },
    ],
    [locale, t, pathname],
  );

  // Absolute positioning for overlay effect on the pages below
  const isOverlay =
    pathname.startsWith(`/${locale}/platform`) ||
    pathname.startsWith(`/${locale}/login`) ||
    pathname.startsWith(`/${locale}/register`) ||
    pathname.startsWith(`/api/auth/verify-request`) ||
    pathname.startsWith(`/${locale}/verify-request`);

  const isLightNavbar =
    pathname === `/` ||
    pathname === `/${locale}` ||
    pathname.startsWith(`/${locale}/about`) ||
    pathname.startsWith(`/${locale}/blog`);

  return (
    <header
      className={`z-50 w-full ${
        isOverlay
          ? "pointer-events-auto absolute left-0 top-0 bg-gradient-to-b from-black/80 to-transparent text-white"
          : isLightNavbar
            ? "border-border sticky top-0 border-b bg-white/60 text-black backdrop-blur-md"
            : "sticky top-0 bg-gradient-to-b from-black/80 to-transparent text-white"
      }`}
    >
      <nav
        className={`font-notosans container mx-auto grid h-16 grid-cols-3 items-center px-4 ${
          isLightNavbar ? "text-black" : "text-white"
        }`}
      >
        {/* Logo/Brand */}
        <div className="col-start-1 col-end-2 flex items-center">
          <Link
            href={`/${locale}`}
            className="flex items-center space-x-2 text-white transition-opacity hover:opacity-80"
          >
            <Image
              src={
                isLightNavbar
                  ? "/jan-ingenhousz-institute-logo-header.png"
                  : "/jan-ingenhousz-institute-logo-header-light.png"
              }
              alt="Jan IngenHousz Institute Logo"
              height={32}
              width={180}
              className="h-8 w-auto"
              priority
            />
          </Link>
        </div>

        {/* Navigation Links - Desktop */}
        <div className="col-start-2 col-end-3 hidden items-center justify-center space-x-6 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;

            // Remove hover effect for selected (active) nav item
            const linkClass = item.isActive
              ? `flex items-center space-x-2 text-sm font-medium ${
                  isLightNavbar ? "text-primary font-bold" : "text-jii-bright-green font-bold"
                }`
              : `flex items-center space-x-2 text-sm font-medium transition-colors ${
                  isLightNavbar
                    ? "text-muted-foreground hover:text-primary"
                    : "text-white/70 hover:text-white"
                }`;

            const iconClass = item.isActive
              ? isLightNavbar
                ? "h-4 w-4 text-jii-dark-green"
                : "h-4 w-4 text-jii-bright-green"
              : isLightNavbar
                ? "h-4 w-4 text-muted-foreground group-hover:text-primary"
                : "h-4 w-4 text-white/70 group-hover:text-white";

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${linkClass} group`}
                aria-current={item.isActive ? "page" : undefined}
              >
                <Icon className={iconClass} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right side: Language Switcher + User Menu */}
        <div className="col-start-3 col-end-4 flex items-center justify-end space-x-3 justify-self-end md:justify-end">
          {/* Desktop User Menu */}
          <div className="hidden md:block">
            <UserMenu
              locale={locale}
              session={session}
              displayName={displayName}
              onSignOut={handleSignOut}
            />
          </div>
          <LanguageSwitcher locale={locale} />

          {/* Mobile Navigation Menu */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("navigation.menu", "Navigation menu")}
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="font-notosans w-56">
                {/* Navigation items */}
                {navItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        href={item.href}
                        className={`flex items-center space-x-3 ${
                          item.isActive ? "bg-accent" : ""
                        }`}
                        aria-current={item.isActive ? "page" : undefined}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}

                {/* Mobile auth section */}
                {session?.user && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                      <div className="flex w-full items-center gap-3">
                        {session.user.image && (
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={session.user.image} alt={displayName} />
                            <AvatarFallback>
                              <User className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">{displayName}</span>
                          <span className="text-muted-foreground truncate text-xs">
                            {session.user.email}
                          </span>
                        </div>
                      </div>
                    </DropdownMenuItem>
                    {/* Account link for mobile */}
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/${locale}/platform/account/settings`}
                        className="flex w-full cursor-default items-center"
                      >
                        <Avatar className="bg-muted mr-2 h-4 w-4">
                          <AvatarFallback className="rounded-lg">
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        {t("auth.account")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <form action={handleSignOut} className="w-full">
                        <button type="submit" className="flex w-full items-center space-x-3">
                          <LogOut className="h-4 w-4" />
                          <span>{t("auth.signOut", "Sign Out")}</span>
                        </button>
                      </form>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>
    </header>
  );
}
