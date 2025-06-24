"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { User, LogIn, Home, BookOpen, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";

import { useSession } from "@repo/auth/client";
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

import { handleLogin, handleLogout } from "../app/actions/auth";

interface UnifiedNavbarProps {
  locale: Locale;
}

export function UnifiedNavbar({ locale }: UnifiedNavbarProps) {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const isLoading = status === "loading";
  const isAuthenticated = !!session;

  // Navigation items
  const navItems = [
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
      icon: Settings,
      isActive: pathname.startsWith(`/${locale}/platform`),
      requiresAuth: true,
    },
  ];

  const UserMenu = () => {
    if (isLoading) {
      return (
        <Button variant="ghost" size="sm" disabled>
          <User className="h-4 w-4" />
        </Button>
      );
    }

    if (!isAuthenticated) {
      return (
        <form>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            formAction={handleLogin}
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("auth.signIn", "Sign In")}
            </span>
          </Button>
        </form>
      );
    }

    const handleSignOut = async () => {
      try {
        await handleLogout();
        // Only redirect if user is on platform pages
        if (pathname.includes("/platform")) {
          window.location.href = `/${locale}`;
        } else {
          // For blog and home pages, just refresh to update the session state
          window.location.reload();
        }
      } catch (error) {
        console.error("Logout failed:", error);
        // Fallback: redirect only if on platform, otherwise refresh
        if (pathname.includes("/platform")) {
          window.location.href = `/${locale}`;
        } else {
          window.location.reload();
        }
      }
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            {session.user.image ? (
              <Avatar className="h-6 w-6">
                <AvatarImage
                  src={session.user.image}
                  alt={session.user.name ?? "User"}
                />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <User className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {session.user.name ?? t("auth.account", "Account")}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled>
            <div className="flex items-center gap-2">
              {session.user.image && (
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={session.user.image}
                    alt={session.user.name ?? "User"}
                  />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex flex-col">
                <span className="font-medium">{session.user.name}</span>
                <span className="text-muted-foreground text-xs">
                  {session.user.email}
                </span>
              </div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
            {t("auth.signOut", "Sign Out")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo/Brand */}
        <Link
          href={`/${locale}`}
          className="flex items-center space-x-2 text-xl font-bold"
        >
          <span className="text-primary">openJII</span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden items-center space-x-6 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;

            // Hide platform link if user is not authenticated
            if (item.requiresAuth && !isAuthenticated) {
              return null;
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`hover:text-primary flex items-center space-x-2 text-sm font-medium transition-colors ${
                  item.isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Mobile Navigation Menu */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {navItems.map((item) => {
                const Icon = item.icon;

                // Hide platform link if user is not authenticated
                if (item.requiresAuth && !isAuthenticated) {
                  return null;
                }

                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      href={item.href}
                      className={`flex cursor-pointer items-center space-x-2 ${
                        item.isActive ? "bg-accent" : ""
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right side: Language Switcher + User Menu */}
        <div className="flex items-center space-x-2">
          <LanguageSwitcher locale={locale} />
          <UserMenu />
        </div>
      </nav>
    </header>
  );
}
