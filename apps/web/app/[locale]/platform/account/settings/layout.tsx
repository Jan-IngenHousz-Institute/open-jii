import { Activity, Bell, Settings as SettingsIcon, Shield, User, Users } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import initTranslations from "@repo/i18n/server";
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

  const activeKey = (tabs.find(isActive) ?? tabs[1]).key;

  return (
    <div className="space-y-6">
      <NavTabs value={activeKey}>
        <NavTabsList>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            if (tab.disabled) {
              return (
                <NavTabsTrigger key={tab.key} value={tab.key} disabled>
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </NavTabsTrigger>
              );
            }
            return (
              <NavTabsTrigger key={tab.key} value={tab.key} asChild>
                <Link href={tab.href} locale={locale}>
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              </NavTabsTrigger>
            );
          })}
        </NavTabsList>
      </NavTabs>

      <div>{children}</div>
    </div>
  );
}
