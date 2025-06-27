"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { User, Home, BookOpen, LogOut, Menu, LogIn, Sprout } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Session } from "@repo/auth/config";
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

interface UnifiedNavbarProps {
  locale: Locale;
  session: Session | null;
  backUrl?: string; // Optional backUrl for logout
}

// Extract UserMenu as a separate component to prevent re-renders
function UserMenu({
  locale,
  session,
  pathname,
}: {
  locale: Locale;
  session: Session | null;
  pathname: string;
}) {
  const { t } = useTranslation("common");

  if (!session?.user) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/${locale}/platform`} className="flex items-center gap-2">
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">{t("navigation.platform", "Go to Platform")}</span>
        </Link>
      </Button>
    );
  }

  const backUrl = (pathname.includes("/platform") ? `/${locale}` : pathname) || "/";

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
              <AvatarImage src={session.user.image} alt={session.user.name ?? "User"} />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <User className="h-4 w-4" />
          )}
          <span className="hidden max-w-32 truncate sm:inline">
            {session.user.name ?? t("auth.account", "Account")}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled>
          <div className="flex w-full items-center gap-3">
            {session.user.image && (
              <Avatar className="h-8 w-8">
                <AvatarImage src={session.user.image} alt={session.user.name ?? "User"} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{session.user.name}</span>
              <span className="text-muted-foreground truncate text-xs">{session.user.email}</span>
            </div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href={`/api/logout?backUrl=${encodeURIComponent(backUrl)}`}
            className="flex w-full cursor-pointer items-center"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("auth.signOut", "Sign Out")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UnifiedNavbar({ locale, session, backUrl = "/" }: UnifiedNavbarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();

  const isAuthenticated = !!session?.user;

  // Navigation items (memoised)
  const navItems = useMemo(
    () => [
      {
        href: `/${locale}`,
        label: t("navigation.home", "Home"),
        icon: Home,
        isActive: pathname === `/${locale}`,
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
        isActive: pathname.startsWith(`/${locale}/platform`),
        requiresAuth: true,
      },
    ],
    [locale, t, pathname],
  );

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.requiresAuth || isAuthenticated),
    [navItems, isAuthenticated],
  );

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo/Brand */}
        <Link
          href={`/${locale}`}
          className="flex items-center space-x-2 text-xl font-bold transition-opacity hover:opacity-80"
        >
          <span className="text-primary">openJII</span>
        </Link>

        {/* Navigation Links - Desktop */}
        <div className="hidden items-center space-x-6 md:flex">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`hover:text-primary flex items-center space-x-2 text-sm font-medium transition-colors ${
                  item.isActive ? "text-primary" : "text-muted-foreground"
                }`}
                aria-current={item.isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right side: Language Switcher + User Menu */}
        <div className="flex items-center space-x-3">
          <LanguageSwitcher locale={locale} />

          {/* Desktop User Menu */}
          <UserMenu locale={locale} session={session} pathname={pathname} />

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
              <DropdownMenuContent align="end" className="w-56">
                {/* Navigation items */}
                {visibleNavItems.map((item) => {
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
                <DropdownMenuSeparator />
                {!session?.user ? (
                  <DropdownMenuItem asChild>
                    <Link href={`/${locale}/platform`} className="flex items-center space-x-3">
                      <LogIn className="h-4 w-4" />
                      <span>{t("navigation.platform", "Go to Platform")}</span>
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem disabled>
                      <div className="flex w-full items-center gap-3">
                        {session.user.image && (
                          <Avatar className="h-6 w-6">
                            <AvatarImage
                              src={session.user.image}
                              alt={session.user.name ?? "User"}
                            />
                            <AvatarFallback>
                              <User className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">{session.user.name}</span>
                          <span className="text-muted-foreground truncate text-xs">
                            {session.user.email}
                          </span>
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/api/logout?backUrl=${encodeURIComponent(backUrl)}`}
                        className="flex w-full items-center space-x-3"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>{t("auth.signOut", "Sign Out")}</span>
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
