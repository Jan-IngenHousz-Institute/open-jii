"use client";

import { PageContainer } from "@/components/page-container";
import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation("account");
  const locale = useLocale();

  const getActiveTab = () => {
    if (pathname.includes("/security")) return "security";
    if (pathname.includes("/api-keys")) return "api-keys";
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
        </NavTabsList>

        <div className="mt-6 flex flex-1 flex-col">{children}</div>
      </NavTabs>
    </PageContainer>
  );
}
