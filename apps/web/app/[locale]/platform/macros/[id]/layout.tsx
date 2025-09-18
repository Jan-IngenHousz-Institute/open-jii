"use client";

import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components";

interface MacroLayoutProps {
  children: React.ReactNode;
}

export default function MacroLayout({ children }: MacroLayoutProps) {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(["macro", "navigation"]);
  const locale = useLocale();

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.endsWith("/settings")) return "settings";
    if (pathname.endsWith(`/macros/${id}`)) return "overview";
    return "overview";
  };

  const activeTab = getActiveTab();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("macros.macro")}</h3>
        <p className="text-muted-foreground text-sm">{t("macros.manageMacroDescription")}</p>
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview" asChild>
            <Link href={`/platform/macros/${id}`} locale={locale}>
              {t("macros.overview")}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="settings" asChild>
            <Link href={`/platform/macros/${id}/settings`} locale={locale}>
              {t("navigation.settings")}
            </Link>
          </TabsTrigger>
        </TabsList>

        <div className="mx-4 mt-6">{children}</div>
      </Tabs>
    </div>
  );
}
