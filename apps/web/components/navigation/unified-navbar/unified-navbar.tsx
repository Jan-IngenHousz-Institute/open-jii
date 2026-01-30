"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import {
  User,
  Home,
  BookOpen,
  LogOut,
  Menu,
  Sprout,
  MessageCircleQuestion,
  ChevronDown,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSignOut } from "~/hooks/auth";
import { useGetUserProfile } from "~/hooks/profile/useGetUserProfile/useGetUserProfile";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const signOut = useSignOut();

  if (!session?.user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut.mutateAsync();
    router.push("/");
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="group flex gap-2 hover:bg-transparent focus:bg-transparent"
          aria-label={t("auth.userMenu", "User menu")}
        >
          {session.user.image ? (
            <Avatar className="group-hover:bg-jii-medium-green/20 h-6 w-6 rounded-full transition-all duration-200 group-hover:shadow-[0_0_10px_theme(colors.jii-medium-green)]">
              <AvatarImage src={session.user.image} alt={displayName} />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <User className="group-hover:text-jii-medium-green h-4 w-4 transition-all duration-200 group-hover:drop-shadow-[0_0_10px_theme(colors.jii-medium-green)]" />
          )}
          <ChevronDown
            className={`group-hover:text-jii-medium-green h-4 w-4 text-white transition-all duration-300 ${open ? "rotate-180" : "rotate-0"}`}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-3 py-1.5 text-sm">
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
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={signOut.isPending}
          className="flex w-full cursor-default items-center"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("auth.signOut", "Sign Out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UnifiedNavbar({ locale, session, isHomePage = false }: UnifiedNavbarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [isIntersecting, setIsIntersecting] = useState(true);
  const signOut = useSignOut();

  const { data: userProfile } = useGetUserProfile(session?.user.id ?? "");
  const profile = userProfile?.body;
  const displayName =
    profile?.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : "";

  const handleSignOut = async () => {
    await signOut.mutateAsync();
    router.push("/");
  };

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
        isActive: pathname === `/${locale}` || pathname === `/${locale}/`,
      },
      {
        href: `/${locale}/about`,
        label: t("navigation.about", "About JII"),
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
        href: `/${locale}/faq`,
        label: t("navigation.faq", "FAQ"),
        icon: MessageCircleQuestion,
        isActive: pathname.startsWith(`/${locale}/faq`),
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

  const isGreenMode =
    pathname.startsWith(`/${locale}/cookie-settings`) ||
    pathname.startsWith(`/${locale}/cookie-policy`) ||
    pathname.startsWith(`/${locale}/terms-and-conditions`) ||
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
          dark: "bg-gradient-to-b from-black/80 to-transparent",
          green: "bg-sidebar border-b border-white/40 shadow-lg",
        },
      },
      defaultVariants: {
        mode: "dark",
      },
    },
  );

  const getNavbarMode = (): "dark" | "green" => {
    if ((isHomePage && !isIntersecting) || isGreenMode) {
      return "green";
    }
    return "dark";
  };

  return (
    <header className={navbarBackgroundVariants({ mode: getNavbarMode() })}>
      <nav className="font-notosans mx-auto grid h-16 max-w-7xl grid-cols-3 items-center px-6 text-white">
        {/* Logo/Brand */}
        <div className="col-start-1 col-end-2 flex items-center">
          <Image
            src="/openJII-logo-BW-vertical-white.png"
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
              ? "flex items-center space-x-2 text-sm font-medium text-jii-bright-green font-bold"
              : "flex items-center space-x-2 text-sm font-medium transition-colors text-white hover:text-jii-medium-green";

            const iconClass = item.isActive
              ? "h-4 w-4 text-jii-bright-green"
              : "h-4 w-4 text-white group-hover:text-jii-medium-green";

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${linkClass} group`}
                aria-current={item.isActive ? "page" : undefined}
              >
                <Icon className={iconClass} />
                <span className="whitespace-nowrap">{item.label}</span>
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
                  className="group hover:bg-transparent focus:bg-transparent"
                >
                  <Menu className="group-hover:text-jii-medium-green h-4 w-4 text-white transition-colors duration-200" />
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
                          item.isActive ? "bg-surface-dark" : ""
                        }`}
                        aria-current={item.isActive ? "page" : undefined}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="whitespace-nowrap">{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}

                {/* Mobile auth section */}
                {session?.user && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="flex items-center gap-3 px-2 py-1.5 text-sm">
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
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      disabled={signOut.isPending}
                      className="flex w-full cursor-default items-center"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {t("auth.signOut", "Sign Out")}
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
