"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { User, Home, BookOpen, LogOut, Menu, Sprout } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { Session } from "@repo/auth/types";
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
import { cva } from "@repo/ui/lib/utils";

import { useGetUserProfile } from "../../hooks/profile/useGetUserProfile/useGetUserProfile";

interface UnifiedNavbarProps {
  locale: string;
  session: Session | null;
  isHomePage?: boolean;
}

// Extract UserMenu as a separate component to prevent re-renders
function UserMenu({
  locale,
  session,
  displayName,
}: {
  locale: string;
  session: Session | null;
  displayName: string;
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
          <Link href="/api/auth/logout" className="flex w-full cursor-default items-center">
            <LogOut className="mr-2 h-4 w-4" />
            {t("auth.signOut", "Sign Out")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UnifiedNavbar({ locale, session, isHomePage = false }: UnifiedNavbarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [isIntersecting, setIsIntersecting] = useState(true);

  const { data: userProfile } = useGetUserProfile(session?.user.id ?? "");
  const profile = userProfile?.body;
  const displayName =
    profile?.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : "";

  // Intersection observer for hero section (only on home page)
  useEffect(() => {
    if (!isHomePage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: "-64px 0px 0px 0px", // Navbar height offset
      },
    );

    // Target the hero section
    const heroSection = document.querySelector("main > section:first-child");
    if (heroSection) {
      observer.observe(heroSection);
    }

    return () => {
      if (heroSection) {
        observer.unobserve(heroSection);
      }
    };
  }, [isHomePage]);

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

  const isLightMode =
    pathname.startsWith(`/${locale}/about`) ||
    pathname.startsWith(`/${locale}/blog`) ||
    pathname.startsWith(`/${locale}/faq`) ||
    pathname.startsWith(`/${locale}/policies`);

  // Determine navbar background based on intersection state
  const navbarBackgroundVariants = cva(
    "pointer-events-auto sticky left-0 top-0 z-50 w-full transition-colors duration-300",
    {
      variants: {
        mode: {
          light: "bg-white/60 backdrop-blur-md border-b border-white/60",
          dark: "bg-gradient-to-b from-black/80 to-transparent",
          green: "bg-sidebar border-b border-white/40 shadow-lg",
        },
      },
      defaultVariants: {
        mode: "dark",
      },
    },
  );

  const getNavbarMode = (): "light" | "dark" | "green" => {
    if (isHomePage && !isIntersecting) {
      return "green";
    }
    if (isLightMode) {
      return "light";
    }
    return "dark";
  };

  return (
    <header className={navbarBackgroundVariants({ mode: getNavbarMode() })}>
      <nav
        className={`font-notosans mx-auto grid h-16 max-w-7xl grid-cols-3 items-center px-6 ${
          isLightMode ? "text-black" : "text-white"
        }`}
      >
        {/* Logo/Brand */}
        <div className="col-start-1 col-end-2 flex items-center">
          <Image
            src={
              isLightMode
                ? "/openJII-logo-vertical-yellow.svg"
                : "/openJII-logo-BW-vertical-white.svg"
            }
            alt="openJII logo"
            width={210}
            height={52}
            className="h-11 w-auto"
          />
        </div>

        {/* Navigation Links - Desktop */}
        <div className="col-start-2 col-end-3 hidden items-center justify-center space-x-6 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;

            // Remove hover effect for selected (active) nav item
            const linkClass = item.isActive
              ? `flex items-center space-x-2 text-sm font-medium ${
                  isLightMode ? "text-primary font-bold" : "text-jii-bright-green font-bold"
                }`
              : `flex items-center space-x-2 text-sm font-medium transition-colors ${
                  isLightMode
                    ? "text-muted-foreground hover:text-primary"
                    : "text-white hover:text-jii-medium-green"
                }`;

            const iconClass = item.isActive
              ? isLightMode
                ? "h-4 w-4 text-jii-dark-green"
                : "h-4 w-4 text-jii-bright-green"
              : isLightMode
                ? "h-4 w-4 text-muted-foreground group-hover:text-primary"
                : "h-4 w-4 text-white group-hover:text-jii-medium-green";

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
            <UserMenu locale={locale} session={session} displayName={displayName} />
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
                      <Link
                        href="/api/auth/logout"
                        className="flex w-full cursor-default items-center"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        {t("auth.signOut", "Sign Out")}
                      </Link>
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
