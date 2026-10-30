"use client";

import { guestMayUse } from "@/components/auth/guest-access";
import { useIsGuest } from "@/components/auth/principal-context";
import { PageContainer } from "@/components/page-container";
import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { redirect, usePathname } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation("account");
  const locale = useLocale();
  // Profile, sign-in methods, keys, invitations and notifications all refuse a guest.
  if (!guestMayUse("users.getUserProfile", useIsGuest())) redirect(`/${locale}/platform`);

  const getActiveTab = () => {
    if (pathname.includes("/security")) return "security";
    if (pathname.includes("/api-keys")) return "api-keys";
    if (pathname.includes("/invitations")) return "invitations";
    if (pathname.includes("/notifications")) return "notifications";
    return "general";
  };

  return (
    <PageContainer width="wide" className="space-y-6">
      <NavTabs value={getActiveTab()} className="flex w-full flex-1 flex-col">
        <NavTabsList>
          <NavTabsTrigger value="general" asChild>
            <Link href={`/${locale}/platform/account`}>{t("tabs.general")}</Link>
          </NavTabsTrigger>
          <NavTabsTrigger value="security" asChild>
            <Link href={`/${locale}/platform/account/security`}>{t("tabs.security")}</Link>
          </NavTabsTrigger>
          <NavTabsTrigger value="api-keys" asChild>
            <Link href={`/${locale}/platform/account/api-keys`}>{t("tabs.apiKeys")}</Link>
          </NavTabsTrigger>
          <NavTabsTrigger value="invitations" asChild>
            <Link href={`/${locale}/platform/account/invitations`}>{t("tabs.invitations")}</Link>
          </NavTabsTrigger>
          <NavTabsTrigger value="notifications" asChild>
            <Link href={`/${locale}/platform/account/notifications`}>
              {t("tabs.notifications")}
            </Link>
          </NavTabsTrigger>
        </NavTabsList>

        <div className="mt-6 flex flex-1 flex-col">{children}</div>
      </NavTabs>
    </PageContainer>
  );
}
