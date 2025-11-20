"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { ExperimentTitle } from "~/components/experiment-overview/experiment-title";

import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components";

interface ExperimentLayoutProps {
  children: React.ReactNode;
}

export default function ExperimentLayout({ children }: ExperimentLayoutProps) {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("experiments");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();

  // Access check
  const { data: accessData, error, isLoading } = useExperimentAccess(id);
  const apiBody = accessData?.body;
  const experiment = apiBody?.experiment;
  const hasAccess = apiBody?.hasAccess;

  // Loading
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
    if (pathname.endsWith("/flow")) return "flow";
    if (pathname.startsWith(`/${locale}/platform/experiments/${id}/data`)) return "data";
    if (pathname.includes("/analysis")) return "analysis";
    if (pathname.endsWith(`/experiments/${id}`)) return "overview";
    return "overview";
  };

  const activeTab = getActiveTab();

  return (
    <div className="space-y-6">
      <ExperimentTitle
        experimentId={id}
        name={experiment.name}
        status={experiment.status}
        visibility={experiment.visibility}
        hasAccess={hasAccess}
        isArchived
      />

      <NavTabs value={activeTab} className="w-full">
        <NavTabsList>
          <NavTabsTrigger value="overview">
            <Link href={`/${locale}/platform/experiments/${id}`}>{t("overview")}</Link>
          </NavTabsTrigger>
          <NavTabsTrigger value="data">
            <Link href={`/${locale}/platform/experiments/${id}/data`}>{t("data")}</Link>
          </NavTabsTrigger>
          <NavTabsTrigger value="analysis">
            <Link href={`/${locale}/platform/experiments/${id}/analysis`}>
              {t("analysis.title")}
            </Link>
          </NavTabsTrigger>
          <NavTabsTrigger value="flow">
            <Link href={`/${locale}/platform/experiments/${id}/flow`}>{t("flow.tabLabel")}</Link>
          </NavTabsTrigger>
        </NavTabsList>

        <div className="mt-6">{children}</div>
      </NavTabs>
    </div>
  );
}
