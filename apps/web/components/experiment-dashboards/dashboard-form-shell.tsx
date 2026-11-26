"use client";

import { usePrincipalSession } from "@/components/auth/principal-context";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { PageLoading } from "@/components/shared/page-loading";
import {
  experimentAccessQuery,
  hasConfirmedExperimentReadDenial,
  isExperimentReadDenied,
} from "@/hooks/experiment/useExperimentAccess/experiment-access-query";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import {
  experimentDashboardQuery,
  reloadExperimentDashboard,
} from "@/hooks/experiment/useExperimentDashboard/useExperimentDashboard";
import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { canDuplicateExperimentChart } from "@/util/can-duplicate-experiment-chart";
import { matchQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";

import type {
  ExperimentDashboardLayout,
  ExperimentDashboardWidget,
  ExperimentDashboard,
} from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { useTranslation } from "@repo/i18n";
import { Form } from "@repo/ui/components/form";

import { AutosaveStatusProvider } from "../shared/autosave/autosave-status-context";
import { DashboardLayoutContent } from "./dashboard-layout-content";
import { DashboardModeProvider } from "./dashboard-mode-context";
import { DashboardAutosaveBoundary } from "./editor/context/dashboard-copy-save-context";
import { DashboardEditorProvider } from "./editor/context/dashboard-editor-context";
import type { DashboardCloseSave } from "./editor/hooks/use-dashboard-autosave";
import { getPendingDashboardCloseSave } from "./editor/hooks/use-dashboard-autosave";

const CLOSE_SAVE_STATUS_DELAY_MS = 10_000;

export interface DashboardFormValues {
  name: string;
  description?: string;
  layout: ExperimentDashboardLayout;
  widgets: ExperimentDashboardWidget[];
}

export interface DashboardFormShellProps {
  experimentId: string;
  dashboardId: string;
  dashboard?: ExperimentDashboard;
  isLoading?: boolean;
  error?: unknown;
  initialMode: "view" | "edit";
  children: ReactNode;
}

export function DashboardFormShell(props: DashboardFormShellProps) {
  const { experimentId, dashboardId } = props;
  const { userId, sessionId } = usePrincipalSession();
  return (
    <DashboardFormGate
      key={JSON.stringify([experimentId, dashboardId, userId, sessionId])}
      {...props}
    />
  );
}

function DashboardFormGate(props: DashboardFormShellProps) {
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

function DashboardFormAfterCloseSave({
  closeSave,
  ...props
}: DashboardFormShellProps & { closeSave: DashboardCloseSave }) {
  const { t } = useTranslation("experimentDashboards");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { userId, sessionId } = usePrincipalSession();
  const { dashboardId, experimentId } = props;
  const sameSession = closeSave.userId === userId && closeSave.sessionId === sessionId;
  const [result, setResult] = useState<{ dashboard?: ExperimentDashboard; error?: unknown }>();
  const [showStatus, setShowStatus] = useState(false);
  const accessQuery = experimentAccessQuery(orpc, userId, experimentId);
  const { data: copyAccess, error: copyAccessError } = useQuery({ ...accessQuery, enabled: false });
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const timeout = setTimeout(() => setShowStatus(true), CLOSE_SAVE_STATUS_DELAY_MS);
    const query = experimentDashboardQuery(dashboardId, experimentId, userId);
    const dashboardRead = sameSession
      ? closeSave.dashboard
      : closeSave.flush.then(() => reloadExperimentDashboard(queryClient, query));
    void dashboardRead
      .finally(() => clearTimeout(timeout))
      .then(
        (dashboard) => {
          if (active) setResult({ dashboard });
        },
        (error) => {
          if (!active) return;
          setResult({ error });
          unsubscribe = queryClient.getQueryCache().subscribe((event) => {
            // A cached PATCH response cannot stand in for a new detail read.
            if (
              event.type !== "updated" ||
              event.action.type !== "success" ||
              event.action.manual ||
              !matchQuery({ queryKey: query.queryKey, exact: true }, event.query)
            ) {
              return;
            }
            const dashboard = queryClient.getQueryData<ExperimentDashboard>(query.queryKey);
            if (!dashboard) return;
            unsubscribe?.();
            setResult({ dashboard });
          });
        },
      );
    return () => {
      active = false;
      clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [closeSave, dashboardId, experimentId, queryClient, sameSession, userId]);

  if (!result && showStatus) {
    const readDenied =
      copyAccess?.hasAccess === false ||
      isExperimentReadDenied(copyAccessError) ||
      hasConfirmedExperimentReadDenial(queryClient, accessQuery.queryKey);
    const links = sameSession && !readDenied ? (closeSave.getCopyLinks?.(locale) ?? []) : [];
    return (
      <div className="space-y-3 p-8 text-center">
        <p role="status">{t("ui.messages.saveStillInProgress")}</p>
        {links.length > 0 && (
          <ul className="space-y-1">
            {links.map(({ id, name, href }) => (
              <li key={id}>
                {links.length > 1 && <span className="mr-2">{name}</span>}
                <Link
                  href={href}
                  aria-label={
                    links.length > 1 ? `${t("editor.inspector.openChartCopy")} ${name}` : undefined
                  }
                  className="text-primary underline underline-offset-4"
                >
                  {t("editor.inspector.openChartCopy")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <EntityLayoutShell isLoading={!result} error={result?.error} hasData={!!result?.dashboard}>
      {result?.dashboard && (
        <DashboardForm
          {...props}
          dashboard={props.dashboard ?? result.dashboard}
          initialDashboard={result.dashboard}
        />
      )}
    </EntityLayoutShell>
  );
}

function DashboardForm({
  experimentId,
  dashboardId,
  dashboard,
  initialDashboard = dashboard,
  initialMode,
  children,
}: DashboardFormShellProps & {
  dashboard: ExperimentDashboard;
  initialDashboard?: ExperimentDashboard;
}) {
  const defaults = useMemo<DashboardFormValues>(
    () => ({
      name: initialDashboard.name,
      description: initialDashboard.description ?? "",
      layout: initialDashboard.layout,
      widgets: initialDashboard.widgets,
    }),
    [initialDashboard],
  );

  const form = useForm<DashboardFormValues>({ defaultValues: defaults });
  const { data: accessData } = useExperimentAccess(experimentId);
  const canEdit = canDuplicateExperimentChart(accessData);

  return (
    <AutosaveStatusProvider>
      <DashboardEditorProvider>
        <DashboardModeProvider initialMode={initialMode} canEdit={canEdit}>
          <FormProvider {...form}>
            <Form {...form}>
              <DashboardAutosaveBoundary
                form={form}
                experimentId={experimentId}
                dashboardId={dashboardId}
                enabled={canEdit}
              >
                <DashboardLayoutContent experimentId={experimentId} dashboard={dashboard}>
                  {children}
                </DashboardLayoutContent>
              </DashboardAutosaveBoundary>
            </Form>
          </FormProvider>
        </DashboardModeProvider>
      </DashboardEditorProvider>
    </AutosaveStatusProvider>
  );
}
