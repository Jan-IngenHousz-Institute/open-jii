"use client";

import { ErrorDisplay } from "@/components/error-display";
import { EmptyWorkbookState } from "@/components/experiment-flow/empty-workbook-state";
import { LinkedWorkbookCard } from "@/components/experiment-flow/linked-workbook-card";
import { FlowEditor } from "@/components/flow-editor/flow-editor";
import { PageContainer } from "@/components/page-container";
import { AutosaveIndicator } from "@/components/shared/autosave/autosave-indicator";
import {
  AutosaveStatusProvider,
  useAutosaveStatus,
} from "@/components/shared/autosave/autosave-status-context";
import { WorkbookDraftEditor } from "@/components/workbook/workbook-draft-editor";
import { WorkbookEditor } from "@/components/workbook/workbook-editor";
import { WorkbookEntitySavedProvider } from "@/components/workbook/workbook-entity-saved-context";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useUpgradeWorkbookVersion } from "@/hooks/experiment/useUpgradeWorkbookVersion/useUpgradeWorkbookVersion";
import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { useWorkbookVersion } from "@/hooks/workbook/useWorkbookVersion/useWorkbookVersion";
import { GitBranch, Info, List } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useCallback, useMemo } from "react";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n/client";
import { NavTabs, NavTabsContent, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";
import { Skeleton } from "@repo/ui/components/skeleton";

interface ExperimentDesignPageProps {
  params: Promise<{ id: string; locale: string }>;
}

/** Surfaces the draft autosave status (reported by WorkbookDraftEditor) inline. */
function EditAutosaveStatus() {
  const autosave = useAutosaveStatus();
  if (!autosave?.status) return null;
  return <AutosaveIndicator status={autosave.status} variant="compact" />;
}

export default function ExperimentDesignPage({ params }: ExperimentDesignPageProps) {
  const { id, locale } = use(params);
  const { data: experiment, isLoading, error } = useExperiment(id);
  const {
    data: accessData,
    isLoading: accessLoading,
    error: accessError,
  } = useExperimentAccess(id);
  const { data: session } = useSession();
  const { t } = useTranslation("experiments");

  const experimentData = experiment;
  const hasAccess = accessData?.isAdmin ?? false;
  const workbookId = experimentData?.workbookId;
  const workbookVersionId = experimentData?.workbookVersionId;

  // Fetch the pinned workbook version (immutable snapshot with cells + entity
  // snapshots) for the read-only view, and the live draft for editing.
  const { data: pinnedVersionData } = useWorkbookVersion(
    workbookId ?? "",
    workbookVersionId ?? "",
    { enabled: !!(workbookId && workbookVersionId) },
  );
  const { data: workbookDraft } = useWorkbook(workbookId ?? "", { enabled: !!workbookId });

  const isWorkbookOwner =
    !!session?.user.id && !!workbookDraft && session.user.id === workbookDraft.createdBy;

  // Editing auto-applies a new version on every save, and that upgrade is
  // experiment-admin only. So editing requires admin AND ownership; a non-admin
  // owner would otherwise save fine but hit a failing upgrade (error toast) on
  // every save. Everyone else gets the read-only view.
  const canEdit = isWorkbookOwner && hasAccess;

  // Each autosave re-pins the experiment to the latest version (OJD-1626).
  const upgradeVersion = useUpgradeWorkbookVersion(id);
  const handleDraftSaved = useCallback(() => {
    upgradeVersion.mutate({ id });
  }, [id, upgradeVersion]);

  const versionedCells = useMemo<WorkbookCell[]>(() => {
    if (!pinnedVersionData) return [];
    return pinnedVersionData.cells;
  }, [pinnedVersionData]);

  const derivedFlow = useMemo(() => {
    if (versionedCells.length === 0) return undefined;
    try {
      const graph = cellsToFlowGraph(versionedCells);
      if (graph.nodes.length === 0) return undefined;
      return {
        id: "derived",
        experimentId: id,
        graph,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return undefined;
    }
  }, [versionedCells, id]);

  if (isLoading || accessLoading) {
    return (
      <PageContainer width="fluid" className="space-y-8">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-96" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }

  if (error ?? accessError) {
    return <ErrorDisplay error={error ?? accessError} title={t("failedToLoad")} />;
  }

  if (!experimentData || !accessData?.experiment) {
    return <div>{t("notFound")}</div>;
  }

  if (experimentData.status === "archived") {
    notFound();
  }

  if (!workbookId || !workbookVersionId) {
    return (
      <EmptyWorkbookState
        experimentId={id}
        experimentName={experimentData.name}
        hasAccess={hasAccess}
      />
    );
  }

  return (
    <PageContainer width="fluid" className="space-y-3">
      <AutosaveStatusProvider>
        {canEdit && (
          <div className="flex items-start justify-between gap-3">
            <div className="text-muted-foreground flex items-start gap-1.5 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {t("flow.editAutoApplyNotice")} {t("flow.editIsolatedHint")}{" "}
                <Link
                  href={`/${locale}/platform/workbooks/${workbookId}`}
                  className="text-primary font-medium underline underline-offset-2"
                >
                  {t("flow.editOpenWorkbookLink")}
                </Link>
              </p>
            </div>
            <EditAutosaveStatus />
          </div>
        )}

        <LinkedWorkbookCard
          experimentId={id}
          locale={locale}
          workbookId={workbookId}
          workbookVersionId={workbookVersionId}
          hasAccess={hasAccess}
          isWorkbookOwner={isWorkbookOwner}
        />

        <NavTabs defaultValue="list">
          <NavTabsList>
            <NavTabsTrigger value="list">
              <List className="h-4 w-4" />
              {t("flow.viewList")}
            </NavTabsTrigger>
            <NavTabsTrigger value="graph">
              <GitBranch className="h-4 w-4" />
              {t("flow.viewGraph")}
            </NavTabsTrigger>
          </NavTabsList>

          <NavTabsContent value="list" className="mt-6">
            {canEdit ? (
              <WorkbookEntitySavedProvider onEntitySaved={handleDraftSaved}>
                <WorkbookDraftEditor
                  id={workbookId}
                  initialCells={workbookDraft.cells}
                  createdBy={workbookDraft.createdBy}
                  name={workbookDraft.name}
                  onSaved={handleDraftSaved}
                />
              </WorkbookEntitySavedProvider>
            ) : (
              <WorkbookEditor
                cells={versionedCells}
                entitySnapshots={pinnedVersionData?.entitySnapshots}
                onCellsChange={() => undefined}
                readOnly
              />
            )}
          </NavTabsContent>

          <NavTabsContent value="graph" className="mt-6">
            <FlowEditor initialFlow={derivedFlow} isDisabled />
          </NavTabsContent>
        </NavTabs>
      </AutosaveStatusProvider>
    </PageContainer>
  );
}
