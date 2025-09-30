"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useLocale } from "@/hooks/useLocale";
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
  const { t } = useTranslation("experiments");
  const { t: tCommon } = useTranslation("common");
  const { t: tNav } = useTranslation("navigation");
  const locale = useLocale();

  // Check user access to this experiment
  const { data: accessData, error, isLoading } = useExperimentAccess(id);

  const experiment = accessData?.body;
  const hasAccess = accessData?.body.hasAccess;

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  // Show error if access is denied or other error
  if (error) {
    // Check if it's a 403 Forbidden error
    const is403Error = typeof error === "object" && "status" in error && error.status === 403;

    if (is403Error) {
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">{tCommon("errors.accessDenied")}</h3>
            <p className="text-muted-foreground text-sm">{t("noPermissionToAccess")}</p>
          </div>
          <ErrorDisplay error={error} title={tCommon("errors.forbidden")} />
        </div>
      );
    }

    // Show generic error for other types (404, etc.)
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">{tCommon("errors.error")}</h3>
          <p className="text-muted-foreground text-sm">{t("errorLoadingExperiment")}</p>
        </div>
        <ErrorDisplay error={error} />
      </div>
    );
  }

  // If no experiment data, show not found
  if (!experiment) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">{tCommon("errors.notFound")}</h3>
          <p className="text-muted-foreground text-sm">{t("experimentNotFound")}</p>
        </div>
      </div>
    );
  }

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.endsWith("/settings")) return "settings";
    if (pathname.endsWith("/flow")) return "flow";
    if (pathname.startsWith(`/${locale}/platform/experiments/${id}/data`)) return "data";
    if (pathname.includes("/visualizations")) return "visualizations";
    if (pathname.endsWith(`/experiments/${id}`)) return "overview";
    return "overview";
  };

  const activeTab = getActiveTab();
  // Reusable renderer for tabs requiring member access
  function renderAccessControlledLink(href: string, label: string) {
    return hasAccess ? (
      <Link href={href}>{label}</Link>
    ) : (
      <span className="cursor-not-allowed opacity-50">{label}</span>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("experiment")}</h3>
        <p className="text-muted-foreground text-sm">{t("manageExperimentDescription")}</p>
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" asChild>
            <Link href={`/${locale}/platform/experiments/${id}`}>{t("overview")}</Link>
          </TabsTrigger>
          <TabsTrigger value="data" asChild>
            <Link href={`/${locale}/platform/experiments/${id}/data`}>{t("data")}</Link>
          </TabsTrigger>
          <TabsTrigger value="visualizations" asChild>
            <Link href={`/${locale}/platform/experiments/${id}/visualizations`}>
              Visualizations
            </Link>
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            disabled={!hasAccess}
            aria-label={!hasAccess ? t("needMemberAccess") : undefined}
            asChild={hasAccess}
          >
            {renderAccessControlledLink(
              `/${locale}/platform/experiments/${id}/settings`,
              tNav("main.settings"),
            )}
          </TabsTrigger>
          <TabsTrigger value="flow" asChild>
            <Link href={`/${locale}/platform/experiments/${id}/flow`}>{t("flow.tabLabel")}</Link>
          </TabsTrigger>
        </TabsList>

        <div className="mx-4 mt-6">{children}</div>
      </Tabs>
    </div>
  );
}
