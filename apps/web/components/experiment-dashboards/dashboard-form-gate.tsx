"use client";

import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { PageLoading } from "@/components/shared/page-loading";
import { useEffect, useState } from "react";

import { DashboardForm } from "./dashboard-form";
import { DashboardFormAfterCloseSave } from "./dashboard-form-after-close-save";
import type { DashboardFormShellProps } from "./dashboard-form-shell";
import type { DashboardCloseSave } from "./editor/hooks/use-dashboard-autosave";
import { getPendingDashboardCloseSave } from "./editor/hooks/use-dashboard-autosave";

export function DashboardFormGate(props: DashboardFormShellProps) {
  const { experimentId, dashboardId } = props;
  const [closeSave, setCloseSave] = useState<DashboardCloseSave | null>();

  useEffect(() => {
    // The outgoing editor registers its close save during passive cleanup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCloseSave(getPendingDashboardCloseSave(experimentId, dashboardId) ?? null);
  }, [experimentId, dashboardId]);

  if (closeSave === undefined) return <PageLoading />;

  if (closeSave) return <DashboardFormAfterCloseSave {...props} closeSave={closeSave} />;

  const { dashboard, isLoading = false, error } = props;
  return (
    <EntityLayoutShell isLoading={isLoading} error={error} hasData={!!dashboard}>
      {dashboard && <DashboardForm {...props} dashboard={dashboard} />}
    </EntityLayoutShell>
  );
}
