"use client";

import { ErrorDisplay } from "@/components/error-display";
import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { PlatformHeaderDetail } from "@/components/navigation/site-header/platform-header-context";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useLocale } from "@/hooks/useLocale";
import { notFound, usePathname, useParams } from "next/navigation";
import { ExperimentTitle } from "~/components/experiment-overview/experiment-title";

import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

interface ExperimentLayoutShellProps {
  children: React.ReactNode;
}

export function ExperimentLayoutShell({ children }: ExperimentLayoutShellProps) {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("experiments");
  const { t: tCommon } = useTranslation("common");
  const { t: tSettings } = useTranslation();
  const { t: tIot } = useTranslation("iot");
  const locale = useLocale();

  // Access check
  const { data: accessData, error, isLoading } = useExperimentAccess(id);
  const apiBody = accessData;
  const experiment = apiBody?.experiment;
  const hasAccess = apiBody?.isAdmin;

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
    // Extract status from API error response
    const errorStatus =
      "status" in error && typeof error.status === "number" ? error.status : undefined;

    // Handle 404 Not Found or 400 Bad Request (e.g., invalid UUID) - show not found page
    if (errorStatus === 404 || errorStatus === 400) {
      notFound();
    }

    // Handle 403 Forbidden
    if (errorStatus === 403) {
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

    // Show generic error for other types (5xx, etc.)
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

  const getActiveTab = () => {
    const base = `/${locale}/platform/experiments/${id}`;
    if (pathname.startsWith(`${base}/data`)) return "data";
    if (pathname.includes("/analysis")) return "analysis";
    if (pathname.includes("/dashboards")) return "dashboards";
    if (pathname.endsWith("/design")) return "design";
    if (pathname.includes("/collaborators")) return "collaborators";
    if (pathname.includes("/devices")) return "devices";
    return "overview";
  };

  const activeTab = getActiveTab();

  return (
    // `page-fluid` marker on the layout so all tabs (overview, data, analysis, flow)
    // render at the same fluid width, so switching tabs does not reflow the page.
    <div className="page-fluid flex flex-1 flex-col gap-6">
      <PlatformHeaderDetail
        href={`/${locale}/platform/experiments/${id}`}
        label={experiment.name}
      />
      <ExperimentTitle
        experimentId={id}
        name={experiment.name}
        status={experiment.status}
        visibility={experiment.visibility}
        hasAccess={hasAccess}
      />

      <NavTabs value={activeTab} className="flex w-full flex-1 flex-col">
        <NavTabsList>
          <NavTabsTrigger value="overview" asChild>
            <IntentLink prefetchWhileVisible href={`/${locale}/platform/experiments/${id}`}>
              {t("overview")}
            </IntentLink>
          </NavTabsTrigger>
          <NavTabsTrigger value="data" asChild>
            <IntentLink prefetchWhileVisible href={`/${locale}/platform/experiments/${id}/data`}>
              {t("data")}
            </IntentLink>
          </NavTabsTrigger>
          <NavTabsTrigger value="analysis" asChild>
            <IntentLink
              prefetchWhileVisible
              href={`/${locale}/platform/experiments/${id}/analysis`}
            >
              {t("analysis.title")}
            </IntentLink>
          </NavTabsTrigger>
          <NavTabsTrigger value="dashboards" asChild>
            <IntentLink
              prefetchWhileVisible
              href={`/${locale}/platform/experiments/${id}/dashboards`}
            >
              {t("dashboards.tabLabel")}
            </IntentLink>
          </NavTabsTrigger>
          <NavTabsTrigger value="design" asChild>
            <IntentLink prefetchWhileVisible href={`/${locale}/platform/experiments/${id}/design`}>
              {t("flow.tabLabel")}
            </IntentLink>
          </NavTabsTrigger>
          <NavTabsTrigger value="collaborators" asChild>
            <IntentLink
              prefetchWhileVisible
              href={`/${locale}/platform/experiments/${id}/collaborators`}
            >
              {tSettings("experimentSettings.collaborators")}
            </IntentLink>
          </NavTabsTrigger>
          <NavTabsTrigger value="devices" asChild>
            <IntentLink prefetchWhileVisible href={`/${locale}/platform/experiments/${id}/devices`}>
              {tIot("iot.experimentDevices.tabLabel")}
            </IntentLink>
          </NavTabsTrigger>
        </NavTabsList>

        <div className="mt-6 flex flex-1 flex-col">{children}</div>
      </NavTabs>
    </div>
  );
}
