"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components";

interface ExperimentLayoutProps {
  children: React.ReactNode;
}

export default function ExperimentLayout({ children }: ExperimentLayoutProps) {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(undefined, "common");

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.endsWith("/settings")) return "settings";
    if (pathname.endsWith("/data")) return "data";
    if (pathname.endsWith(`/experiments/${id}`)) return "overview";
    return "overview";
  };
  const locale = pathname.split("/")[1]; // Extract locale from URL

  const activeTab = getActiveTab();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("experiments.experiment")}</h3>
        <p className="text-muted-foreground text-sm">
          {t("experiments.manageExperimentDescription")}
        </p>
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" asChild>
            <Link href={`/platform/experiments/${id}`}>
              {t("experiments.overview")}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="data" asChild>
            <Link href={`/platform/experiments/${id}/data`}>
              {t("experiments.data")}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="settings" asChild>
            <Link href={`${locale}/platform/experiments/${id}/settings`}>
              {t("navigation.settings")}
            </Link>
          </TabsTrigger>
        </TabsList>

        <div className="mx-4 mt-6">{children}</div>
      </Tabs>
    </div>
  );
}
