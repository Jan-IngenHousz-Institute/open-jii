"use client";

import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Card, NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components";

interface TransferRequestLayoutProps {
  children: React.ReactNode;
}

export default function TransferRequestLayout({ children }: TransferRequestLayoutProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const { t } = useTranslation("common");

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.includes("/history")) return "history";
    return "request";
  };

  const activeTab = getActiveTab();

  return (
    <Card className="mx-auto max-w-2xl space-y-6 p-10">
      <div>
        <h1 className="text-2xl font-semibold">{t("transferRequest.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("transferRequest.description")}</p>
      </div>

      <NavTabs value={activeTab} className="w-full">
        <NavTabsList>
          <NavTabsTrigger value="request">
            <Link href={`/${locale}/platform/transfer-request`}>
              {t("transferRequest.formTab")}
            </Link>
          </NavTabsTrigger>
          <NavTabsTrigger value="history">
            <Link href={`/${locale}/platform/transfer-request/history`}>
              {t("transferRequest.historyTab")}
            </Link>
          </NavTabsTrigger>
        </NavTabsList>

        <div className="mt-6">{children}</div>
      </NavTabs>
    </Card>
  );
}
