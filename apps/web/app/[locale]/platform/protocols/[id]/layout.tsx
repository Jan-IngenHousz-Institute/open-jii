"use client";

import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components";

interface ProtocolLayoutProps {
  children: React.ReactNode;
}

export default function ProtocolLayout({ children }: ProtocolLayoutProps) {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(undefined, "common");
  const locale = useLocale();

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.endsWith("/settings")) return "settings";
    if (pathname.endsWith(`/protocols/${id}`)) return "overview";
    return "overview";
  };

  const activeTab = getActiveTab();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("protocols.protocol")}</h3>
        <p className="text-muted-foreground text-sm">{t("protocols.manageProtocolDescription")}</p>
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview" asChild>
            <Link href={`/platform/protocols/${id}`} locale={locale}>
              {t("protocols.overview")}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="settings" asChild>
            <Link href={`/platform/protocols/${id}/settings`} locale={locale}>
              {t("navigation.settings")}
            </Link>
          </TabsTrigger>
        </TabsList>

        <div className="mx-4 mt-6">{children}</div>
      </Tabs>
    </div>
  );
}
