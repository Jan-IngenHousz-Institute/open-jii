"use client";

import { DashboardFormShell } from "@/components/experiment-dashboards/dashboard-form-shell";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useExperimentDashboard } from "@/hooks/experiment/useExperimentDashboard/useExperimentDashboard";
import { useParams, useSearchParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";

interface LayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: LayoutProps) {
  const { id: experimentId, dashboardId } = useParams<{ id: string; dashboardId: string }>();
  const { t } = useTranslation("common");
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("edit") === "1" ? "edit" : "view";

  const { data, isLoading, error } = useExperimentDashboard(dashboardId, experimentId);

  return (
    <div className="page-fluid flex flex-1 flex-col">
      <EntityLayoutShell
        isLoading={isLoading}
        error={error}
        hasData={Boolean(data?.body)}
        loadingMessage={t("common.loading")}
      >
        {data?.body && (
          <DashboardFormShell
            key={data.body.id}
            experimentId={experimentId}
            dashboardId={dashboardId}
            dashboard={data.body}
            initialMode={initialMode}
          >
            {children}
          </DashboardFormShell>
        )}
      </EntityLayoutShell>
    </div>
  );
}
