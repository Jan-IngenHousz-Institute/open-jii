import { User, Settings as SettingsIcon, Shield, Bell, Users, Activity, Menu } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components";

export default async function AccountSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const pathname = (await headers()).get("x-current-path") ?? "/";
  const { locale } = await params;
  const base = `/${locale}/platform/account`;

  // Load translations from common and account namespaces
  const { t } = await initTranslations({
    locale,
    namespaces: ["common", "account"],
  });

  interface Tab {
    key: "overview" | "settings" | "security" | "notifications" | "team" | "activity";
    href: string;
    label: string;
    icon: React.ElementType;
    disabled?: boolean;
  }

  const tabs: Tab[] = [
    {
      key: "overview",
      href: `${base}/overview`,
      label: t("account:overview.title"),
      icon: User,
      disabled: true,
    },
    {
      key: "settings",
      href: `${base}/settings`,
      label: t("account:settings.title"),
      icon: SettingsIcon,
    },
    {
      key: "security",
      href: `${base}/security`,
      label: t("account:security.title"),
      icon: Shield,
      disabled: true,
    },
    {
      key: "notifications",
      href: `${base}/notifications`,
      label: t("account:notifications.title"),
      icon: Bell,
      disabled: true,
    },
    {
      key: "team",
      href: `${base}/team`,
      label: t("account:team.title"),
      icon: Users,
      disabled: true,
    },
    {
      key: "activity",
      href: `${base}/activity`,
      label: t("account:activity.title"),
      icon: Activity,
      disabled: true,
    },
  ];

  const isActive = (t: Tab) =>
    pathname === t.href ||
    pathname.startsWith(`${t.href}/`) ||
    (t.key === "settings" && pathname === base);

  // Find the currently active tab for mobile display
  const activeTab = tabs.find(isActive) ?? tabs[1]; // fallback to settings tab

  return (
    <div className="-mt-4 space-y-6">
      {/* Top-of-page custom tab nav */}
      <nav className="border-b border-gray-200">
        {/* Desktop Navigation - Hidden on mobile */}
        <ul className="hidden flex-wrap items-center gap-6 md:flex">
          {tabs.map((t) => {
            const active = isActive(t);
            const Icon = t.icon;

            const linkClasses = [
              "relative inline-flex items-center gap-2 px-1 pb-2 pt-3 text-sm font-medium transition-colors",
              active ? "text-jii-dark-green" : "text-muted-foreground hover:text-foreground",
              t.disabled
                ? "pointer-events-none cursor-not-allowed opacity-50 hover:text-muted-foreground"
                : "",
            ].join(" ");

            const iconClasses = active
              ? "text-jii-dark-green h-4 w-4"
              : "text-muted-foreground h-4 w-4";

            return (
              <li key={t.key} className="-mb-[1px]">
                {t.disabled ? (
                  <div className={linkClasses}>
                    <Icon className={iconClasses} />
                    <span>{t.label}</span>
                  </div>
                ) : (
                  <Link
                    href={t.href}
                    locale={locale}
                    aria-current={active ? "page" : undefined}
                    className={linkClasses}
                  >
                    <Icon className={iconClasses} />
                    <span>{t.label}</span>
                    {/* underline indicator */}
                    <span
                      className={[
                        "absolute -bottom-[1px] left-0 h-0.5 w-full rounded",
                        active ? "bg-jii-dark-green" : "bg-transparent",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        {/* Mobile Navigation - Dropdown Menu */}
        <div className="w-full md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto w-full justify-between px-4 py-3"
                aria-label={t("account:mobileNavAriaLabel")}
              >
                <div className="flex items-center gap-2">
                  <activeTab.icon className="text-jii-dark-green h-4 w-4" />
                  <span className="text-sm font-medium">{activeTab.label}</span>
                </div>
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-full min-w-[200px]">
              {tabs.map((t) => {
                const active = isActive(t);
                const Icon = t.icon;

                return (
                  <DropdownMenuItem key={t.key} asChild disabled={t.disabled}>
                    {t.disabled ? (
                      <div className="flex cursor-not-allowed items-center gap-2 opacity-50">
                        <Icon className="h-4 w-4" />
                        <span>{t.label}</span>
                      </div>
                    ) : (
                      <Link
                        href={t.href}
                        locale={locale}
                        className={`flex items-center gap-2 ${
                          active ? "bg-accent text-jii-dark-green" : ""
                        }`}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon className={`h-4 w-4 ${active ? "text-jii-dark-green" : ""}`} />
                        <span>{t.label}</span>
                      </Link>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* Page content below the tabs */}
      <div>{children}</div>
    </div>
  );
}
