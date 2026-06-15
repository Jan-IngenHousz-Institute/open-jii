import { Activity, Bell, Menu, Settings as SettingsIcon, Shield, User, Users } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

interface Tab {
  key: "overview" | "settings" | "security" | "notifications" | "team" | "activity";
  href: string;
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
}

export default async function AccountSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const pathname = (await headers()).get("x-current-path") ?? "/";
  const { locale } = await params;
  const base = `/${locale}/platform/account`;

  const { t } = await initTranslations({ locale, namespaces: ["common", "account"] });

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

  const isActive = (tab: Tab) =>
    pathname === tab.href ||
    pathname.startsWith(`${tab.href}/`) ||
    (tab.key === "settings" && pathname === base);

  const activeTab = tabs.find(isActive) ?? tabs[1];

  return (
    <div className="-mt-4 space-y-6">
      {/* Desktop tabs — shared NavTabs underline style */}
      <NavTabs value={activeTab.key} className="hidden md:block">
        <NavTabsList>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const content = (
              <>
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </>
            );

            if (tab.disabled) {
              return (
                <NavTabsTrigger key={tab.key} value={tab.key} disabled>
                  {content}
                </NavTabsTrigger>
              );
            }

            return (
              <NavTabsTrigger key={tab.key} value={tab.key} asChild>
                <Link href={tab.href} locale={locale}>
                  {content}
                </Link>
              </NavTabsTrigger>
            );
          })}
        </NavTabsList>
      </NavTabs>

      {/* Mobile fallback — dropdown menu (tab list doesn't fit horizontally) */}
      <div className="w-full md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto w-full justify-between px-4 py-3"
              aria-label={t("account:mobileNavAriaLabel")}
            >
              <div className="flex items-center gap-2">
                <activeTab.icon className="text-primary h-4 w-4" />
                <span className="text-sm font-medium">{activeTab.label}</span>
              </div>
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-full min-w-[200px]">
            {tabs.map((tab) => {
              const active = isActive(tab);
              const Icon = tab.icon;

              return (
                <DropdownMenuItem key={tab.key} asChild disabled={tab.disabled}>
                  {tab.disabled ? (
                    <div className="flex cursor-not-allowed items-center gap-2 opacity-50">
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </div>
                  ) : (
                    <Link
                      href={tab.href}
                      locale={locale}
                      className={`flex items-center gap-2 ${
                        active ? "bg-accent text-primary" : ""
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                      <span>{tab.label}</span>
                    </Link>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Page content below the tabs */}
      <div>{children}</div>
    </div>
  );
}
